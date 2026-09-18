<?php

declare(strict_types=1);

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
#[ORM\Table(name: 'carte_history')]
class CarteHistory
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private ?User $user = null;

    #[ORM\Column(length: 20)]
    private string $type = 'search';

    #[ORM\Column(length: 255, nullable: true)]
    private ?string $query = null;

    #[ORM\ManyToOne(targetEntity: CentreDeSante::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?CentreDeSante $centre = null;

    #[ORM\Column(type: 'json')]
    private array $metadata = [];

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getId(): ?int { return $this->id; }
    public function getUser(): ?User { return $this->user; }
    public function setUser(?User $user): static { $this->user = $user; return $this; }
    public function getType(): string { return $this->type; }
    public function setType(string $type): static { $this->type = $type; return $this; }
    public function getQuery(): ?string { return $this->query; }
    public function setQuery(?string $query): static { $this->query = $query; return $this; }
    public function getCentre(): ?CentreDeSante { return $this->centre; }
    public function setCentre(?CentreDeSante $centre): static { $this->centre = $centre; return $this; }
    public function getMetadata(): array { return $this->metadata; }
    public function setMetadata(array $metadata): static { $this->metadata = $metadata; return $this; }
    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }
}
