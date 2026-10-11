<?php

declare(strict_types=1);

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

/**
 * Constantes vitales recueillies à l'arrivée par l'accueil (une ligne par
 * passage). Alimente le dossier médical et le dossier du patient.
 */
#[ORM\Entity]
class SigneVitaux
{
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

    #[ORM\ManyToOne(targetEntity: CentreDeSante::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?CentreDeSante $centre = null;

    #[ORM\ManyToOne(targetEntity: PersonnelSante::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?PersonnelSante $saisiPar = null;

    #[ORM\Column(nullable: true)]
    private ?int $ageAns = null;

    #[ORM\Column(nullable: true)]
    private ?float $poidsKg = null;

    #[ORM\Column(nullable: true)]
    private ?float $tailleCm = null;

    #[ORM\Column(nullable: true)]
    private ?float $temperatureC = null;

    #[ORM\Column(length: 20, nullable: true)]
    private ?string $tensionArterialeGauche = null;

    #[ORM\Column(length: 20, nullable: true)]
    private ?string $tensionArterialeDroite = null;

    #[ORM\Column(nullable: true)]
    private ?int $poulsParMin = null;

    #[ORM\Column(nullable: true)]
    private ?int $spo2 = null;

    #[ORM\Column(nullable: true)]
    private ?float $glycemieMmol = null;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $notes = null;

    #[ORM\Column]
    private \DateTimeImmutable $recordedAt;

    public function __construct()
    {
        $this->recordedAt = new \DateTimeImmutable();
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

    public function getSaisiPar(): ?PersonnelSante
    {
        return $this->saisiPar;
    }

    public function setSaisiPar(?PersonnelSante $saisiPar): static
    {
        $this->saisiPar = $saisiPar;

        return $this;
    }

    public function getAgeAns(): ?int
    {
        return $this->ageAns;
    }

    public function setAgeAns(?int $ageAns): static
    {
        $this->ageAns = $ageAns;

        return $this;
    }

    public function getPoidsKg(): ?float
    {
        return $this->poidsKg;
    }

    public function setPoidsKg(?float $poidsKg): static
    {
        $this->poidsKg = $poidsKg;

        return $this;
    }

    public function getTailleCm(): ?float
    {
        return $this->tailleCm;
    }

    public function setTailleCm(?float $tailleCm): static
    {
        $this->tailleCm = $tailleCm;

        return $this;
    }

    public function getTemperatureC(): ?float
    {
        return $this->temperatureC;
    }

    public function setTemperatureC(?float $temperatureC): static
    {
        $this->temperatureC = $temperatureC;

        return $this;
    }

    public function getTensionArterialeGauche(): ?string
    {
        return $this->tensionArterialeGauche;
    }

    public function setTensionArterialeGauche(?string $tensionArterialeGauche): static
    {
        $this->tensionArterialeGauche = $tensionArterialeGauche;

        return $this;
    }

    public function getTensionArterialeDroite(): ?string
    {
        return $this->tensionArterialeDroite;
    }

    public function setTensionArterialeDroite(?string $tensionArterialeDroite): static
    {
        $this->tensionArterialeDroite = $tensionArterialeDroite;

        return $this;
    }

    public function getPoulsParMin(): ?int
    {
        return $this->poulsParMin;
    }

    public function setPoulsParMin(?int $poulsParMin): static
    {
        $this->poulsParMin = $poulsParMin;

        return $this;
    }

    public function getSpo2(): ?int
    {
        return $this->spo2;
    }

    public function setSpo2(?int $spo2): static
    {
        $this->spo2 = $spo2;

        return $this;
    }

    public function getGlycemieMmol(): ?float
    {
        return $this->glycemieMmol;
    }

    public function setGlycemieMmol(?float $glycemieMmol): static
    {
        $this->glycemieMmol = $glycemieMmol;

        return $this;
    }

    public function getNotes(): ?string
    {
        return $this->notes;
    }

    public function setNotes(?string $notes): static
    {
        $this->notes = $notes;

        return $this;
    }

    public function getRecordedAt(): \DateTimeImmutable
    {
        return $this->recordedAt;
    }

    /** @return array<string, mixed> */
    public function toSummaryArray(): array
    {
        return [
            'ageAns' => $this->ageAns,
            'poidsKg' => $this->poidsKg,
            'tailleCm' => $this->tailleCm,
            'temperatureC' => $this->temperatureC,
            'tensionArterialeGauche' => $this->tensionArterialeGauche,
            'tensionArterialeDroite' => $this->tensionArterialeDroite,
            'poulsParMin' => $this->poulsParMin,
            'spo2' => $this->spo2,
            'glycemieMmol' => $this->glycemieMmol,
            'notes' => $this->notes,
        ];
    }
}
