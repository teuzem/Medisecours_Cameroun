<?php

declare(strict_types=1);

namespace App\Entity;

use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Delete;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Patch;
use ApiPlatform\Metadata\Post;
use App\Repository\MaladieSymptomeRepository;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Annotation\Groups;
use Symfony\Component\Validator\Constraints as Assert;

#[ORM\Entity(repositoryClass: MaladieSymptomeRepository::class)]
#[ORM\UniqueConstraint(name: 'uniq_maladie_symptome_pair', columns: ['maladie_id', 'symptome_id'])]
#[ApiResource(
    operations: [
        new GetCollection(security: "is_granted('ROLE_ADMIN')"),
        new Get(security: "is_granted('ROLE_ADMIN')"),
        new Post(security: "is_granted('ROLE_ADMIN')"),
        new Patch(security: "is_granted('ROLE_ADMIN')"),
        new Delete(security: "is_granted('ROLE_ADMIN')")
    ],
    normalizationContext: ['groups' => ['maladie_symptome:read']],
    denormalizationContext: ['groups' => ['maladie_symptome:write']],
)]
class MaladieSymptome
{
    public const FREQUENCE_TRES_FREQUENT = 'TRES_FREQUENT';
    public const FREQUENCE_FREQUENT = 'FREQUENT';
    public const FREQUENCE_OCCASIONNEL = 'OCCASIONNEL';
    public const FREQUENCE_RARE = 'RARE';

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['maladie_symptome:read', 'maladie:read'])]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: Maladie::class, inversedBy: 'symptomesStructures')]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    #[Groups(['maladie_symptome:read', 'maladie_symptome:write'])]
    private ?Maladie $maladie = null;

    #[ORM\ManyToOne(targetEntity: Symptome::class, inversedBy: 'maladieSymptomes')]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    #[Groups(['maladie_symptome:read', 'maladie_symptome:write', 'maladie:read'])]
    private ?Symptome $symptome = null;

    #[ORM\Column]
    #[Assert\Range(min: 1, max: 10)]
    #[Groups(['maladie_symptome:read', 'maladie_symptome:write', 'maladie:read'])]
    private int $poids = 3;

    #[ORM\Column(length: 40, nullable: true)]
    #[Groups(['maladie_symptome:read', 'maladie_symptome:write', 'maladie:read'])]
    private ?string $frequence = self::FREQUENCE_FREQUENT;

    #[ORM\Column]
    #[Groups(['maladie_symptome:read', 'maladie_symptome:write', 'maladie:read'])]
    private bool $obligatoire = false;

    #[ORM\Column]
    #[Groups(['maladie_symptome:read', 'maladie_symptome:write', 'maladie:read'])]
    private bool $contradictoire = false;

    #[ORM\Column(length: 40, nullable: true)]
    #[Groups(['maladie_symptome:read', 'maladie_symptome:write', 'maladie:read'])]
    private ?string $gravite = null;

    public function getId(): ?int { return $this->id; }
    public function getMaladie(): ?Maladie { return $this->maladie; }
    public function setMaladie(?Maladie $maladie): static { $this->maladie = $maladie; return $this; }
    public function getSymptome(): ?Symptome { return $this->symptome; }
    public function setSymptome(?Symptome $symptome): static { $this->symptome = $symptome; return $this; }
    public function getPoids(): int { return $this->poids; }
    public function setPoids(int $poids): static { $this->poids = $poids; return $this; }
    public function getFrequence(): ?string { return $this->frequence; }
    public function setFrequence(?string $frequence): static { $this->frequence = $frequence; return $this; }
    public function isObligatoire(): bool { return $this->obligatoire; }
    public function setObligatoire(bool $obligatoire): static { $this->obligatoire = $obligatoire; return $this; }
    public function isContradictoire(): bool { return $this->contradictoire; }
    public function setContradictoire(bool $contradictoire): static { $this->contradictoire = $contradictoire; return $this; }
    public function getGravite(): ?string { return $this->gravite; }
    public function setGravite(?string $gravite): static { $this->gravite = $gravite; return $this; }
}