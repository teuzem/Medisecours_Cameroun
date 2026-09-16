<?php

declare(strict_types=1);

namespace App\MessageHandler;

use App\Message\WebSocketNotification;
use App\Entity\Message;
use App\Service\WebSocketNotifier;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Messenger\Attribute\AsMessageHandler;

#[AsMessageHandler]
final class WebSocketNotificationHandler
{
    public function __construct(
        private readonly WebSocketNotifier $wsNotifier,
        private readonly EntityManagerInterface $entityManager,
    ) {
    }

    public function __invoke(WebSocketNotification $message): void
    {
        if ($message->isBroadcast()) {
            $this->wsNotifier->broadcast([
                'event' => $message->getEvent(),
                'payload' => $message->getPayload(),
            ]);
        } else {
            $sent = $this->wsNotifier->notifyConversation(
                (string) ($message->getPayload()['conversationId'] ?? ''),
                $message->getEvent(),
                $message->getPayload(),
                $message->getTargetUserIds(),
            );

            if ($message->getEvent() === 'new_message' && $sent > 0) {
                $messageId = $message->getPayload()['id'] ?? null;
                $entity = $messageId ? $this->entityManager->getRepository(Message::class)->find($messageId) : null;
                if ($entity instanceof Message && $entity->getStatut() === Message::STATUT_ENVOYE) {
                    $entity->setStatut(Message::STATUT_LIVRE);
                    $this->entityManager->flush();

                    $senderId = $entity->getExpediteur()?->getId();
                    if ($senderId !== null) {
                        $this->wsNotifier->notifyConversation(
                            (string) ($message->getPayload()['conversationId'] ?? ''),
                            'message_delivered',
                            [
                                'id' => $entity->getId(),
                                'messageId' => $entity->getId(),
                                'conversationId' => (string) ($message->getPayload()['conversationId'] ?? ''),
                                'statut' => Message::STATUT_LIVRE,
                            ],
                            [(string) $senderId],
                        );
                    }
                }
            }
        }
    }
}
