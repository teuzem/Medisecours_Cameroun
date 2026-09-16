<?php

declare(strict_types=1);

namespace App\Entity;

use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Delete;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Patch;
use ApiPlatform\Metadata\Post;
use App\Repository\AvisRepository;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Annotation\Groups;
use Symfony\Component\Validator\Constraints as Assert;
use ApiPlatform\Doctrine\Orm\Filter\SearchFilter;
use ApiPlatform\Doctrine\Orm\Filter\OrderFilter;
use ApiPlatform\Doctrine\Orm\Filter\BooleanFilter;
use ApiPlatform\Metadata\ApiFilter;

/**
 * Avis laissé par un patient sur un médecin après un échange.
 * Chaque avis représente une expérience distincte après une consultation terminée.
 */
#[ORM\Entity(repositoryClass: AvisRepository::class)]
#[ApiFilter(SearchFilter::class, properties: [
    'patient.nom' => 'partial',
    'patient.prenom' => 'partial',
    'medecin.nom' => 'partial',
    'medecin.prenom' => 'partial',
    'patient' => 'exact',
    'medecin' => 'exact',
    'commentaire' => 'partial',
    'note' => 'exact',
])]
#[ApiFilter(BooleanFilter::class, properties: ['signale'])]
#[ApiFilter(OrderFilter::class, properties: ['createdAt' => 'DESC', 'note' => 'DESC'])]
#[ApiResource(
    operations: [
        // Lecture publique des avis d'un médecin
        new GetCollection(),
        new Get(),
        // Un patient authentifié peut laisser un avis
        new Post(
            security: "is_granted('ROLE_PATIENT')",
            processor: \App\State\AvisProcessor::class
        ),
        // Le patient peut modifier son propre avis dans les 30 jours
        new Patch(
            security: "is_granted('ROLE_ADMIN') or object.getPatient() == user",
            securityMessage: "Vous ne pouvez modifier que vos propres avis."
        ),
        // Suppression : admin ou patient propriétaire
        new Delete(
            security: "is_granted('ROLE_ADMIN') or object.getPatient() == user",
            securityMessage: "Vous ne pouvez supprimer que vos propres avis."
        ),
    ],
    normalizationContext: ['groups' => ['avis:read']],
    denormalizationContext: ['groups' => ['avis:write']],
    paginationEnabled: true,
    paginationItemsPerPage: 20,
    paginationMaximumItemsPerPage: 50,
    cacheHeaders: ['max_age' => 300, 'shared_max_age' => 600]
)]
class Avis
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['avis:read'])]
    private ?int $id = null;

    /**
     * Patient auteur de l'avis (injecté automatiquement depuis le JWT via AvisProcessor).
     */
    #[ORM\ManyToOne(targetEntity: Patient::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    #[Groups(['avis:read'])]
    private ?Patient $patient = null;

    /**
     * Médecin évalué.
     */
    #[ORM\ManyToOne(targetEntity: Medecin::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    #[Groups(['avis:read', 'avis:write'])]
    private ?Medecin $medecin = null;

    /**
     * Note entre 1 et 5.
     */
    #[ORM\Column(type: 'smallint')]
    #[Assert\NotBlank(message: 'La note est obligatoire')]
    #[Assert\Range(
        min: 1,
        max: 5,
        notInRangeMessage: 'La note doit être comprise entre {{ min }} et {{ max }}.'
    )]
    #[Groups(['avis:read', 'avis:write'])]
    private ?int $note = null;

    /**
     * Commentaire optionnel (200 caractères minimum si renseigné).
     */
    #[ORM\Column(type: 'text', nullable: true)]
    #[Assert\Length(
        min: 10,
        max: 2000,
        minMessage: 'Le commentaire doit faire au moins {{ limit }} caractères.',
        maxMessage: 'Le commentaire ne peut pas dépasser {{ limit }} caractères.'
    )]
    #[Groups(['avis:read', 'avis:write'])]
    private ?string $commentaire = null;

    /**
     * Indique si l'avis a été signalé comme inapproprié.
     */
    #[ORM\Column(type: 'boolean', options: ['default' => false])]
    #[Groups(['avis:read'])]
    private bool $signale = false;

    /**
     * Raison du signalement (remplie par le médecin ou un autre utilisateur).
     */
    #[ORM\Column(type: 'text', nullable: true)]
    #[Groups(['avis:read'])]
    private ?string $raisonSignalement = null;

    #[ORM\Column]
    #[Groups(['avis:read'])]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column(nullable: true)]
    #[Groups(['avis:read'])]
    private ?\DateTimeImmutable $updatedAt = null;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getPatient(): ?Patient
    {
        return $this->patient;
    }

    public function setPatient(?Patient $patient): static
    {
        $this->patient = $patient;

        return $this;
    }

    public function getMedecin(): ?Medecin
    {
        return $this->medecin;
    }

    public function setMedecin(?Medecin $medecin): static
    {
        $this->medecin = $medecin;

        return $this;
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
