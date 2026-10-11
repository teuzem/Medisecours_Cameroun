<?php

declare(strict_types=1);

namespace App\Entity;

use App\Repository\DossierMedicalRepository;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Annotation\Groups;

/**
 * Dossier médical du patient au sein d'un établissement — l'équivalent
 * numérique du carnet de consultation. Un seul dossier par couple
 * (patient, établissement) ; il s'ouvre automatiquement à la première
 * admission par l'accueil et accueille les événements herodates.
 */
#[ORM\Entity(repositoryClass: DossierMedicalRepository::class)]
#[ORM\UniqueConstraint(name: 'uniq_dossier_centre_patient', columns: ['centre_id', 'patient_id'])]
class DossierMedical
{
    public const STATUT_OUVERT = 'OUVERT';
    public const STATUT_CLOS = 'CLOS';

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: 30, unique: true)]
    #[Groups(['dossier:read'])]
    private string $numero;

    #[ORM\ManyToOne(targetEntity: CentreDeSante::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private ?CentreDeSante $centre = null;

    #[ORM\ManyToOne(targetEntity: Patient::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private ?Patient $patient = null;

    #[ORM\Column(length: 20, options: ['default' => 'OUVERT'])]
    private string $statut = self::STATUT_OUVERT;

    #[ORM\ManyToOne(targetEntity: PersonnelSante::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?PersonnelSante $openedBy = null;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column(nullable: true)]
    private ?\DateTimeImmutable $closedAt = null;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable();
        $this->numero = 'D-'.strtoupper(bin2hex(random_bytes(3)));
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getNumero(): string
    {
        return $this->numero;
    }

    public function setNumero(string $numero): static
    {
        $this->numero = $numero;

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

        return $this;
    }

    public function getOpenedBy(): ?PersonnelSante
    {
        return $this->openedBy;
    }

    public function setOpenedBy(?PersonnelSante $openedBy): static
    {
        $this->openedBy = $openedBy;

        return $this;
    }

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function getClosedAt(): ?\DateTimeImmutable
    {
        return $this->closedAt;
    }

    public function setClosedAt(?\DateTimeImmutable $closedAt): static
    {
        $this->closedAt = $closedAt;

        return $this;
    }
}
