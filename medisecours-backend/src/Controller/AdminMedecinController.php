<?php

declare(strict_types=1);

namespace App\Controller;

use App\Entity\Medecin;
use App\Entity\User;
use App\Security\Voter\MedecinVoter;
use App\Service\EmailVerificationService;
use App\Service\SessionService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;

/**
 * Endpoints d'administration des médecins.
 * Protégés par le MedecinVoter (ROLE_ADMIN requis).
 */
class AdminMedecinController extends AbstractController
{
    public function __construct(
        private readonly EmailVerificationService $emailService,
        private readonly SessionService $sessionService,
    ) {
    }
    /**
     * Valide ou invalide un compte médecin.
     *
     * PATCH /api/admin/medecins/{id}/validation
     * Body : { "estValide": true }
     *     ou { "estValide": false, "motif": "Numéro d'ordre invalide." }
     */
    #[Route('/api/admin/medecins/{id}/validation', name: 'api_admin_medecin_validation', methods: ['PATCH'])]
    public function toggleValidation(string $id, Request $request, EntityManagerInterface $entityManager): JsonResponse
    {
        $user = $entityManager->getRepository(User::class)->find($id);

        if (!$user instanceof Medecin) {
            return new JsonResponse(['error' => 'Médecin introuvable.'], Response::HTTP_NOT_FOUND);
        }

        $this->denyAccessUnlessGranted(MedecinVoter::VALIDATE, $user);

        $data = json_decode($request->getContent(), true);

        if (!isset($data['estValide']) || !is_bool($data['estValide'])) {
            // Bascule l'état si aucun paramètre explicite
            $data['estValide'] = !$user->isEstValide();
        }

        if ($data['estValide'] === true && !$user->hasCompleteIdentityVerificationFile()) {
            return new JsonResponse([
                'error' => 'Ce médecin ne peut pas être validé : son dossier d’identité est incomplet.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $user->setEstValide($data['estValide']);
        if (!$data['estValide']) {
            $this->sessionService->revokeUserSessions($user);
        }
        $entityManager->flush();

        $emailFailed = false;
        if ($data['estValide'] === true) {
            // Validation → email de félicitations (même si déjà validé — retrigger explicite)
            try {
                $this->emailService->sendMedecinValidatedEmail($user);
            } catch (\Throwable) {
                $emailFailed = true;
            }
        } elseif ($data['estValide'] === false) {
            // Refus → email avec motif
            $motif = (string) ($data['motif'] ?? 'Aucun motif précisé.');
            try {
                $this->emailService->sendMedecinRejectedEmail($user, $motif);
            } catch (\Throwable) {
                $emailFailed = true;
            }
        }

        $response = [
            'message' => $user->isEstValide()
                ? 'Compte médecin validé.'
                : 'Compte médecin invalidé.',
            'user' => $this->serializeMedecin($user),
        ];

        if ($emailFailed) {
            $response['emailSent'] = false;
        }

        return new JsonResponse($response);
    }

    /**
     * Retourne la liste de TOUS les médecins (validés + en attente), triés A-Z.
     * GET /api/admin/medecins
     */
    #[Route('/api/admin/medecins', name: 'api_admin_medecins_all', methods: ['GET'])]
    public function getAllMedecins(EntityManagerInterface $entityManager): JsonResponse
    {
        $this->denyAccessUnlessGranted('ROLE_ADMIN');

        $medecins = $entityManager->getRepository(Medecin::class)->findBy(
            [],
            ['nom' => 'ASC', 'prenom' => 'ASC']
        );

        return new JsonResponse([
            'total'    => count($medecins),
            'medecins' => array_map($this->serializeMedecin(...), $medecins),
        ]);
    }

    /**
     * Retourne la liste des médecins en attente de validation.
     * GET /api/admin/medecins/en-attente
     */
    #[Route('/api/admin/medecins/en-attente', name: 'api_admin_medecins_en_attente', methods: ['GET'])]
    public function getMedecinsEnAttente(EntityManagerInterface $entityManager): JsonResponse
    {
        $this->denyAccessUnlessGranted('ROLE_ADMIN');

        $medecins = $entityManager->getRepository(Medecin::class)->findBy(
            ['estValide' => false],
            ['nom' => 'ASC', 'prenom' => 'ASC']
        );

        return new JsonResponse([
            'total' => count($medecins),
            'medecins' => array_map($this->serializeMedecin(...), $medecins),
        ]);
    }

    /**
     * Retourne les statistiques globales de la plateforme.
     * GET /api/admin/stats
     */
    #[Route('/api/admin/stats', name: 'api_admin_stats', methods: ['GET'])]
    public function getStats(EntityManagerInterface $entityManager): JsonResponse
    {
        $this->denyAccessUnlessGranted('ROLE_ADMIN');

        $conn = $entityManager->getConnection();

        // Toutes les requêtes en une seule fois pour minimiser les allers-retours DB
        $patients = (int) $conn->fetchOne("SELECT COUNT(*) FROM \"user\" WHERE type = 'patient'");
        $medecins = (int) $conn->fetchOne("SELECT COUNT(*) FROM \"user\" WHERE type = 'medecin'");
        $medecinsValides = (int) $conn->fetchOne("SELECT COUNT(*) FROM \"user\" WHERE type = 'medecin' AND est_valide = true");
        $medecinsEnAttente = $medecins - $medecinsValides;
        $maladies = (int) $conn->fetchOne('SELECT COUNT(*) FROM maladie');
        $categories = (int) $conn->fetchOne('SELECT COUNT(*) FROM categorie');
        $centres = (int) $conn->fetchOne('SELECT COUNT(*) FROM centre_de_sante WHERE est_actif = true');
        $consultations = (int) $conn->fetchOne('SELECT COUNT(*) FROM consultation');
        $consultationsEnCours = (int) $conn->fetchOne("SELECT COUNT(*) FROM consultation WHERE statut IN ('OUVERTE', 'EN_COURS')");
        $messages = (int) $conn->fetchOne('SELECT COUNT(*) FROM message WHERE deleted_at IS NULL');
        $avis = (int) $conn->fetchOne('SELECT COUNT(*) FROM avis WHERE signale = false');
        $avisSignales = (int) $conn->fetchOne('SELECT COUNT(*) FROM avis WHERE signale = true');

        return new JsonResponse([
            'utilisateurs' => [
                'patients'            => $patients,
                'medecins'            => $medecins,
                'medecinsValides'     => $medecinsValides,
                'medecinsEnAttente'   => $medecinsEnAttente,
                'total'               => $patients + $medecins,
            ],
            'contenu' => [
                'maladies'   => $maladies,
                'categories' => $categories,
                'centres'    => $centres,
            ],
            'activite' => [
                'consultations'          => $consultations,
                'consultationsEnCours'   => $consultationsEnCours,
                'messages'               => $messages,
                'avis'                   => $avis,
                'avisSignales'           => $avisSignales,
            ],
        ]);
    }

    private function serializeMedecin(Medecin $medecin): array
    {
        return [
            'id'          => (string) $medecin->getId(),
            'email'       => $medecin->getEmail(),
            'nom'         => $medecin->getNom(),
            'prenom'      => $medecin->getPrenom(),
            'specialite'  => $medecin->getSpecialite(),
            'numeroOrdre' => $medecin->getNumeroOrdre(),
            'telephone'   => $medecin->getTelephone(),
            'estValide'   => $medecin->isEstValide(),
            'actif'       => $medecin->isActif(),
            'banni'       => $medecin->isBanni(),
            'roles'       => $medecin->getRoles(),
            'verificationIdentite' => [
                'complet' => $medecin->hasCompleteIdentityVerificationFile(),
                'typePiece' => $medecin->getTypePieceIdentite(),
                'recto' => $this->serializeIdentityMedia($medecin->getPieceIdentite()),
                'verso' => $this->serializeIdentityMedia($medecin->getPieceIdentiteVerso()),
                'photo' => $this->serializeIdentityMedia($medecin->getPhotoVerificationIdentite()),
            ],
        ];
    }

    private function serializeIdentityMedia(?\App\Entity\MediaObject $media): ?array
    {
        if ($media === null || $media->getId() === null) {
            return null;
        }

        return [
            'id' => $media->getId(),
            'nom' => $media->getOriginalName(),
            'mimeType' => $media->getMimeType(),
            'taille' => $media->getSize(),
            'url' => '/api/media_objects/'.$media->getId().'/download',
        ];
    }

}
