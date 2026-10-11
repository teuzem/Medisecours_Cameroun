<?php

declare(strict_types=1);

namespace App\Entity;

use App\Repository\OrdonnancePharmacieRepository;
use Doctrine\ORM\Mapping as ORM;

/**
 * Circuit pharmacie d'une ordonnance médecin au sein d'un établissement.
 *
 * Créée automatiquement quand le médecin TRANSMET une ordonnance rattachée
 * à un établissement. Cycle de vie (hors transactions financières — le
 * paiement se fait en caisse physique) :
 *
 *   RECUE → FACTUREE → PAYEE → A_ADMINISTRER → ADMINISTREE
 *   (n'importe quel statut sauf ADMINISTREE peut partir en ANNULEE)
 */
#[ORM\Entity(repositoryClass: OrdonnancePharmacieRepository::class)]
#[ORM\Index(name: 'idx_ord_pharm_centre_statut', columns: ['centre_id', 'statut'])]
class OrdonnancePharmacie
{
    public const STATUT_RECUE = 'RECUE';
    public const STATUT_FACTUREE = 'FACTUREE';
    public const STATUT_PAYEE = 'PAYEE';
    public const STATUT_A_ADMINISTRER = 'A_ADMINISTRER';
    public const STATUT_ADMINISTREE = 'ADMINISTREE';
    public const STATUT_ANNULEE = 'ANNULEE';

    public const STATUTS = [
        self::STATUT_RECUE,
        self::STATUT_FACTUREE,
        self::STATUT_PAYEE,
        self::STATUT_A_ADMINISTRER,
        self::STATUT_ADMINISTREE,
        self::STATUT_ANNULEE,
    ];

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\OneToOne(targetEntity: Prescription::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private ?Prescription $prescription = null;

    #[ORM\ManyToOne(targetEntity: CentreDeSante::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?CentreDeSante $centre = null;

    #[ORM\ManyToOne(targetEntity: Patient::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private ?Patient $patient = null;

    #[ORM\Column(length: 20, options: ['default' => 'RECUE'])]
    private string $statut = self::STATUT_RECUE;

    /** Montant total facturé (hors ligne, confirmé en caisse). */
    #[ORM\Column(nullable: true)]
    private ?float $montantTotal = null;

    #[ORM\ManyToOne(targetEntity: PersonnelSante::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?PersonnelSante $facturePar = null;

    #[ORM\Column(nullable: true)]
    private ?\DateTimeImmutable $factureLe = null;

    #[ORM\ManyToOne(targetEntity: PersonnelSante::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?PersonnelSante $payePar = null;

    #[ORM\Column(nullable: true)]
    private ?\DateTimeImmutable $payeLe = null;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $cancelMotif = null;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column]
    private \DateTimeImmutable $updatedAt;

    public function __construct()
    {
        $now = new \DateTimeImmutable();
        $this->createdAt = $now;
        $this->updatedAt = $now;
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getPrescription(): ?Prescription
    {
        return $this->prescription;
    }

    public function setPrescription(?Prescription $prescription): static
    {
        $this->prescription = $prescription;

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

    public function getPatient(): ?Patient
    {
        return $this->patient;
    }

    public function setPatient(?Patient $patient): static
    {
        $this->patient = $patient;

        return $this;
    }

    public function getStatut(): string
    {
        return $this->statut;
    }

    public function setStatut(string $statut): static
    {
        $this->statut = $statut;
        $this->updatedAt = new \DateTimeImmutable();

        return $this;
    }

    public function getMontantTotal(): ?float
    {
        return $this->montantTotal;
    }

    public function setMontantTotal(?float $montantTotal): static
    {
        $this->montantTotal = $montantTotal;

        return $this;
    }

    public function getFacturePar(): ?PersonnelSante
    {
        return $this->facturePar;
    }

    public function setFacturePar(?PersonnelSante $facturePar): static
    {
        $this->facturePar = $facturePar;

        return $this;
    }

    public function getFactureLe(): ?\DateTimeImmutable
    {
        return $this->factureLe;
    }

    public function setFactureLe(?\DateTimeImmutable $factureLe): static
    {
        $this->factureLe = $factureLe;

        return $this;
    }

    public function getPayePar(): ?PersonnelSante
    {
        return $this->payePar;
    }

    public function setPayePar(?PersonnelSante $payePar): static
    {
        $this->payePar = $payePar;

        return $this;
    }

    public function getPayeLe(): ?\DateTimeImmutable
    {
        return $this->payeLe;
    }

    public function setPayeLe(?\DateTimeImmutable $payeLe): static
    {
        $this->payeLe = $payeLe;

        return $this;
    }

    public function getCancelMotif(): ?string
    {
        return $this->cancelMotif;
    }

    public function setCancelMotif(?string $cancelMotif): static
    {
        $this->cancelMotif = $cancelMotif;

        return $this;
    }

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function getUpdatedAt(): \DateTimeImmutable
    {
        return $this->updatedAt;
    }
}
