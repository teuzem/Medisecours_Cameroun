<?php

declare(strict_types=1);

namespace App\Entity;

use ApiPlatform\Doctrine\Orm\Filter\SearchFilter;
use ApiPlatform\Doctrine\Orm\Filter\OrderFilter;
use ApiPlatform\Metadata\ApiFilter;
use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Patch;
use ApiPlatform\Metadata\Post;
use App\Repository\SuggestionEtablissementRepository;
use App\State\SuggestionEtablissementProcessor;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Annotation\Groups;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * Suggestion de correction / enrichissement d'un établissement de santé
 * soumise par un utilisateur (horaires, téléphone, services, adresse…).
 *
 * Les managers de l'établissement (ou un admin) peuvent ensuite appliquer
 * la proposition (statut APPROUVEE) ou la refuser (statut REFUSEE).
 */
#[ORM\Entity(repositoryClass: SuggestionEtablissementRepository::class)]
#[ApiFilter(SearchFilter::class, properties: [
    'etablissement' => 'exact',
    'statut' => 'exact',
    'champ' => 'exact',
])]
#[ApiFilter(OrderFilter::class, properties: ['createdAt' => 'DESC'])]
#[ApiResource(
    operations: [
        new GetCollection(
            security: "is_granted('ROLE_ADMIN')",
            normalizationContext: ['groups' => ['suggestion_etablissement:read']],
            paginationEnabled: false
        ),
        new Get(normalizationContext: ['groups' => ['suggestion_etablissement:read']]),
        new Post(
            security: "is_granted('ROLE_USER')",
            processor: SuggestionEtablissementProcessor::class,
            normalizationContext: ['groups' => ['suggestion_etablissement:read']]
        ),
        new Patch(
            security: "is_granted('ROLE_ADMIN') or object.getUser() == user",
            normalizationContext: ['groups' => ['suggestion_etablissement:read']]
        )
    ],
    normalizationContext: ['groups' => ['suggestion_etablissement:read']],
    denormalizationContext: ['groups' => ['suggestion_etablissement:write']],
    cacheHeaders: ['max_age' => 60]
)]
class SuggestionEtablissement
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['suggestion_etablissement:read'])]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: CentreDeSante::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    #[Groups(['suggestion_etablissement:read', 'suggestion_etablissement:write'])]
    private ?CentreDeSante $etablissement = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    #[Groups(['suggestion_etablissement:read'])]
    private ?User $user = null;

    /**
     * Champ concerné : telephone, horaires, adresse, siteWeb, services, description…
     */
    #[ORM\Column(length: 100)]
    #[Assert\NotBlank(message: 'Le champ concerné est obligatoire')]
    #[Groups(['suggestion_etablissement:read', 'suggestion_etablissement:write'])]
    private ?string $champ = null;

    #[ORM\Column(type: 'text')]
    #[Assert\NotBlank(message: 'La valeur proposée est obligatoire')]
    #[Groups(['suggestion_etablissement:read', 'suggestion_etablissement:write'])]
    private ?string $valeurProposee = null;

    #[ORM\Column(type: 'text', nullable: true)]
    #[Groups(['suggestion_etablissement:read', 'suggestion_etablissement:write'])]
    private ?string $commentaire = null;

    #[ORM\Column(length: 20, options: ['default' => 'EN_ATTENTE'])]
    #[Groups(['suggestion_etablissement:read'])]
    private string $statut = 'EN_ATTENTE';

    #[ORM\Column]
    #[Groups(['suggestion_etablissement:read'])]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column(nullable: true)]
    #[Groups(['suggestion_etablissement:read'])]
    private ?\DateTimeImmutable $updatedAt = null;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getEtablissement(): ?CentreDeSante
    {
        return $this->etablissement;
    }

    public function setEtablissement(?CentreDeSante $etablissement): static
    {
        $this->etablissement = $etablissement;

        return $this;
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

    public function getChamp(): ?string
    {
        return $this->champ;
    }

    public function setChamp(string $champ): static
    {
        $this->champ = $champ;

        return $this;
    }

    public function getValeurProposee(): ?string
    {
        return $this->valeurProposee;
    }

    public function setValeurProposee(string $valeurProposee): static
    {
        $this->valeurProposee = $valeurProposee;

        return $this;
    }

    public function getCommentaire(): ?string
    {
        return $this->commentaire;
    }

    public function setCommentaire(?string $commentaire): static
    {
        $this->commentaire = $commentaire;

        return $this;
    }

    public function getStatut(): string
    {
        return $this->statut;
    }

    public function setStatut(string $statut): static
    {
        $this->statut = $statut;

        return $this;
    }

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function setCreatedAt(\DateTimeImmutable $createdAt): static
    {
        $this->createdAt = $createdAt;

        return $this;
    }

    public function getUpdatedAt(): ?\DateTimeImmutable
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(?\DateTimeImmutable $updatedAt): static
    {
        $this->updatedAt = $updatedAt;

        return $this;
    }
}