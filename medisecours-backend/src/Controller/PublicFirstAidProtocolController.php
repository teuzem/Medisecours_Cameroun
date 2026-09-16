<?php

declare(strict_types=1);

namespace App\Controller;

use App\Entity\ProtocoleConsultation;
use App\Entity\ProtocoleRechercheStat;
use App\Repository\ProtocolePremiersGestesRepository;
use App\Service\CameroonFirstAidPriorityService;
use App\Service\ContentLocalizer;
use App\Service\FirstAidProtocolPublicSerializer;
use App\Service\FirstAidProtocolSearchService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\RateLimiter\RateLimiterFactory;
use Symfony\Component\Routing\Annotation\Route;

/**
 * API publique dédiée aux premiers gestes : DTO minimal, aucune donnée
 * administrative, journalisation anonyme des consultations et des recherches.
 * Limite anti-scraping : 50 req/min par IP (limiter.api_first_aid).
 */
final class PublicFirstAidProtocolController extends AbstractController
{
    public function __construct(
        private readonly ProtocolePremiersGestesRepository $protocolRepository,
        private readonly CameroonFirstAidPriorityService $priorityService,
        private readonly FirstAidProtocolPublicSerializer $serializer,
        private readonly FirstAidProtocolSearchService $searchService,
        private readonly ContentLocalizer $localizer,
        private readonly EntityManagerInterface $entityManager,
        #[Autowire(service: 'limiter.api_first_aid')] private readonly RateLimiterFactory $publicApiLimiter,
    ) {
    }

    #[Route('/api/public/first-aid-protocols', name: 'api_public_first_aid_protocols', methods: ['GET'])]
    public function list(Request $request): JsonResponse
    {
        if ($this->rejected($request)) {
            return $this->json(['message' => $this->rateLimitMessage()], Response::HTTP_TOO_MANY_REQUESTS);
        }

        $page = max(1, $request->query->getInt('page', 1));
        $itemsPerPage = min(24, max(6, $request->query->getInt('itemsPerPage', 12)));
        $category = trim((string) $request->query->get('category', ''));
        $urgency = strtoupper(trim((string) $request->query->get('urgency', '')));

        $protocols = $this->priorityService->sort(array_values(array_filter(
            $this->protocolRepository->findAllPublic(),
            static fn ($protocol): bool =>
                ($category === '' || $protocol->getCategorie() === $category)
                && ($urgency === '' || $protocol->getNiveauUrgence() === $urgency)
        )));
        $total = count($protocols);
        $totalPages = max(1, (int) ceil($total / $itemsPerPage));
        $page = min($page, $totalPages);
        $items = array_slice($protocols, ($page - 1) * $itemsPerPage, $itemsPerPage);

        return $this->json([
            'items' => $this->serializer->serializeMany($items),
            'total' => $total,
            'page' => $page,
            'itemsPerPage' => $itemsPerPage,
            'totalPages' => $totalPages,
        ]);
    }

    #[Route('/api/public/first-aid-protocols/categories', name: 'api_public_first_aid_categories', methods: ['GET'])]
    public function categories(Request $request): JsonResponse
    {
        if ($this->rejected($request)) {
            return $this->json(['message' => $this->rateLimitMessage()], Response::HTTP_TOO_MANY_REQUESTS);
        }

        $protocols = $this->protocolRepository->findAllPublic();
        $counts = [];
        foreach ($protocols as $protocol) {
            $category = $protocol->getCategorie() ?? 'autre';
            $counts[$category] = ($counts[$category] ?? 0) + 1;
        }

        $items = [];
        foreach (FirstAidProtocolSearchService::CATEGORIES as $slug => $label) {
            $labelEn = FirstAidProtocolSearchService::CATEGORIES_EN[$slug] ?? $label;
            $items[] = ['slug' => $slug, 'label' => $this->localizer->pick($label, $labelEn), 'count' => $counts[$slug] ?? 0];
        }

        return $this->json($items);
    }

    #[Route('/api/public/first-aid-protocols/search', name: 'api_public_first_aid_search', methods: ['GET'])]
    public function search(Request $request): JsonResponse
    {
        if ($this->rejected($request)) {
            return $this->json(['message' => $this->rateLimitMessage()], Response::HTTP_TOO_MANY_REQUESTS);
        }

        $query = trim((string) $request->query->get('q', ''));
        if ($query === '' || mb_strlen($query) > 200) {
            $message = $this->localizer->isEnglish()
                ? 'Missing or too long "q" parameter.'
                : 'Paramètre q manquant ou trop long.';
            return $this->json(['message' => $message], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $protocols = $this->protocolRepository->findAllPublic();
        $result = $this->searchService->search($protocols, $query);

        $this->recordSearchStat(count($result['results']) > 0);

        return $this->json([
            'query' => $query,
            'results' => $this->serializer->serializeMany(array_column($result['results'], 'protocol')),
            'suggestions' => $result['suggestions'],
        ]);
    }

    #[Route('/api/public/first-aid-protocols/{slug}', name: 'api_public_first_aid_protocol_detail', methods: ['GET'])]
    public function detail(string $slug, Request $request): JsonResponse
    {
        if ($this->rejected($request)) {
            return $this->json(['message' => $this->rateLimitMessage()], Response::HTTP_TOO_MANY_REQUESTS);
        }

        $protocol = $this->protocolRepository->findPublicOneBySlug($slug);
        if ($protocol === null) {
            return $this->json(
                ['message' => 'Ce protocole est indisponible ou a ete retire.'],
                Response::HTTP_NOT_FOUND
            );
        }

        // Journal anonyme des versions consultées (aucune donnée identifiable).
        $this->entityManager->persist(new ProtocoleConsultation($protocol->getSlug(), $protocol->getVersion()));
        $this->entityManager->flush();

        return $this->json($this->serializer->serialize($protocol));
    }

    private function recordSearchStat(bool $hasResult): void
    {
        $today = new \DateTimeImmutable();
        $repository = $this->entityManager->getRepository(ProtocoleRechercheStat::class);
        $stat = $repository->findOneBy(['statDate' => $today->setTime(0, 0)]);

        if ($stat === null) {
            $stat = new ProtocoleRechercheStat($today);
            $this->entityManager->persist($stat);
        }

        $stat->record($hasResult);
        $this->entityManager->flush();
    }

    private function rateLimitMessage(): string
    {
        return $this->localizer->isEnglish()
            ? 'Too many requests. Please try again in a few moments.'
            : 'Trop de demandes. Réessayez dans quelques instants.';
    }

    private function rejected(Request $request): bool
    {
        $limiter = $this->publicApiLimiter->create((string) $request->getClientIp());

        return !$limiter->consume()->isAccepted();
    }
}
