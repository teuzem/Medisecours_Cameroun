<?php

declare(strict_types=1);

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Annotation\Groups;

/**
 * Pièce justificative (diplôme, attestation, CARMed, certificat) déposée
 * par un membre du personnel et validée par le manager de l'établissement.
 * Le fichier est stocké en data-URI dans la base (cohérent avec
 * SignatureNumerique — pas de dépendance disque).
 */
#[ORM\Entity]
class DocumentValidation
{
    public const TYPE_DIPLOME = 'DIPLOME';
    public const TYPE_ATTESTATION = 'ATTESTATION_FONCTION';
    public const TYPE_CARMED = 'CARMED';
    public const TYPE_CERTIFICAT = 'CERTIFICAT';
    public const TYPE_AUTRE = 'AUTRE';

    public const TYPES = [self::TYPE_DIPLOME, self::TYPE_ATTESTATION, self::TYPE_CARMED, self::TYPE_CERTIFICAT, self::TYPE_AUTRE];

    public const STATUT_EN_ATTENTE = 'EN_ATTENTE';
    public const STATUT_VALIDE = 'VALIDE';
    public const STATUT_REJETE = 'REJETE';

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: PersonnelSante::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private ?PersonnelSante $personnel = null;

    #[ORM\Column(length: 40)]
    private string $typeDocument = self::TYPE_AUTRE;

    #[ORM\Column(length: 255, nullable: true)]
    private ?string $titre = null;

    #[ORM\Column(length: 120, nullable: true)]
    private ?string $originalName = null;

    /** @var string|null Data-URI (image/* ou application/pdf), max 3 Mo. */
    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $fichierData = null;

    #[ORM\Column(length: 20, options: ['default' => 'EN_ATTENTE'])]
    private string $statut = self::STATUT_EN_ATTENTE;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $motif = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?User $validatedBy = null;

    #[ORM\Column(nullable: true)]
    private ?\DateTimeImmutable $validatedAt = null;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getPersonnel(): ?PersonnelSante
    {
        return $this->personnel;
    }

    public function setPersonnel(?PersonnelSante $personnel): static
    {
        $this->personnel = $personnel;

        return $this;
    }

    public function getTypeDocument(): string
    {
        return $this->typeDocument;
    }

    public function setTypeDocument(string $typeDocument): static
    {
        $this->typeDocument = $typeDocument;

        return $this;
    }

    public function getTitre(): ?string
    {
        return $this->titre;
    }

    public function setTitre(?string $titre): static
    {
        $this->titre = $titre;

        return $this;
    }

    public function getOriginalName(): ?string
    {
        return $this->originalName;
    }

    public function setOriginalName(?string $originalName): static
    {
        $this->originalName = $originalName;

        return $this;
    }

    public function getFichierData(): ?string
    {
        return $this->fichierData;
    }

    public function setFichierData(?string $fichierData): static
    {
        $this->fichierData = $fichierData;

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

    public function getMotif(): ?string
    {
        return $this->motif;
    }

    public function setMotif(?string $motif): static
    {
        $this->motif = $motif;

        return $this;
    }

    public function getValidatedBy(): ?User
    {
        return $this->validatedBy;
    }

    public function setValidatedBy(?User $validatedBy): static
    {
        $this->validatedBy = $validatedBy;

        return $this;
    }

    public function getValidatedAt(): ?\DateTimeImmutable
    {
        return $this->validatedAt;
    }

    public function setValidatedAt(?\DateTimeImmutable $validatedAt): static
    {
        $this->validatedAt = $validatedAt;

        return $this;
    }

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }
}
