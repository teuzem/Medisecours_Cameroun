<?php

declare(strict_types=1);

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

/**
 * Événement horodaté du dossier médical (« herodates ») : chaque action
 * du circuit (accueil, signes vitaux, consultation, soin signé, ordonnance,
 * pharmacie) y est écrite de façon immuable et chronologique.
 */
#[ORM\Entity]
#[ORM\Index(name: 'idx_dossier_evenement_dossier_date', columns: ['dossier_id', 'created_at'])]
class DossierEvenement
{
    public const TYPE_ACCUEIL = 'ACCUEIL';
    public const TYPE_SIGNE_VITAUX = 'SIGNE_VITAUX';
    public const TYPE_CONSULTATION = 'CONSULTATION';
    public const TYPE_SOIN = 'SOIN';
    public const TYPE_ORDONNANCE = 'ORDONNANCE';
    public const TYPE_PHARMACIE = 'PHARMACIE';
    public const TYPE_NOTE = 'NOTE';

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: DossierMedical::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'CASCADE')]
    private ?DossierMedical $dossier = null;

    #[ORM\ManyToOne(targetEntity: Patient::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private ?Patient $patient = null;

    #[ORM\ManyToOne(targetEntity: CentreDeSante::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?CentreDeSante $centre = null;

    #[ORM\Column(length: 30)]
    private string $type = self::TYPE_NOTE;

    #[ORM\Column(length: 255)]
    private string $titre = '';

    #[ORM\Column(type: 'json', nullable: true)]
    private ?array $details = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?User $auteur = null;

    /** Empreinte SHA-256 de la signature associée (non-répudiation). */
    #[ORM\Column(length: 64, nullable: true)]
    private ?string $signatureHash = null;

    /**
     * Cachet de l'etablissement appose sur l'acte au moment de sa redaction.
     * Conserve tel quel : meme si l'etablissement change de cachet plus tard,
     * l'acte reste lie au cachet qui l'a scelle.
     */
    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $cachetUrl = null;

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

    public function getDossier(): ?DossierMedical
    {
        return $this->dossier;
    }

    public function setDossier(?DossierMedical $dossier): static
    {
        $this->dossier = $dossier;

        return $this;
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

    public function getCentre(): ?CentreDeSante
    {
        return $this->centre;
    }

    public function setCentre(?CentreDeSante $centre): static
    {
        $this->centre = $centre;

        return $this;
    }

    public function getType(): string
    {
        return $this->type;
    }

    public function setType(string $type): static
    {
        $this->type = $type;

        return $this;
    }

    public function getTitre(): string
    {
        return $this->titre;
    }

    public function setTitre(string $titre): static
    {
        $this->titre = $titre;

        return $this;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function getDetails(): ?array
    {
        return $this->details;
    }

    /**
     * @param array<string, mixed>|null $details
     */
    public function setDetails(?array $details): static
    {
        $this->details = $details;

        return $this;
    }

    public function getAuteur(): ?User
    {
        return $this->auteur;
    }

    public function setAuteur(?User $auteur): static
    {
        $this->auteur = $auteur;

        return $this;
    }

    public function getSignatureHash(): ?string
    {
        return $this->signatureHash;
    }

    public function setSignatureHash(?string $signatureHash): static
    {
        $this->signatureHash = $signatureHash;

        return $this;
    }

    public function getCachetUrl(): ?string
    {
        return $this->cachetUrl;
    }

    public function setCachetUrl(?string $cachetUrl): static
    {
        $this->cachetUrl = $cachetUrl;

        return $this;
    }

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }
}
