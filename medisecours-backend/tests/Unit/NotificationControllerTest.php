<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Controller\Api\NotificationController;
use App\Entity\Notification;
use App\Entity\Patient;
use App\Repository\NotificationRepository;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\TestCase;
use Symfony\Component\DependencyInjection\Container;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorageInterface;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;

final class NotificationControllerTest extends TestCase
{
    public function testUnreadCountIsScopedToAuthenticatedUser(): void
    {
        $user = (new Patient())->setEmail('patient@example.test');
        $repository = $this->createMock(NotificationRepository::class);
        $repository
            ->expects(self::once())
            ->method('countUnreadFor')
            ->with($user)
            ->willReturn(3);

        $response = $this->controllerFor($user)->unreadCount($repository);

        self::assertSame(200, $response->getStatusCode());
        self::assertSame(['unreadCount' => 3], json_decode((string) $response->getContent(), true));
    }

    public function testMarkAllReadOnlyUsesAuthenticatedUsersNotifications(): void
    {
        $user = (new Patient())->setEmail('patient@example.test');
        $first = (new Notification())
            ->setRecipient($user)
            ->setType('message_received')
            ->setTitle('Premier message');
        $second = (new Notification())
            ->setRecipient($user)
            ->setType('consultation_accepted')
            ->setTitle('Consultation acceptee');

        $repository = $this->createMock(NotificationRepository::class);
        $repository
            ->expects(self::once())
            ->method('findUnreadFor')
            ->with($user)
            ->willReturn([$first, $second]);

        $entityManager = $this->createMock(EntityManagerInterface::class);
        $entityManager->expects(self::once())->method('flush');

        $response = $this->controllerFor($user)->markAllRead($repository, $entityManager);
        $payload = json_decode((string) $response->getContent(), true);

        self::assertSame(200, $response->getStatusCode());
        self::assertSame(2, $payload['markedCount']);
        self::assertSame(0, $payload['unreadCount']);
        self::assertNotNull($first->getReadAt());
        self::assertNotNull($second->getReadAt());
    }

    public function testDeleteAllOnlyDeletesAuthenticatedUsersNotifications(): void
    {
        $user = (new Patient())->setEmail('patient@example.test');
        $repository = $this->createMock(NotificationRepository::class);
        $repository
            ->expects(self::once())
            ->method('deleteAllFor')
            ->with($user)
            ->willReturn(7);

        $response = $this->controllerFor($user)->deleteAll($repository);

        self::assertSame(200, $response->getStatusCode());
        self::assertSame(
            ['deletedCount' => 7, 'unreadCount' => 0],
            json_decode((string) $response->getContent(), true),
        );
    }

    private function controllerFor(Patient $user): NotificationController
    {
        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn($user);

        $tokenStorage = $this->createMock(TokenStorageInterface::class);
        $tokenStorage->method('getToken')->willReturn($token);

        $container = new Container();
        $container->set('security.token_storage', $tokenStorage);

        $controller = new NotificationController();
        $controller->setContainer($container);

        return $controller;
    }
}
