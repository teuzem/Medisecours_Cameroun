<?php

declare(strict_types=1);

namespace App\Entity;

use App\Repository\AvisJaimeRepository;
use Doctrine\ORM\Mapping as ORM;

/**
 * Un « J'aime » posé par un utilisateur sur un avis.
 *
 * Entité technique (non exposée par API Platform) : elle n'existe que pour
 * dédupliquer les votes et compter. La contrainte d'unicité
 * (avis_id, user_id) garantit qu'un utilisateur ne peut pas aimer deux fois
 * le même avis, même en cas de double-clic ou de relectures concurrentes.
 */
#[ORM\Entity(repositoryClass: AvisJaimeRepository::class)]
#[ORM\UniqueConstraint(name: 'uniq_avis_jaime_user', columns: ['avis_id', 'user_id'])]
#[ORM\Index(name: 'idx_avis_jaime_avis', columns: ['avis_id'])]
class AvisJaime
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: AvisEtablissement::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private ?AvisEtablissement $avis = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private ?User $user = null;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    public function __construct(AvisEtablissement $avis, User $user)
    {
        $this->avis = $avis;
        $this->user = $user;
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getAvis(): ?AvisEtablissement
    {
        return $this->avis;
    }

    public function getUser(): ?User
    {
        return $this->user;
    }

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }
}