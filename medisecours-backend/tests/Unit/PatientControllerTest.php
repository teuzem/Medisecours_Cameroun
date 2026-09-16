<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Controller\PatientController;
use App\Entity\Medecin;
use App\Entity\Patient;
use App\Repository\UserRepository;
use App\Service\UserSerializer;
use PHPUnit\Framework\TestCase;
use Symfony\Component\DependencyInjection\Container;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Security\Core\Authorization\AuthorizationCheckerInterface;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorageInterface;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Exception\AccessDeniedException;
use Symfony\Component\Security\Core\User\UserInterface;

final class PatientControllerTest extends TestCase
{
    public function testDoctorOnlyReceivesPatientsLinkedToTheirConsultations(): void
    {
        $medecin = (new Medecin())->setEmail('medecin@example.test');
        $patient = (new Patient())
            ->setEmail('patient@example.test')
            ->setNom('Kamga')
            ->setPrenom('Alice');

        $repository = $this->createMock(UserRepository::class);
        $repository
            ->expects(self::once())
            ->method('findActivePatientsForMedecin')
            ->with($medecin, 'Kamga')
            ->willReturn([$patient]);

        $controller = new PatientController();
        $controller->setContainer($this->createSecurityContainer($medecin));

        $response = $controller->index(
            new Request(query: ['search' => 'Kamga']),
            $repository,
            new UserSerializer()
        );
        $payload = json_decode((string) $response->getContent(), true, 512, JSON_THROW_ON_ERROR);

        self::assertSame(200, $response->getStatusCode());
        self::assertCount(1, $payload);
        self::assertSame('patient@example.test', $payload[0]['email']);
    }

    public function testNonDoctorUserIsRejectedEvenIfRoleCheckIsMisconfigured(): void
    {
        $patient = (new Patient())->setEmail('patient@example.test');
        $repository = $this->createMock(UserRepository::class);
        $repository->expects(self::never())->method('findActivePatientsForMedecin');

        $controller = new PatientController();
        $controller->setContainer($this->createSecurityContainer($patient));

        $this->expectException(AccessDeniedException::class);
        $controller->index(new Request(), $repository, new UserSerializer());
    }

    private function createSecurityContainer(UserInterface $user): Container
    {
        $authorizationChecker = $this->createMock(AuthorizationCheckerInterface::class);
        $authorizationChecker
            ->method('isGranted')
            ->with('ROLE_MEDECIN', null)
            ->willReturn(true);

        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn($user);

        $tokenStorage = $this->createMock(TokenStorageInterface::class);
        $tokenStorage->method('getToken')->willReturn($token);

        $container = new Container();
        $container->set('security.authorization_checker', $authorizationChecker);
        $container->set('security.token_storage', $tokenStorage);

        return $container;
    }
}
