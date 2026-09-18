<?php

declare(strict_types=1);

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
#[ORM\Table(name: 'carte_saved_place')]
#[ORM\UniqueConstraint(name: 'uniq_carte_saved_place_owner_centre', columns: ['user_id', 'centre_id'])]
class CarteSavedPlace
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private ?User $user = null;

    #[ORM\ManyToOne(targetEntity: CentreDeSante::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private ?CentreDeSante $centre = null;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getId(): ?int { return $this->id; }
    public function getUser(): ?User { return $this->user; }
    public function setUser(?User $user): static { $this->user = $user; return $this; }
    public function getCentre(): ?CentreDeSante { return $this->centre; }
    public function setCentre(?CentreDeSante $centre): static { $this->centre = $centre; return $this; }
    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }
}
