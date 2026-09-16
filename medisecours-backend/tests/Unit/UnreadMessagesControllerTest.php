<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Controller\Api\UnreadMessagesController;
use App\Entity\Conversation;
use App\Entity\Notification;
use App\Entity\Patient;
use App\Repository\MessageRepository;
use App\Repository\NotificationRepository;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\TestCase;
use Symfony\Component\DependencyInjection\Container;
use Symfony\Component\Messenger\MessageBusInterface;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorageInterface;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;

final class UnreadMessagesControllerTest extends TestCase
{
    public function testReadingConversationAlsoReadsItsMessageNotifications(): void
    {
        $user = (new Patient())->setEmail('patient@example.test');
        $conversation = (new Conversation())->addParticipant($user);
        $id = new \ReflectionProperty(Conversation::class, 'id');
        $id->setValue($conversation, 42);

        $notification = (new Notification())
            ->setRecipient($user)
            ->setType('message_received')
            ->setTitle('Message de Docteur Test')
            ->setLink('/patient/messages?conversation=42');

        $messages = $this->createMock(MessageRepository::class);
        $messages
            ->expects(self::once())
            ->method('findUnreadReceivedByInConversation')
            ->with($user, $conversation)
            ->willReturn([]);

        $notifications = $this->createMock(NotificationRepository::class);
        $notifications
            ->expects(self::once())
            ->method('findUnreadMessageNotificationsForConversation')
            ->with($user, $conversation)
            ->willReturn([$notification]);

        $entityManager = $this->createMock(EntityManagerInterface::class);
        $entityManager->expects(self::once())->method('flush');
        $messageBus = $this->createMock(MessageBusInterface::class);
        $messageBus->expects(self::never())->method('dispatch');

        $response = $this->controllerFor($user)->markConversationRead(
            $conversation,
            $messages,
            $notifications,
            $entityManager,
            $messageBus,
        );
        $payload = json_decode((string) $response->getContent(), true);

        self::assertSame(200, $response->getStatusCode());
        self::assertSame('42', $payload['conversationId']);
        self::assertSame(0, $payload['markedCount']);
        self::assertSame(1, $payload['notificationMarkedCount']);
        self::assertNotNull($notification->getReadAt());
    }

    private function controllerFor(Patient $user): UnreadMessagesController
    {
        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn($user);

        $tokenStorage = $this->createMock(TokenStorageInterface::class);
        $tokenStorage->method('getToken')->willReturn($token);

        $container = new Container();
        $container->set('security.token_storage', $tokenStorage);

        $controller = new UnreadMessagesController();
        $controller->setContainer($container);

        return $controller;
    }
}
