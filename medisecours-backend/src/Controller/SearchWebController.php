<?php

declare(strict_types=1);

namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Contracts\HttpClient\HttpClientInterface;

final class SearchWebController extends AbstractController
{
    public function __construct(
        private readonly HttpClientInterface $httpClient
    ) {
    }

    #[Route('/api/search-external', name: 'api_search_external', methods: ['GET'])]
    public function __invoke(Request $request): JsonResponse
    {
        $query = trim((string) $request->query->get('query', ''));

        if (mb_strlen($query) < 3) {
            return $this->json([
                'error' => 'Le parametre query doit contenir au moins 3 caracteres.',
            ], JsonResponse::HTTP_BAD_REQUEST);
        }

        $query = mb_substr($query, 0, 120);

        try {
            $response = $this->httpClient->request('GET', 'https://fr.wikipedia.org/w/api.php', [
                'headers' => [
                    'Accept' => 'application/json',
                    'User-Agent' => 'MediSecours/1.0 (medical information search)',
                ],
                'query' => [
                    'action' => 'query',
                    'list' => 'search',
                    'srsearch' => sprintf('%s maladie symptomes sante', $query),
                    'srlimit' => 3,
                    'format' => 'json',
                    'utf8' => 1,
                ],
                'timeout' => 4,
            ]);

            $payload = $response->toArray(false);
            $items = $payload['query']['search'] ?? [];

            $results = array_map(static function (array $item): array {
                $title = (string) ($item['title'] ?? '');
                $articleSlug = str_replace('%2F', '/', rawurlencode(str_replace(' ', '_', $title)));

                return [
                    'id' => (int) ($item['pageid'] ?? 0),
                    'title' => $title,
                    'snippet' => html_entity_decode(strip_tags((string) ($item['snippet'] ?? '')), ENT_QUOTES | ENT_HTML5, 'UTF-8'),
                    'url' => 'https://fr.wikipedia.org/wiki/' . $articleSlug,
                    'source' => 'Wikipedia',
                ];
            }, array_slice($items, 0, 3));

            return $this->json($results);
        } catch (\Throwable) {
            return $this->json([
                'error' => 'Recherche externe temporairement indisponible.',
            ], JsonResponse::HTTP_SERVICE_UNAVAILABLE);
        }
    }
}