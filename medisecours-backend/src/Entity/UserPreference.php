<?php

declare(strict_types=1);

namespace App\Entity;

use App\Repository\UserPreferenceRepository;
use Doctrine\ORM\Mapping as ORM;

/**
 * Préférences de personnalisation d'un utilisateur (tableau de bord).
 *
 * Une ligne par utilisateur (id = user_id) : réglages d'affichage de l'espace
 * médecin (langue, semaine, densité, animations, notifications), persistés
 * côté serveur pour rester synchronisés entre appareils.
 *
 * Entité interne — exposée uniquement via /api/me/preferences
 * (restreinte à l'utilisateur connecté).
 */
#[ORM\Entity(repositoryClass: UserPreferenceRepository::class)]
#[ORM\Table(name: 'user_preference')]
class UserPreference
{
    #[ORM\Id]
    #[ORM\OneToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(name: 'user_id', nullable: false, onDelete: 'CASCADE')]
    private ?User $user = null;

    /**
     * Préférences validées : language, weekStart, compact, animations,
     * notifications.
     */
    #[ORM\Column(type: 'json')]
    private array $data = [];

    #[ORM\Column]
    private \DateTimeImmutable $updatedAt;

    public function __construct()
    {
        $this->updatedAt = new \DateTimeImmutable();
    }

    public function getUser(): ?User
    {
        return $this->user;
    }

    public function setUser(?User $user): static
    {
        $this->user = $user;

        return $this;
    }

    public function getData(): array
    {
        return $this->data;
    }

    public function setData(array $data): static
    {
        $this->data = $data;

        return $this;
    }

    public function getUpdatedAt(): \DateTimeImmutable
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(\DateTimeImmutable $updatedAt): static
    {
        $this->updatedAt = $updatedAt;

        return $this;
    }
}
