<?php

declare(strict_types=1);

namespace App\Controller;

use App\Entity\Maladie;
use App\Repository\MaladieRepository;
use App\Service\ContentLocalizer;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\RateLimiter\RateLimiterFactory;
use Symfony\Component\Routing\Annotation\Route;

final class PublicConditionController extends AbstractController
{
    public function __construct(
        private readonly MaladieRepository $repository,
        #[Autowire(service: 'limiter.api_public')]
        private readonly RateLimiterFactory $publicApiLimiter,
        private readonly ContentLocalizer $localizer,
    ) {
    }

    #[Route('/api/public/conditions', name: 'api_public_conditions', methods: ['GET'])]
    public function list(Request $request): JsonResponse
    {
        if ($this->rateLimited($request)) {
            return $this->json(['message' => $this->rateLimitMessage()], Response::HTTP_TOO_MANY_REQUESTS);
        }

        $page = max(1, $request->query->getInt('page', 1));
        $itemsPerPage = min(30, max(6, $request->query->getInt('itemsPerPage', 12)));
        $category = trim((string) $request->query->get('category', ''));
        $categoryId = ctype_digit($category) ? (int) $category : null;
        $result = $this->repository->findPatientCatalogPage(
            $page,
            $itemsPerPage,
            $categoryId
        );
        $totalPages = max(1, (int) ceil($result['total'] / $itemsPerPage));

        return $this->json([
            'items' => array_map(fn (Maladie $maladie): array => $this->serialize($maladie), $result['items']),
            'total' => $result['total'],
            'page' => min($page, $totalPages),
            'itemsPerPage' => $itemsPerPage,
            'totalPages' => $totalPages,
        ]);
    }

    #[Route('/api/public/conditions/{id<\d+>}', name: 'api_public_condition_detail', methods: ['GET'])]
    public function detail(int $id, Request $request): JsonResponse
    {
        if ($this->rateLimited($request)) {
            return $this->json(['message' => $this->rateLimitMessage()], Response::HTTP_TOO_MANY_REQUESTS);
        }

        $condition = $this->repository->findPatientCatalogOne($id);
        if (!$condition instanceof Maladie) {
            return $this->json(['message' => 'Cette fiche patient est indisponible.'], Response::HTTP_NOT_FOUND);
        }

        return $this->json($this->serialize($condition));
    }

    /**
     * Le DTO patient exclut volontairement traitement, prescriptions et anciens
     * objets PremierSoin rattachés aux maladies.
     *
     * @return array<string, mixed>
     */
    private function serialize(Maladie $maladie): array
    {
        return [
            'id' => $maladie->getId(),
            'nom' => $this->localizer->pick($maladie->getNom(), $maladie->getNomEn()),
            'description' => $this->localizer->pickNullable($maladie->getDescription(), $maladie->getDescriptionEn()),
            'symptomes' => $this->localizer->pickNullable($maladie->getSymptomes(), $maladie->getSymptomesEn()),
            'precautions' => $this->localizer->pickNullable($maladie->getPrecautions(), $maladie->getPrecautionsEn()),
            'causes' => $this->localizer->pickNullable($maladie->getCauses(), $maladie->getCausesEn()),
            'niveauGravite' => $maladie->getNiveauGravite(),
            'urgence' => $maladie->isUrgence(),
            'contagieux' => $maladie->isContagieux(),
            'isAccident' => $maladie->isIsAccident(),
            'imageUrl' => $maladie->getImageUrl(),
            'categorie' => $maladie->getCategorie() ? [
                'id' => $maladie->getCategorie()->getId(),
                'nom' => $this->localizer->pick($maladie->getCategorie()->getNom(), $maladie->getCategorie()->getNomEn()),
            ] : null,
        ];
    }

    private function rateLimitMessage(): string
    {
        return $this->localizer->isEnglish()
            ? 'Too many requests. Please try again in a few moments.'
            : 'Trop de demandes. Réessayez dans quelques instants.';
    }

    private function rateLimited(Request $request): bool
    {
        return !$this->publicApiLimiter->create((string) $request->getClientIp())->consume()->isAccepted();
    }
}
