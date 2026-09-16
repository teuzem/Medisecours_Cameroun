<?php

declare(strict_types=1);

namespace App\Controller\Api;

use App\Entity\User;
use App\Repository\NotificationRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/notifications')]
#[IsGranted('ROLE_USER')]
final class NotificationController extends AbstractController
{
    #[Route('', name: 'api_notifications_delete_all', methods: ['DELETE'], priority: 20)]
    public function deleteAll(NotificationRepository $notifications): JsonResponse
    {
        $user = $this->getUser();
        if (!$user instanceof User) {
            return new JsonResponse(['deletedCount' => 0], JsonResponse::HTTP_UNAUTHORIZED);
        }

        return new JsonResponse([
            'deletedCount' => $notifications->deleteAllFor($user),
            'unreadCount' => 0,
        ]);
    }

    #[Route('/unread-count', name: 'api_notifications_unread_count', methods: ['GET'], priority: 20)]
    public function unreadCount(NotificationRepository $notifications): JsonResponse
    {
        $user = $this->getUser();
        if (!$user instanceof User) {
            return new JsonResponse(['unreadCount' => 0], JsonResponse::HTTP_UNAUTHORIZED);
        }

        return new JsonResponse([
            'unreadCount' => $notifications->countUnreadFor($user),
        ]);
    }

    #[Route('/mark-all-read', name: 'api_notifications_mark_all_read', methods: ['PATCH'], priority: 20)]
    public function markAllRead(
        NotificationRepository $notifications,
        EntityManagerInterface $entityManager,
    ): JsonResponse {
        $user = $this->getUser();
        if (!$user instanceof User) {
            return new JsonResponse(['unreadCount' => 0], JsonResponse::HTTP_UNAUTHORIZED);
        }

        $unreadNotifications = $notifications->findUnreadFor($user);
        $readAt = new \DateTimeImmutable();
        foreach ($unreadNotifications as $notification) {
            $notification->setReadAt($readAt);
        }

        if ($unreadNotifications !== []) {
            $entityManager->flush();
        }

        return new JsonResponse([
            'markedCount' => count($unreadNotifications),
            'unreadCount' => 0,
        ]);
    }
}
