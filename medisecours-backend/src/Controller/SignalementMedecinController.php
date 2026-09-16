<?php

declare(strict_types=1);

namespace App\Controller;

use App\Entity\Medecin;
use App\Entity\Patient;
use App\Entity\SignalementMedecin;
use App\Repository\ConsultationRepository;
use App\Repository\SignalementMedecinRepository;
use App\Repository\UserRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/signalements-medecins')]
#[IsGranted('ROLE_PATIENT')]
final class SignalementMedecinController extends AbstractController
{
    #[Route('', name: 'api_signalement_medecin_create', methods: ['POST'])]
    public function create(
        Request $request,
        UserRepository $users,
        ConsultationRepository $consultations,
        EntityManagerInterface $entityManager,
    ): JsonResponse {
        $patient = $this->getUser();
        if (!$patient instanceof Patient) {
            return $this->json(['error' => 'Seul un patient peut signaler un médecin.'], 403);
        }

        $payload = json_decode((string) $request->getContent(), true);
        if (!is_array($payload)) {
            return $this->json(['error' => 'Le contenu du signalement est invalide.'], 400);
        }

        $medecinId = $this->extractIdentifier($payload['medecin'] ?? null);
        $medecin = $medecinId !== null ? $users->find($medecinId) : null;
        if (!$medecin instanceof Medecin) {
            return $this->json(['error' => 'Médecin introuvable.'], 404);
        }

        if (!$consultations->hasCompletedConsultation($patient, $medecin)) {
            return $this->json([
                'error' => 'Un médecin peut être signalé après une consultation terminée avec lui.',
            ], 403);
        }

        $motif = strtoupper(trim((string) ($payload['motif'] ?? '')));
        if (!in_array($motif, SignalementMedecin::MOTIFS, true)) {
            return $this->json(['error' => 'Sélectionnez un motif de signalement valide.'], 422);
        }

        $description = trim((string) ($payload['description'] ?? ''));
        if (mb_strlen($description) < 20 || mb_strlen($description) > 2000) {
            return $this->json([
                'error' => 'La description doit contenir entre 20 et 2000 caractères.',
            ], 422);
        }

        $signalement = (new SignalementMedecin())
            ->setPatient($patient)
            ->setMedecin($medecin)
            ->setMotif($motif)
            ->setDescription($description);

        $entityManager->persist($signalement);
        $entityManager->flush();

        return $this->json([
            'id' => $signalement->getId(),
            'statut' => $signalement->getStatut(),
            'createdAt' => $signalement->getCreatedAt()->format(\DateTimeInterface::ATOM),
        ], 201);
    }

    #[Route('/mine', name: 'api_signalement_medecin_mine', methods: ['GET'])]
    public function mine(SignalementMedecinRepository $signalements): JsonResponse
    {
        $patient = $this->getUser();
        if (!$patient instanceof Patient) {
            return $this->json(['items' => []], 403);
        }

        return $this->json([
            'items' => array_map(
                static fn (SignalementMedecin $signalement): array => [
                    'id' => $signalement->getId(),
                    'medecinId' => (string) $signalement->getMedecin()?->getId(),
                    'medecin' => $signalement->getMedecin() ? [
                        'id' => (string) $signalement->getMedecin()?->getId(),
                        'nom' => $signalement->getMedecin()?->getNom(),
                        'prenom' => $signalement->getMedecin()?->getPrenom(),
                        'specialite' => $signalement->getMedecin()?->getSpecialite(),
                    ] : null,
                    'motif' => $signalement->getMotif(),
                    'description' => $signalement->getDescription(),
                    'statut' => $signalement->getStatut(),
                    'noteAdmin' => $signalement->getNoteAdmin(),
                    'createdAt' => $signalement->getCreatedAt()->format(\DateTimeInterface::ATOM),
                    'updatedAt' => $signalement->getUpdatedAt()->format(\DateTimeInterface::ATOM),
                    'traiteAt' => $signalement->getTraiteAt()?->format(\DateTimeInterface::ATOM),
                ],
                $signalements->findForPatient($patient),
            ),
        ]);
    }

    private function extractIdentifier(mixed $value): ?string
    {
        if (!is_string($value) || trim($value) === '') {
            return null;
        }

        $parts = explode('/', trim($value));

        return (string) end($parts);
    }
}
