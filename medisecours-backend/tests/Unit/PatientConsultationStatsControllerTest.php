<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Controller\Api\PatientConsultationStatsController;
use App\Entity\Patient;
use App\Repository\ConsultationRepository;
use PHPUnit\Framework\TestCase;
use Symfony\Component\DependencyInjection\Container;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorageInterface;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;

final class PatientConsultationStatsControllerTest extends TestCase
{
    public function testStatsAreScopedToAuthenticatedPatient(): void
    {
        $patient = (new Patient())->setEmail('patient@example.test');
        $expected = [
            'total' => 12,
            'pending' => 2,
            'inProgress' => 3,
            'finished' => 6,
            'cancelled' => 1,
        ];

        $consultations = $this->createMock(ConsultationRepository::class);
        $consultations
            ->expects(self::once())
            ->method('countByStatusForPatient')
            ->with($patient)
            ->willReturn($expected);

        $response = ($this->controllerFor($patient))($consultations);

        self::assertSame(200, $response->getStatusCode());
        self::assertSame($expected, json_decode((string) $response->getContent(), true));
    }

    private function controllerFor(Patient $patient): PatientConsultationStatsController
    {
        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn($patient);

        $tokenStorage = $this->createMock(TokenStorageInterface::class);
        $tokenStorage->method('getToken')->willReturn($token);

        $container = new Container();
        $container->set('security.token_storage', $tokenStorage);

        $controller = new PatientConsultationStatsController();
        $controller->setContainer($container);

        return $controller;
    }
}
