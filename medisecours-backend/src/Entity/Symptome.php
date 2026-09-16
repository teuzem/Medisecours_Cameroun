<?php

declare(strict_types=1);

namespace App\Entity;

use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Delete;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Patch;
use ApiPlatform\Metadata\Post;
use App\Repository\SymptomeRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Annotation\Groups;
use Symfony\Component\Validator\Constraints as Assert;

#[ORM\Entity(repositoryClass: SymptomeRepository::class)]
#[ORM\UniqueConstraint(name: 'uniq_symptome_slug', columns: ['slug'])]
#[ApiResource(
    operations: [
        new GetCollection(),
        new Get(),
        new Post(security: "is_granted('ROLE_ADMIN')"),
        new Patch(security: "is_granted('ROLE_ADMIN')"),
        new Delete(security: "is_granted('ROLE_ADMIN')")
    ],
    normalizationContext: ['groups' => ['symptome:read']],
    denormalizationContext: ['groups' => ['symptome:write']],
    paginationEnabled: false
)]
class Symptome
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['symptome:read', 'maladie:read'])]
    private ?int $id = null;

    #[ORM\Column(length: 160)]
    #[Assert\NotBlank]
    #[Groups(['symptome:read', 'symptome:write', 'maladie:read'])]
    private ?string $nom = null;

    #[ORM\Column(length: 180)]
    #[Groups(['symptome:read', 'symptome:write'])]
    private ?string $slug = null;

    #[ORM\Column(type: Types::JSON, nullable: true)]
    #[Groups(['symptome:read', 'symptome:write'])]
    private ?array $synonymes = [];

    #[ORM\Column(nullable: true)]
    #[Groups(['symptome:read', 'symptome:write'])]
    private ?int $ordre = 0;

    #[ORM\Column]
    #[Groups(['symptome:read'])]
    private ?\DateTimeImmutable $createdAt = null;

    /** @var Collection<int, MaladieSymptome> */
    #[ORM\OneToMany(targetEntity: MaladieSymptome::class, mappedBy: 'symptome', cascade: ['remove'])]
    private Collection $maladieSymptomes;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable();
        $this->maladieSymptomes = new ArrayCollection();
    }

    public function getId(): ?int { return $this->id; }
    public function getNom(): ?string { return $this->nom; }
    public function setNom(string $nom): static { $this->nom = $nom; return $this; }
    public function getSlug(): ?string { return $this->slug; }
    public function setSlug(string $slug): static { $this->slug = $slug; return $this; }
    public function getSynonymes(): array { return $this->synonymes ?? []; }
    public function setSynonymes(?array $synonymes): static { $this->synonymes = $synonymes ?? []; return $this; }
    public function getOrdre(): ?int { return $this->ordre; }
    public function setOrdre(?int $ordre): static { $this->ordre = $ordre; return $this; }
    public function getCreatedAt(): ?\DateTimeImmutable { return $this->createdAt; }
    public function setCreatedAt(\DateTimeImmutable $createdAt): static { $this->createdAt = $createdAt; return $this; }
    /** @return Collection<int, MaladieSymptome> */
    public function getMaladieSymptomes(): Collection { return $this->maladieSymptomes; }
}