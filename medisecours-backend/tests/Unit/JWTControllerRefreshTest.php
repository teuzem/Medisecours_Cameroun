<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Controller\JWTController;
use App\Service\SessionService;
use App\Service\UserSerializer;
use Doctrine\ORM\EntityManagerInterface;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;

final class JWTControllerRefreshTest extends TestCase
{
    public function testRefreshWithoutSessionCookieIsAnAnonymousNoOp(): void
    {
        $entityManager = $this->createMock(EntityManagerInterface::class);
        $entityManager->expects(self::never())->method('getRepository');
        $entityManager->expects(self::never())->method('flush');

        $controller = new JWTController(new UserSerializer());
        $response = $controller->refresh(
            new Request(),
            $this->createMock(JWTTokenManagerInterface::class),
            $entityManager,
            new SessionService($entityManager, 'test')
        );

        self::assertSame(Response::HTTP_NO_CONTENT, $response->getStatusCode());
        self::assertCount(2, $response->headers->getCookies());
    }
}
