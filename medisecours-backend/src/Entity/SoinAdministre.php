<?php

declare(strict_types=1);

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

/**
 * Soin administré par un infirmier(IDE) ou aide-soignant(AS). La réalisation
 * exige une signature numérique (image + hash SHA-256) non répudiable,
 * horodatée dans le dossier du patient.
 */
#[ORM\Entity]
class SoinAdministre
{
    public const STATUT_PLANIFIE = 'PLANIFIE';
    public const STATUT_EN_COURS = 'EN_COURS';
    public const STATUT_REALISE = 'REALISE';
    public const STATUT_ANNULE = 'ANNULE';

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: DossierMedical::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private ?DossierMedical $dossier = null;

    #[ORM\ManyToOne(targetEntity: Patient::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private ?Patient $patient = null;

    #[ORM\ManyToOne(targetEntity: Consultation::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?Consultation $consultation = null;

    #[ORM\ManyToOne(targetEntity: OrdonnancePharmacie::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?OrdonnancePharmacie $ordonnance = null;

    #[ORM\ManyToOne(targetEntity: PersonnelSante::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?PersonnelSante $infirmier = null;

    #[ORM\Column(length: 255)]
    private string $libelle = '';

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $details = null;

    #[ORM\Column(length: 20, options: ['default' => 'PLANIFIE'])]
    private string $statut = self::STATUT_PLANIFIE;

    /** @var string|null Data-URI de la signature manuscrite au moment de la réalisation. */
    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $signatureImage = null;

    #[ORM\Column(length: 64, nullable: true)]
    private ?string $signatureHash = null;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column(nullable: true)]
    private ?\DateTimeImmutable $realisedAt = null;

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

    public function getConsultation(): ?Consultation
    {
        return $this->consultation;
    }

    public function setConsultation(?Consultation $consultation): static
    {
        $this->consultation = $consultation;

        return $this;
    }

    public function getOrdonnance(): ?OrdonnancePharmacie
    {
        return $this->ordonnance;
    }

    public function setOrdonnance(?OrdonnancePharmacie $ordonnance): static
    {
        $this->ordonnance = $ordonnance;

        return $this;
    }

    public function getInfirmier(): ?PersonnelSante
    {
        return $this->infirmier;
    }

    public function setInfirmier(?PersonnelSante $infirmier): static
    {
        $this->infirmier = $infirmier;

        return $this;
    }

    public function getLibelle(): string
    {
        return $this->libelle;
    }

    public function setLibelle(string $libelle): static
    {
        $this->libelle = $libelle;

        return $this;
    }

    public function getDetails(): ?string
    {
        return $this->details;
    }

    public function setDetails(?string $details): static
    {
        $this->details = $details;

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

    public function getSignatureImage(): ?string
    {
        return $this->signatureImage;
    }

    public function setSignatureImage(?string $signatureImage): static
    {
        $this->signatureImage = $signatureImage;

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

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function getRealisedAt(): ?\DateTimeImmutable
    {
        return $this->realisedAt;
    }

    public function setRealisedAt(?\DateTimeImmutable $realisedAt): static
    {
        $this->realisedAt = $realisedAt;

        return $this;
    }
}
