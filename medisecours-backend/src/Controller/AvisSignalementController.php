<?php

declare(strict_types=1);

namespace App\Controller;

use App\Entity\Avis;
use App\Entity\Medecin;
use App\Repository\AvisRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\Security\Http\Attribute\IsGranted;

/**
 * Permet à un médecin de signaler un avis le concernant pour modération.
 *
 * Le médecin évalué ne peut PAS modifier la note ou le commentaire :
 * seul le passage en « signalé » (signale + raisonSignalement) est autorisé ici.
 */
#[IsGranted('ROLE_MEDECIN')]
class AvisSignalementController
{
    public function __construct(
        private readonly Security $security,
        private readonly AvisRepository $avisRepository,
        private readonly EntityManagerInterface $entityManager,
    ) {
    }

    #[Route('/api/avis/{id}/signaler', name: 'api_avis_signaler', methods: ['POST'])]
    public function signaler(string $id, Request $request): JsonResponse
    {
        $avis = $this->avisRepository->find($id);

        if (!$avis) {
            return new JsonResponse(['error' => 'Avis introuvable.'], 404);
        }

        $user = $this->security->getUser();
        if (!$user instanceof Medecin || $avis->getMedecin() !== $user) {
            return new JsonResponse(
                ['error' => 'Vous ne pouvez signaler que les avis qui vous concernent.'],
                403
            );
        }

        $body = json_decode((string) $request->getContent(), true);
        $raison = trim((string) ($body['raison'] ?? ''));

        if ($raison === '') {
            return new JsonResponse(['error' => 'La raison du signalement est obligatoire.'], 422);
        }

        $avis->setSignale(true);
        $avis->setRaisonSignalement(mb_substr($raison, 0, 2000));
        $avis->setUpdatedAt(new \DateTimeImmutable());
        $this->entityManager->flush();

        return new JsonResponse(['status' => 'ok', 'avis' => [
            'id' => $avis->getId(),
            'signale' => $avis->isSignale(),
            'raisonSignalement' => $avis->getRaisonSignalement(),
        ]]);
    }
}
