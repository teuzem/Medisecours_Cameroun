<?php

declare(strict_types=1);

namespace App\Controller;

use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;

/**
 * Endpoint de santé publique pour monitoring.
 *
 * Un simple `SELECT 1` ne prouve rien du schéma : la panne de production du
 * 11 octobre avait une base « joignable » pendant que chaque requête ORM
 * explosait sur des colonnes manquantes. Le health check sonde donc aussi
 * les objets de schéma que ce déploiement exige.
 *
 * Un schéma incomplet ne doit JAMAIS produire un 503 ici : Render utilise
 * cet endpoint comme healthCheckPath, et un 503 retire l'instance de la
 * pool — couplant la dispo de TOUTE l'API (login, chat, consultations) à
 * la complétude du schéma carte. La spirale du 12 octobre (schéma creux →
 * toutes les releases en 503 → « no available server ») en est l'exemple.
 * Le verrou de deploy est l'entrypoint (probe stricte avant boot) ; ici,
 * on ne 503 que si la base elle-même est injoignable, et le détail du
 * schéma reste exposé dans le corps de la réponse pour le diagnostic.
 */
class HealthController extends AbstractController
{
    /**
     * Durée de vie du cache de sondage (secondes). Render interroge ce
     * endpoint plusieurs fois par minute ; trois requêtes catalogues légères
     * valent largement la peine d'être évitées à chaque appel.
     */
    private const SCHEMA_PROBE_TTL = 30;

    private const REQUIRED_SCHEMA = [
        'user.type_personnel' => 'SELECT 1 FROM "user" WHERE type_personnel IS NULL LIMIT 0',
        'signature_numerique' => 'SELECT 1 FROM signature_numerique LIMIT 0',
        'centre_de_sante.dirigeant_id' => 'SELECT 1 FROM centre_de_sante WHERE dirigeant_id IS NULL LIMIT 0',
        'etablissement_equipe' => 'SELECT 1 FROM etablissement_equipe LIMIT 0',
        'dossier_medical' => 'SELECT 1 FROM dossier_medical LIMIT 0',
        'soin_administre' => 'SELECT 1 FROM soin_administre LIMIT 0',
        'ordonnance_pharmacie' => 'SELECT 1 FROM ordonnance_pharmacie LIMIT 0',
    ];

    /** @var array{checkedAt: float, problems: list<string>}|null */
    private static ?array $schemaCache = null;

    #[Route('/', name: 'api_root', methods: ['GET'])]
    public function index(): JsonResponse
    {
        return new JsonResponse([
            'name' => 'MediSecours API',
            'status' => 'online',
            'health' => '/api/health',
        ]);
    }

    #[Route('/api/health', name: 'api_health', methods: ['GET'])]
    public function health(EntityManagerInterface $entityManager): JsonResponse
    {
        $connection = $entityManager->getConnection();

        try {
            $connection->executeQuery('SELECT 1');
        } catch (\Throwable) {
            return new JsonResponse([
                'status' => 'degraded',
                'services' => [
                    'api' => 'ok',
                    'database' => 'error',
                    'websocket' => 'configured',
                ],
                'schema' => 'unknown',
                'problems' => ['database unreachable'],
                'timestamp' => (new \DateTimeImmutable())->format(\DateTimeInterface::ATOM),
            ], Response::HTTP_SERVICE_UNAVAILABLE);
        }

        $problems = $this->probeSchema($connection);
        $schemaOk = $problems === [];

        // Schéma incomplet => 200 "degraded" (voir docblock) : l'instance
        // reste routable, les endpoints dont le schéma est intact servent,
        // et le corps de réponse liste précisément ce qui manque.
        return new JsonResponse([
            'status' => $schemaOk ? 'ok' : 'degraded',
            'services' => [
                'api' => 'ok',
                'database' => 'ok',
                'websocket' => 'configured',
            ],
            'schema' => $schemaOk ? 'ok' : 'missing',
            'problems' => $problems,
            'timestamp' => (new \DateTimeImmutable())->format(\DateTimeInterface::ATOM),
        ], Response::HTTP_OK);
    }

    /**
     * Vérifie la présence des objets de schéma requis par cette release.
     *
     * @return list<string> libellés des objets manquants (vide = tout est là)
     */
    private function probeSchema(\Doctrine\DBAL\Connection $connection): array
    {
        $now = microtime(true);
        if (
            self::$schemaCache !== null
            && ($now - self::$schemaCache['checkedAt']) < self::SCHEMA_PROBE_TTL
        ) {
            return self::$schemaCache['problems'];
        }

        $problems = [];
        foreach (self::REQUIRED_SCHEMA as $label => $sql) {
            try {
                $connection->executeQuery($sql);
            } catch (\Throwable) {
                $problems[] = $label;
            }
        }

        self::$schemaCache = ['checkedAt' => $now, 'problems' => $problems];

        return $problems;
    }
}
