<?php

namespace App\Controller\Api;

use App\Entity\Message;
use App\Entity\Conversation;
use App\Entity\User;
use App\Message\WebSocketNotification;
use App\Repository\MessageRepository;
use App\Repository\NotificationRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;
use Symfony\Component\Messenger\MessageBusInterface;

#[Route('/api')]
class UnreadMessagesController extends AbstractController
{
    #[Route('/messages/unread-count', name: 'api_messages_unread_count', methods: ['GET'], priority: 10)]
    #[IsGranted('ROLE_USER')]
    public function getUnreadCount(EntityManagerInterface $em): JsonResponse
    {
        $user = $this->getUser();
        if (!$user) {
            return new JsonResponse(['unreadCount' => 0]);
        }

        $qb = $em->createQueryBuilder();
        $qb->select('COUNT(m.id)')
           ->from(Message::class, 'm')
           ->join('m.conversation', 'c')
           ->join('c.participants', 'p')
           ->where('p = :user')
           ->andWhere('m.expediteur != :user')
           ->andWhere('m.statut != :statut_lu')
           ->setParameter('user', $user)
           ->setParameter('statut_lu', Message::STATUT_LU);

        $count = (int) $qb->getQuery()->getSingleScalarResult();

        return new JsonResponse(['unreadCount' => $count]);
    }

    #[Route('/messages/mark-all-read', name: 'api_messages_mark_all_read', methods: ['PATCH'], priority: 20)]
    #[IsGranted('ROLE_USER')]
    public function markAllRead(
        MessageRepository $messages,
        EntityManagerInterface $em,
        MessageBusInterface $messageBus,
    ): JsonResponse
    {
        $user = $this->getUser();
        if (!$user instanceof User) {
            return new JsonResponse(['error' => 'Utilisateur non authentifié.'], JsonResponse::HTTP_UNAUTHORIZED);
        }

        $unreadMessages = $messages->findUnreadReceivedBy($user);
        foreach ($unreadMessages as $message) {
            $message->setStatut(Message::STATUT_LU);
        }

        if ($unreadMessages !== []) {
            $em->flush();
            $this->publishReadReceipts($unreadMessages, $user, $messageBus);
        }

        return new JsonResponse([
            'markedCount' => count($unreadMessages),
            'unreadCount' => 0,
        ]);
    }

    #[Route('/conversations/{id}/read', name: 'api_conversation_mark_read', methods: ['PATCH'], priority: 20)]
    #[IsGranted('ROLE_USER')]
    public function markConversationRead(
        Conversation $conversation,
        MessageRepository $messages,
        NotificationRepository $notifications,
        EntityManagerInterface $em,
        MessageBusInterface $messageBus,
    ): JsonResponse {
        $user = $this->getUser();
        if (!$user instanceof User || !$conversation->getParticipants()->contains($user)) {
            throw $this->createAccessDeniedException('Vous ne participez pas à cette conversation.');
        }

        $unreadMessages = $messages->findUnreadReceivedByInConversation($user, $conversation);
        foreach ($unreadMessages as $message) {
            $message->setStatut(Message::STATUT_LU);
        }

        $unreadNotifications = $notifications->findUnreadMessageNotificationsForConversation(
            $user,
            $conversation,
        );
        $readAt = new \DateTimeImmutable();
        foreach ($unreadNotifications as $notification) {
            $notification->setReadAt($readAt);
        }

        if ($unreadMessages !== [] || $unreadNotifications !== []) {
            $em->flush();
        }
        if ($unreadMessages !== []) {
            $this->publishReadReceipts($unreadMessages, $user, $messageBus);
        }

        return new JsonResponse([
            'conversationId' => (string) $conversation->getId(),
            'markedCount' => count($unreadMessages),
            'notificationMarkedCount' => count($unreadNotifications),
        ]);
    }

    #[Route('/messages/{id}/read', name: 'api_message_mark_read', methods: ['PATCH'], priority: 20)]
    #[IsGranted('ROLE_USER')]
    public function markMessageRead(
        Message $message,
        EntityManagerInterface $em,
        MessageBusInterface $messageBus,
    ): JsonResponse {
        $user = $this->getUser();
        $conversation = $message->getConversation();
        if (
            !$user instanceof User
            || !$conversation?->getParticipants()->contains($user)
            || $message->getExpediteur() === $user
        ) {
            throw $this->createAccessDeniedException('Vous ne pouvez pas marquer ce message comme lu.');
        }

        if ($message->getStatut() !== Message::STATUT_LU) {
            $message->setStatut(Message::STATUT_LU);
            $em->flush();
            $this->publishReadReceipts([$message], $user, $messageBus);
        }

        return new JsonResponse([
            'messageId' => $message->getId(),
            'statut' => Message::STATUT_LU,
        ]);
    }

    /**
     * @param Message[] $messages
     */
    private function publishReadReceipts(array $messages, User $reader, MessageBusInterface $messageBus): void
    {
        foreach ($messages as $message) {
            $conversation = $message->getConversation();
            $sender = $message->getExpediteur();
            if (!$conversation instanceof Conversation || !$sender instanceof User) {
                continue;
            }

            $messageBus->dispatch(new WebSocketNotification(
                event: 'message_read',
                payload: [
                    'id' => $message->getId(),
                    'messageId' => $message->getId(),
                    'conversation' => '/api/conversations/' . $conversation->getId(),
                    'conversationId' => (string) $conversation->getId(),
                    'readerId' => (string) $reader->getId(),
                    'statut' => Message::STATUT_LU,
                ],
                targetUserIds: [(string) $sender->getId()],
            ));
        }
    }
}
