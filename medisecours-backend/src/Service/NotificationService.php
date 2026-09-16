<?php

declare(strict_types=1);

namespace App\Service;

use App\Entity\Notification;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;

final class NotificationService
{
    public function __construct(private readonly EntityManagerInterface $entityManager)
    {
    }

    public function create(User $recipient, string $type, string $title, ?string $body = null, ?string $link = null): void
    {
        $notification = (new Notification())
            ->setRecipient($recipient)
            ->setType($type)
            ->setTitle($title)
            ->setBody($body)
            ->setLink($link);

        $this->entityManager->persist($notification);
    }
}
