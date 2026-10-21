<?php

namespace App\State;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\Metadata\Post;
use ApiPlatform\State\ProcessorInterface;
use App\Entity\Consultation;
use App\Entity\DossierEvenement;
use App\Entity\DossierMedical;
use App\Entity\Medecin;
use App\Entity\Patient;
use App\Entity\User;
use App\Message\WebSocketNotification;
use App\Service\ConsultationEmailService;
use App\Service\NotificationService;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\Messenger\MessageBusInterface;

class ConsultationProcessor implements ProcessorInterface
{
    public function __construct(
        #[Autowire(service: 'api_platform.doctrine.orm.state.persist_processor')]
        private readonly ProcessorInterface $persistProcessor,
        private readonly Security $security,
        private readonly EntityManagerInterface $em,
        private readonly MessageBusInterface $messageBus,
        private readonly ConsultationEmailService $emailService,
        private readonly LoggerInterface $logger,
        private readonly NotificationService $notificationService,
    ) {
    }

    public function process(mixed $data, Operation $operation, array $uriVariables = [], array $context = []): mixed
    {
        if (!$data instanceof Consultation) {
            return $this->persistProcessor->process($data, $operation, $uriVariables, $context);
        }

        $user = $this->security->getUser();
        $originalStatut = $this->em->getUnitOfWork()->getOriginalEntityData($data)['statut'] ?? null;

        if ($operation instanceof Post) {
            if (!$user instanceof Patient) {
                throw new AccessDeniedHttpException('Seul un patient peut creer une consultation.');
            }
            $data->setPatient($user);
            $data->setMedecin(null);
            $data->setStatut(Consultation::STATUT_OUVERTE);
        } else {
            $this->assertAllowedUpdate($data, $user, $originalStatut);
        }

        $result = $this->persistProcessor->process($data, $operation, $uriVariables, $context);

        if ($result instanceof Consultation) {
            $this->notifyStatusChange($result, $originalStatut);
        }

        return $result;
    }

    /**
     * Rattache la consultation au dossier medical du patient dans
     * l'etablissement et y inscrit un acte trace (horodate, auteur, cachet).
     *
     * C'est ce qui transforme une consultation isolee en une visite de plus
     * dans le dossier : la chaine de suivi du patient devient complete
     * (accueil -> consultation -> soins -> pharmacie).
     */
    private function rattacherAuDossier(Consultation $consultation): void
    {
        $centre = $consultation->getEtablissement();
        $patient = $consultation->getPatient();
        if (!$centre || !$patient) {
            return;
        }

        $dossier = $this->em->getRepository(DossierMedical::class)->findOneBy([
            'centre' => $centre,
            'patient' => $patient,
        ]);

        if (!$dossier) {
            $dossier = new DossierMedical();
            $dossier->setCentre($centre);
            $dossier->setPatient($patient);
            $this->em->persist($dossier);
            $this->em->flush();
        }

        $consultation->setDossier($dossier);

        $dossier
            ->setNombreVisites($dossier->getNombreVisites() + 1)
            ->setDerniereVisiteAt(new \DateTimeImmutable());

        $evenement = new DossierEvenement();

        // L'auteur de l'acte est le médecin (Medecin extends User) ou, à
        // défaut, l'utilisateur connecté — mais uniquement s'il s'agit bien
        // d'une entité User : getUser() renvoie une interface.
        $auteur = $consultation->getMedecin();
        if (!$auteur instanceof User) {
            $connecte = $this->security->getUser();
            $auteur = $connecte instanceof User ? $connecte : null;
        }

        $evenement
            ->setDossier($dossier)
            ->setPatient($patient)
            ->setCentre($centre)
            ->setType(DossierEvenement::TYPE_CONSULTATION)
            ->setTitre('Consultation médicale')
            ->setDetails([
                'consultationId' => $consultation->getId(),
                'motif' => $consultation->getMotif(),
                'priorite' => $consultation->getPriorite(),
                'mode' => $consultation->getMode(),
                'medecinId' => $consultation->getMedecin()?->getId(),
                'compteRendu' => $consultation->getCompteRendu(),
            ])
            ->setAuteur($auteur)
            // Cachet de l'etablissement appose au moment de l'acte : l'acte
            // reste lie au cachet qui l'a scelle, meme si le cachet change.
            ->setCachetUrl($centre->getCachetUrl());

        $this->em->persist($evenement);
    }

    private function assertAllowedUpdate(Consultation $consultation, mixed $user, ?string $originalStatut): void
    {
        if (!$user instanceof Patient && !$user instanceof Medecin) {
            throw new AccessDeniedHttpException('Seul un patient ou un médecin peut modifier une consultation.');
        }

        if ($user instanceof Patient) {
            if ($consultation->getPatient() !== $user) {
                throw new AccessDeniedHttpException('Vous ne pouvez modifier que vos propres consultations.');
            }
            if ($consultation->getMedecin() !== null || $consultation->getStatut() !== Consultation::STATUT_ANNULEE) {
                throw new AccessDeniedHttpException('Un patient peut uniquement annuler une consultation non prise en charge.');
            }
            if ($originalStatut !== Consultation::STATUT_OUVERTE) {
                throw new AccessDeniedHttpException('Seule une consultation ouverte peut être annulée par le patient.');
            }

            return;
        }

        if ($consultation->getMedecin() === null) {
            if ($originalStatut !== Consultation::STATUT_OUVERTE || $consultation->getStatut() !== Consultation::STATUT_EN_COURS) {
                throw new AccessDeniedHttpException('Un médecin peut uniquement prendre en charge une consultation ouverte.');
            }
            $consultation->setMedecin($user);

            return;
        }

        if ($consultation->getMedecin() !== $user) {
            throw new AccessDeniedHttpException('Vous ne pouvez modifier que les consultations dont vous êtes responsable.');
        }

        if ($originalStatut !== Consultation::STATUT_EN_COURS || !in_array($consultation->getStatut(), [Consultation::STATUT_EN_COURS, Consultation::STATUT_TERMINEE], true)) {
            throw new AccessDeniedHttpException('Transition de consultation non autorisée.');
        }
    }

    private function notifyStatusChange(Consultation $consultation, ?string $originalStatut): void
    {
        $statut = $consultation->getStatut();

        if ($originalStatut === null && $statut === Consultation::STATUT_OUVERTE) {
            $this->logger->info('Dispatch consultation_created', ['id' => $consultation->getId()]);
            $this->messageBus->dispatch(new WebSocketNotification(
                event: 'consultation_created',
                payload: $this->buildPayload($consultation),
            ));
        }

        if ($statut === Consultation::STATUT_EN_COURS && $originalStatut === Consultation::STATUT_OUVERTE) {
            if ($consultation->getPatient()) {
                $this->notificationService->create(
                    $consultation->getPatient(),
                    'consultation_accepted',
                    'Consultation prise en charge',
                    'Un médecin a pris votre demande en charge.',
                    '/patient/consultations',
                );
                $this->em->flush();
            }
            $this->logger->info('Dispatch consultation_accepted', ['id' => $consultation->getId()]);
            $this->messageBus->dispatch(new WebSocketNotification(
                event: 'consultation_accepted',
                payload: $this->buildPayload($consultation),
            ));
        }

        if ($statut === Consultation::STATUT_TERMINEE) {
            if ($consultation->getPatient()) {
                $this->notificationService->create(
                    $consultation->getPatient(),
                    'consultation_closed',
                    'Consultation terminée',
                    'Votre consultation est terminée. Consultez son historique pour les informations de suivi.',
                    '/patient/consultations',
                );
                $this->em->flush();
            }
            $this->logger->info('Dispatch consultation_closed', ['id' => $consultation->getId()]);
            $this->messageBus->dispatch(new WebSocketNotification(
                event: 'consultation_closed',
                payload: $this->buildPayload($consultation),
            ));
            // La consultation devient une visite du dossier medical : l'acte
            // est inscrit, horodate, avec le cachet de l'etablissement.
            $this->rattacherAuDossier($consultation);
            $this->em->flush();
            $prescription = $consultation->getPrescriptions()->last() ?: null;
            $this->emailService->sendClosingEmail($consultation, $prescription);
        }
    }

    private function buildPayload(Consultation $c): array
    {
        return [
            'id' => $c->getId(),
            'statut' => $c->getStatut(),
            'motif' => $c->getMotif(),
            'priorite' => $c->getPriorite(),
            'mode' => $c->getMode(),
            'createdAt' => $c->getCreatedAt()?->format('c'),
            'patient' => $c->getPatient() ? [
                'id' => $c->getPatient()->getId(),
                'nom' => $c->getPatient()->getNom(),
                'prenom' => $c->getPatient()->getPrenom(),
                'photoProfil' => $c->getPatient()->getPhotoProfil(),
                'telephone' => $c->getPatient()->getTelephone(),
            ] : null,
            'medecin' => $c->getMedecin() ? [
                'id' => $c->getMedecin()->getId(),
                'nom' => $c->getMedecin()->getNom(),
                'prenom' => $c->getMedecin()->getPrenom(),
                'photoProfil' => $c->getMedecin()->getPhotoProfil(),
                'telephone' => $c->getMedecin()->getTelephone(),
            ] : null,
            'etablissement' => $c->getEtablissement() ? [
                'id' => $c->getEtablissement()->getId(),
                'nom' => $c->getEtablissement()->getNom(),
                'type' => $c->getEtablissement()->getType(),
                'ville' => $c->getEtablissement()->getVille(),
            ] : null,
        ];
    }
}
