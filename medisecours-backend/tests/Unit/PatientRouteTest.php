<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use Symfony\Component\Routing\RouterInterface;

final class PatientRouteTest extends KernelTestCase
{
    public function testPatientCollectionUsesTheScopedController(): void
    {
        self::bootKernel();

        $router = self::getContainer()->get(RouterInterface::class);
        $parameters = $router->match('/api/patients');

        self::assertSame('app_patient_index', $parameters['_route']);
        self::assertSame(
            'App\Controller\PatientController::index',
            $parameters['_controller']
        );
    }
}
