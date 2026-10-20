<?php

declare(strict_types=1);

namespace App\Controller;

use App\Entity\AvisPersonnel;
use App\Entity\Patient;
use App\Entity\PersonnelSante;
use App\Repository\AvisPersonnelRepository;
use App\Repository\ConsultationRepository;
use App\Repository\DossierMedicalRepository;
use App\Service\NotificationService;
use App\Service\SessionService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\Routing\Annotation\Route;

/**
 * Notation des personnels de santé par les patients.
 *
 * - POST /api/avis-personnel           : un patient note un soignant qu'il a
 *   réellement rencontré (consultation terminée ou dossier médical ouvert dans
 *   l'établissement du personnel). Un avis par patient et par personnel.
 * - GET  /api/personnels/{id}/avis     : lecture publique des avis publiés.
 *
 * Règle de sécurité appliquée après chaque publication : une note moyenne
 * inférieure à 2 étoiles (à partir de SEUIL_AVIS_BANNISSEMENT avis) bannit
 * automatiquement le personnel, avec motif, date et révocation des sessions.
 */
class AvisPersonnelController extends AbstractController
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly AvisPersonnelRepository $avis,
        private readonly ConsultationRepository $consultations,
        private readonly DossierMedicalRepository $dossiers,
        private readonly NotificationService $notifications,
        private readonly SessionService $sessions,
    ) {
    }

    #[Route('/api/avis-personnel', name: 'api_avis_personnel_create', methods: ['POST'])]
    public function create(Request $request): JsonResponse
    {
        $user = $this->getUser();
        if (!$user instanceof Patient) {
            throw new AccessDeniedHttpException('Seul un patient peut noter un personnel de santé.');
        }

        $data = $request->toArray();
        $personnelId = trim((string) ($data['personnelId'] ?? ''));
        $note = (int) ($data['note'] ?? 0);
        $commentaire = trim((string) ($data['commentaire'] ?? ''));

        if ($personnelId === '') {
            throw new BadRequestHttpException('Le personnel à noter est obligatoire.');
        }
        if ($note < 1 || $note > 5) {
            throw new BadRequestHttpException('La note doit être comprise entre 1 et 5.');
        }
        if ($commentaire !== '' && (mb_strlen($commentaire) < 5 || mb_strlen($commentaire) > 2000)) {
            throw new BadRequestHttpException('Le commentaire doit faire entre 5 et 2000 caractères.');
        }

        $personnel = $this->em->getRepository(PersonnelSante::class)->find($personnelId);
        if (!$personnel) {
            throw new NotFoundHttpException('Personnel introuvable.');
        }
        if ($personnel->isBanni()) {
            throw new AccessDeniedHttpException('Ce personnel n’est plus référencé sur la plateforme.');
        }

        $this->assertPatientHasRencontre($user, $personnel);

        $avis = $this->avis->findOneByPersonnelAndPatient($personnel, $user);
        if ($avis) {
            // Un avis se met à jour, il ne se dédouble pas.
            $avis->setNote($note);
            $avis->setCommentaire($commentaire !== '' ? $commentaire : null);
            $avis->setStatut(AvisPersonnel::STATUT_PUBLIE);
            $avis->setUpdatedAt(new \DateTimeImmutable());
        } else {
            $avis = new AvisPersonnel();
            $avis
                ->setPersonnel($personnel)
                ->setPatient($user)
                ->setNote($note)
                ->setCommentaire($commentaire !== '' ? $commentaire : null)
                ->setStatut(AvisPersonnel::STATUT_PUBLIE);
            $this->em->persist($avis);
        }

        $this->em->flush();

        $noteMoyenne = $this->refreshAggregates($personnel);
        $banni = $this->appliquerRegleBannissement($personnel, $noteMoyenne);

        $this->em->flush();

        return new JsonResponse([
            'avis' => $this->serializeAvis($avis),
            'noteMoyenne' => $noteMoyenne,
            'totalAvis' => $personnel->getTotalAvis(),
            'banni' => $banni,
        ], Response::HTTP_CREATED);
    }

    #[Route('/api/personnels/{id}/avis', name: 'api_personnel_avis_liste', methods: ['GET'], requirements: ['id' => '[0-9a-fA-F-]{36}'])]
    public function liste(string $id): JsonResponse
    {
        $personnel = $this->em->getRepository(PersonnelSante::class)->find($id);
        if (!$personnel) {
            throw new NotFoundHttpException('Personnel introuvable.');
        }

        $items = array_map(
            fn (AvisPersonnel $avis): array => $this->serializeAvis($avis),
            $this->avis->findPublishedByPersonnel($personnel)
        );

        return new JsonResponse([
            'items' => $items,
            'total' => count($items),
            'noteMoyenne' => $personnel->getNoteMoyenne(),
            'distribution' => $this->avis->getNoteDistribution($personnel),
        ]);
    }

    /**
     * Le patient doit avoir réellement rencontré ce personnel : consultation
     * terminée à l'établissement, ou dossier médical ouvert dans l'établissement
     * du personnel. Sans cela, n'importe qui pourrait nuire à un compte.
     */
    private function assertPatientHasRencontre(Patient $patient, PersonnelSante $personnel): void
    {
        $centre = $personnel->getEtablissement();
        if (!$centre) {
            throw new AccessDeniedHttpException('Ce personnel n’est rattaché à aucun établissement.');
        }

        $consultation = $this->consultations->findOneBy([
            'patient' => $patient,
            'etablissement' => $centre,
            'statut' => \App\Entity\Consultation::STATUT_TERMINEE,
        ]);
        if ($consultation) {
            return;
        }

        $dossier = $this->dossiers->findOneByCentrePatient($centre, $patient);
        if ($dossier) {
            return;
        }

        throw new AccessDeniedHttpException('Vous ne pouvez noter que le personnel que vous avez rencontré dans cet établissement.');
    }

    /**
     * Recalcule note moyenne et total d'avis, puis applique la règle de
     * bannissement si la moyenne passe sous le seuil.
     */
    private function refreshAggregates(PersonnelSante $personnel): float
    {
        $noteMoyenne = round($this->avis->getNoteMoyenne($personnel), 2);
        $total = $this->avis->countPublished($personnel);

        $personnel
            ->setNoteMoyenne($noteMoyenne)
            ->setTotalAvis($total);

        return $noteMoyenne;
    }

    private function appliquerRegleBannissement(PersonnelSante $personnel, float $noteMoyenne): bool
    {
        if ($personnel->isBanni()) {
            return true;
        }
        if ($personnel->getTotalAvis() < AvisPersonnel::SEUIL_AVIS_BANNISSEMENT) {
            return false;
        }
        if ($noteMoyenne >= AvisPersonnel::SEUIL_NOTE_BANNISSEMENT) {
            return false;
        }

        $personnel
            ->setBanni(true)
            ->setActif(false)
            ->setBanniMotif(sprintf(
                'Note moyenne de %.2f/5 inférieure au seuil de %.1f/5 sur %d avis.',
                $noteMoyenne,
                AvisPersonnel::SEUIL_NOTE_BANNISSEMENT,
                $personnel->getTotalAvis()
            ))
            ->setBanniAt(new \DateTimeImmutable());

        // Les sessions ouvertes sont révoquées : le personnel ne doit pas
        // pouvoir continuer à travailler avec un compte banni.
        try {
            $this->sessions->revokeUserSessions($personnel);
        } catch (\Throwable) {
            // La révocation best-effort : un échec ne doit pas annuler le ban.
        }

        $this->notifications->create(
            $personnel,
            'personnel_banni',
            'Compte suspendu',
            sprintf(
                'Votre compte a été suspendu : note moyenne de %.2f/5 sur %d avis.',
                $noteMoyenne,
                $personnel->getTotalAvis()
            ),
            '/personnel/tableau-de-bord'
        );

        return true;
    }

    private function serializeAvis(AvisPersonnel $avis): array
    {
        $patient = $avis->getPatient();

        return [
            'id' => $avis->getId(),
            'note' => $avis->getNote(),
            'commentaire' => $avis->getCommentaire(),
            'statut' => $avis->getStatut(),
            'signale' => $avis->isSignale(),
            'createdAt' => $avis->getCreatedAt()->format('c'),
            'updatedAt' => $avis->getUpdatedAt()?->format('c'),
            'auteurNom' => $patient ? trim(($patient->getPrenom() ?? '').' '.($patient->getNom() ?? '')) : null,
            'auteurPhoto' => $patient?->getPhotoProfil(),
        ];
    }
}
