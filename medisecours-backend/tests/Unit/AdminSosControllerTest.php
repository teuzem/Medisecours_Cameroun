<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Controller\AdminSosController;
use App\Entity\DemandeSos;
use PHPUnit\Framework\TestCase;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use Symfony\Component\Routing\RouterInterface;

/**
 * Centre de contrôle SOS de l'administration centrale.
 *
 * Ces routes exposent l'intégralité du réseau (toutes les structures, toutes
 * les positions, toutes les interventions) : elles doivent exister, et rester
 * derrière ROLE_ADMIN — c'est la seule surface qui donne une vue nationale.
 */
final class AdminSosControllerTest extends KernelTestCase
{
    public function testLesRoutesDuCentreDeControleSontEnregistrees(): void
    {
        self::bootKernel();
        $routes = static::getContainer()->get(RouterInterface::class)->getRouteCollection();

        self::assertNotNull($routes->get('api_admin_sos_alertes'), 'fil national des alertes');
        self::assertNotNull($routes->get('api_admin_sos_stats'), 'analytiques avancées du réseau');
    }

    public function testLesRoutesNeSontPasPubliquesDansLesSecurityAccessControl(): void
    {
        self::bootKernel();
        $accessControl = static::getContainer()->getParameter('security.access_control');
        self::assertIsArray($accessControl);

        foreach (['/api/admin/sos/alertes', '/api/admin/sos/stats'] as $chemin) {
            $ouvertALAnonyme = false;
            foreach ($accessControl as $regle) {
                if (!array_key_exists('path', $regle)) {
                    continue;
                }
                $motif = '{^' . trim(str_replace('/', '\\/', $regle['path']), '^$') . '$}';
                if (preg_match($motif, $chemin) !== 1) {
                    continue;
                }
                $methodes = $regle['methods'] ?? [];
                if ($methodes !== [] && !in_array('GET', $methodes, true)) {
                    continue;
                }
                $roles = $regle['roles'] ?? ($regle['role'] ?? null);
                $roles = is_array($roles) ? $roles : [$roles];
                $ouvertALAnonyme = in_array('PUBLIC_ACCESS', array_filter($roles), true);
                break;
            }

            self::assertFalse(
                $ouvertALAnonyme,
                sprintf('%s ne doit jamais être accessible sans authentification.', $chemin),
            );
        }
    }

    public function testLesGravitesExistentPourLeTriage(): void
    {
        // Le centre de contrôle filtre par gravité : une valeur absente
        // rendrait le filtre silencieusement inopérant.
        self::assertSame(['LEGERE', 'URGENTE', 'CRITIQUE'], DemandeSos::GRAVITES);
    }

    public function testLeSeuilDeRetardEstDeclareEnClasse(): void
    {
        // 15 minutes : au-delà, une alerte non prise en charge doit remonter
        // dans la tuile « en retard » du centre de contrôle.
        $reflexion = new \ReflectionClass(AdminSosController::class);
        $constante = $reflexion->getReflectionConstant('SEUIL_RETARD_SEC');

        self::assertNotNull($constante);
        self::assertSame(900, $constante->getValue());
    }
}