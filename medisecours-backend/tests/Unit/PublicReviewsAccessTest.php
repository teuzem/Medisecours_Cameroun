<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\RouterInterface;

/**
 * Les fiches établissements affichent leurs avis sans authentification.
 * Une régression ici est invisible : l'API répond 401, le frontend affiche
 * « Impossible de charger les avis » alors que la note moyenne reste visible.
 */
final class PublicReviewsAccessTest extends KernelTestCase
{
    private const REVIEW_PATH = '/api/etablissements/42/avis';

    public function testReviewsRouteIsRegistered(): void
    {
        self::bootKernel();
        $routes = static::getContainer()->get(RouterInterface::class)->getRouteCollection();

        self::assertNotNull($routes->get('api_etablissement_avis_liste'));
    }

    public function testAnonymousVisitorsCanReadPublishedReviews(): void
    {
        self::bootKernel();
        $request = Request::create(self::REVIEW_PATH, 'GET');

        self::assertTrue(
            $this->isPubliclyAccessible($request),
            'GET ' . self::REVIEW_PATH . ' doit être PUBLIC_ACCESS (sinon 401 pour les visiteurs anonymes).',
        );
    }

    public function testReviewsRouteStaysReadOnlyForAnonymousVisitors(): void
    {
        self::bootKernel();
        $post = Request::create(self::REVIEW_PATH, 'POST');

        self::assertFalse(
            $this->isPubliclyAccessible($post),
            'La publication d\'un avis ne doit pas être ouverte aux anonymes.',
        );
    }

    /**
     * Reproduit la règle Symfony « la première règle qui correspond est appliquée ».
     */
    private function isPubliclyAccessible(Request $request): bool
    {
        $accessControl = static::getContainer()->getParameter('security.access_control');
        self::assertIsArray($accessControl);

        foreach ($accessControl as $rule) {
            if (!array_key_exists('path', $rule)) {
                continue;
            }
            if (preg_match('{^' . trim(str_replace('/', '\\/', $rule['path']), '^$') . '$}', $request->getPathInfo()) !== 1) {
                continue;
            }

            $methods = $rule['methods'] ?? [];
            if ($methods !== [] && !in_array($request->getMethod(), $methods, true)) {
                continue;
            }

            $roles = $rule['roles'] ?? ($rule['role'] ?? null);
            $roles = is_array($roles) ? $roles : [$roles];

            return in_array('PUBLIC_ACCESS', array_filter($roles), true);
        }

        return false;
    }
}