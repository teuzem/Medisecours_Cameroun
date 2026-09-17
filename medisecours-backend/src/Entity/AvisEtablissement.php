<?php

declare(strict_types=1);

namespace App\Entity;

use ApiPlatform\Doctrine\Orm\Filter\SearchFilter;
use ApiPlatform\Doctrine\Orm\Filter\OrderFilter;
use ApiPlatform\Metadata\ApiFilter;
use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Delete;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Patch;
use ApiPlatform\Metadata\Post;
use App\Repository\AvisEtablissementRepository;
use App\State\AvisEtablissementCollectionProvider;
use App\State\AvisEtablissementProcessor;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Annotation\Groups;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * Avis laissé par un utilisateur sur un établissement de santé
 * (centre de santé, hôpital, pharmacie, laboratoire…).
 *
 * - Un avis est publié immédiatement après post (statut PUBLIE).
 * - L'auteur est toujours l'utilisateur connecté (injecté par AvisEtablissementProcessor).
 * - Les administrateurs / managers peuvent modérer (statut REJETE) ou signaler.
 * - La note moyenne et le total d'avis de l'établissement sont recalculés à chaque post.
 */
#[ORM\Entity(repositoryClass: AvisEtablissementRepository::class)]
#[ApiFilter(SearchFilter::class, properties: [
    'etablissement' => 'exact',
    'user' => 'exact',
    'note' => 'exact',
])]
#[ApiFilter(OrderFilter::class, properties: ['createdAt' => 'DESC', 'note' => 'DESC'])]
#[ApiResource(
    operations: [
        // Lecture publique : seuls les avis PUBLIE sont exposés (sauf admin)
        new GetCollection(
            provider: AvisEtablissementCollectionProvider::class,
            normalizationContext: ['groups' => ['avis_etablissement:read']],
            paginationEnabled: false
        ),
        new Get(normalizationContext: ['groups' => ['avis_etablissement:read']]),
        // Un utilisateur connecté peut laisser un avis sur un établissement
        new Post(
            security: "is_granted('ROLE_USER')",
            processor: AvisEtablissementProcessor::class,
            normalizationContext: ['groups' => ['avis_etablissement:read']]
        ),
        // Modération : admin (statut/flag) ou auteur (contenu)
        new Patch(
            security: "is_granted('ROLE_ADMIN') or object.getUser() == user",
            securityMessage: 'Vous ne pouvez modifier que vos propres avis.',
            normalizationContext: ['groups' => ['avis_etablissement:read']]
        ),
        new Delete(
            security: "is_granted('ROLE_ADMIN') or object.getUser() == user",
            securityMessage: 'Vous ne pouvez supprimer que vos propres avis.'
        )
    ],
    normalizationContext: ['groups' => ['avis_etablissement:read']],
    denormalizationContext: ['groups' => ['avis_etablissement:write']],
    cacheHeaders: ['max_age' => 60, 'shared_max_age' => 120]
)]
class AvisEtablissement
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['avis_etablissement:read', 'centre_sante:fiche'])]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: CentreDeSante::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    #[Groups(['avis_etablissement:read', 'avis_etablissement:write'])]
    private ?CentreDeSante $etablissement = null;

    /**
     * Auteur de l'avis (injecté automatiquement via AvisEtablissementProcessor).
     */
    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    #[Groups(['avis_etablissement:read'])]
    private ?User $user = null;

    #[ORM\Column(type: 'smallint')]
    #[Assert\NotBlank(message: 'La note est obligatoire')]
    #[Assert\Range(min: 1, max: 5, notInRangeMessage: 'La note doit être comprise entre {{ min }} et {{ max }}.')]
    #[Groups(['avis_etablissement:read', 'avis_etablissement:write'])]
    private ?int $note = null;

    #[ORM\Column(type: 'text', nullable: true)]
    #[Assert\Length(min: 5, max: 2000, minMessage: 'Le commentaire doit faire au moins {{ limit }} caractères.', maxMessage: 'Le commentaire ne peut pas dépasser {{ limit }} caractères.')]
    #[Groups(['avis_etablissement:read', 'avis_etablissement:write'])]
    private ?string $commentaire = null;

    #[ORM\Column(length: 20, options: ['default' => 'PUBLIE'])]
    #[Groups(['avis_etablissement:read'])]
    private string $statut = 'PUBLIE';

    #[ORM\Column(type: 'boolean', options: ['default' => false])]
    #[Groups(['avis_etablissement:read'])]
    private bool $signale = false;

    #[ORM\Column(type: 'text', nullable: true)]
    #[Groups(['avis_etablissement:read'])]
    private ?string $raisonSignalement = null;

    #[ORM\Column]
    #[Groups(['avis_etablissement:read'])]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column(nullable: true)]
    #[Groups(['avis_etablissement:read'])]
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

    #[Groups(['avis_etablissement:read', 'centre_sante:fiche'])]
    public function getAuteurNom(): ?string
    {
        if (!$this->user) {
            return null;
        }

        return trim(($this->user->getPrenom() ?? '') . ' ' . ($this->user->getNom() ?? ''));
    }

    public function getNote(): ?int
    {
        return $this->note;
    }

    public function setNote(int $note): static
    {
        $this->note = $note;

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

    public function isSignale(): bool
    {
        return $this->signale;
    }

    public function setSignale(bool $signale): static
    {
        $this->signale = $signale;

        return $this;
    }

    public function getRaisonSignalement(): ?string
    {
        return $this->raisonSignalement;
    }

    public function setRaisonSignalement(?string $raisonSignalement): static
    {
        $this->raisonSignalement = $raisonSignalement;

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