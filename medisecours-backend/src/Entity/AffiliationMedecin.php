<?php

declare(strict_types=1);

namespace App\Entity;

use ApiPlatform\Doctrine\Orm\Filter\SearchFilter;
use ApiPlatform\Metadata\ApiFilter;
use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Delete;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Patch;
use ApiPlatform\Metadata\Post;
use App\Repository\AffiliationMedecinRepository;
use App\State\AffiliationMedecinCollectionProvider;
use App\State\AffiliationMedecinProcessor;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Annotation\Groups;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * Affiliation d'un médecin à un établissement de santé.
 *
 * Workflow :
 *  - Un médecin validé demande à être affilié à un établissement (statut EN_ATTENTE).
 *  - Le manager de l'établissement ou un admin valide (ACCEPTEE) ou refuse (REFUSEE).
 *  - Une affiliation peut être suspendue (SUSPENDUE) sans être supprimée.
 *
 * Seules les affiliations ACCEPTEE sont exposées publiquement (fiche établissement).
 */
#[ORM\Entity(repositoryClass: AffiliationMedecinRepository::class)]
#[ApiFilter(SearchFilter::class, properties: ['etablissement' => 'exact'])]
#[ApiResource(
    operations: [
        // Lecture publique : uniquement les affiliations ACCEPTEE (sauf admin)
        new GetCollection(
            provider: AffiliationMedecinCollectionProvider::class,
            normalizationContext: ['groups' => ['affiliation_medecin:read']],
            paginationEnabled: false
        ),
        new Get(normalizationContext: ['groups' => ['affiliation_medecin:read']]),
        // Un médecin validé peut demander son affiliation
        new Post(
            security: "is_granted('ROLE_MEDECIN')",
            processor: AffiliationMedecinProcessor::class,
            normalizationContext: ['groups' => ['affiliation_medecin:read']]
        ),
        // Le médecin met à jour son planning/fonction ; l'admin gère le statut
        new Patch(
            security: "is_granted('ROLE_ADMIN') or object.getMedecin() == user",
            normalizationContext: ['groups' => ['affiliation_medecin:read']]
        ),
        new Delete(
            security: "is_granted('ROLE_ADMIN') or object.getMedecin() == user",
            securityMessage: 'Vous ne pouvez supprimer que vos propres affiliations.'
        )
    ],
    normalizationContext: ['groups' => ['affiliation_medecin:read']],
    denormalizationContext: ['groups' => ['affiliation_medecin:write']],
    cacheHeaders: ['max_age' => 60]
)]
class AffiliationMedecin
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['affiliation_medecin:read'])]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: Medecin::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    #[Groups(['affiliation_medecin:read'])]
    private ?Medecin $medecin = null;

    #[ORM\ManyToOne(targetEntity: CentreDeSante::class, inversedBy: 'affiliations')]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    #[Groups(['affiliation_medecin:read', 'affiliation_medecin:write'])]
    private ?CentreDeSante $etablissement = null;

    /**
     * Fonction au sein de l'établissement (ex : "Médecin généraliste", "Cardiologue").
     */
    #[ORM\Column(length: 255, nullable: true)]
    #[Assert\Length(max: 255)]
    #[Groups(['affiliation_medecin:read', 'affiliation_medecin:write'])]
    private ?string $fonction = null;

    #[ORM\Column(length: 120, nullable: true)]
    #[Groups(['affiliation_medecin:read', 'affiliation_medecin:write'])]
    private ?string $salle = null;

    /**
     * Planning de présence au sein de l'établissement.
     * Format identique à Medecin.disponibilites :
     * [{"jour": "lundi", "debut": "08:00", "fin": "17:00"}]
     */
    #[ORM\Column(type: 'json', nullable: true)]
    #[Groups(['affiliation_medecin:read', 'affiliation_medecin:write'])]
    private ?array $planning = null;

    #[ORM\Column(type: 'boolean', options: ['default' => false])]
    #[Groups(['affiliation_medecin:read', 'affiliation_medecin:write'])]
    private bool $teleconsultation = false;

    #[ORM\Column(length: 20, options: ['default' => 'EN_ATTENTE'])]
    #[Groups(['affiliation_medecin:read'])]
    private string $statut = 'EN_ATTENTE';

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?User $createdBy = null;

    #[ORM\Column]
    #[Groups(['affiliation_medecin:read'])]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column(nullable: true)]
    #[Groups(['affiliation_medecin:read'])]
    private ?\DateTimeImmutable $updatedAt = null;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
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

    public function getEtablissement(): ?CentreDeSante
    {
        return $this->etablissement;
    }

    public function setEtablissement(?CentreDeSante $etablissement): static
    {
        $this->etablissement = $etablissement;

        return $this;
    }

    public function getFonction(): ?string
    {
        return $this->fonction;
    }

    public function setFonction(?string $fonction): static
    {
        $this->fonction = $fonction;

        return $this;
    }

    public function getSalle(): ?string
    {
        return $this->salle;
    }

    public function setSalle(?string $salle): static
    {
        $this->salle = $salle;

        return $this;
    }

    public function getPlanning(): ?array
    {
        return $this->planning;
    }

    public function setPlanning(?array $planning): static
    {
        $this->planning = $planning;

        return $this;
    }

    public function isTeleconsultation(): bool
    {
        return $this->teleconsultation;
    }

    public function setTeleconsultation(bool $teleconsultation): static
    {
        $this->teleconsultation = $teleconsultation;

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

    public function getCreatedBy(): ?User
    {
        return $this->createdBy;
    }

    public function setCreatedBy(?User $createdBy): static
    {
        $this->createdBy = $createdBy;

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