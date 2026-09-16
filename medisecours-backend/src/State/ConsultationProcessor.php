<?php

namespace App\State;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\Metadata\Post;
use ApiPlatform\State\ProcessorInterface;
use App\Entity\Consultation;
use App\Entity\Medecin;
use App\Entity\Patient;
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
        ];
    }
}
