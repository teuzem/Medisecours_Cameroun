<?php

declare(strict_types=1);

namespace App\Entity;

use App\Repository\SignalementMedecinRepository;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: SignalementMedecinRepository::class)]
#[ORM\Table(name: 'signalement_medecin')]
#[ORM\Index(columns: ['patient_id', 'medecin_id', 'statut'], name: 'idx_signalement_patient_medecin_statut')]
#[ORM\Index(columns: ['statut', 'created_at'], name: 'idx_signalement_statut_created')]
class SignalementMedecin
{
    public const MOTIF_COMPORTEMENT = 'COMPORTEMENT_INAPPROPRIE';
    public const MOTIF_INFORMATION = 'FAUSSE_INFORMATION';
    public const MOTIF_HARCELEMENT = 'HARCELEMENT';
    public const MOTIF_NEGLIGENCE = 'NEGLIGENCE';
    public const MOTIF_FRAUDE = 'FRAUDE';
    public const MOTIF_AUTRE = 'AUTRE';

    public const STATUT_NOUVEAU = 'NOUVEAU';
    public const STATUT_EN_COURS = 'EN_COURS';
    public const STATUT_TRAITE = 'TRAITE';
    public const STATUT_REJETE = 'REJETE';

    public const MOTIFS = [
        self::MOTIF_COMPORTEMENT,
        self::MOTIF_INFORMATION,
        self::MOTIF_HARCELEMENT,
        self::MOTIF_NEGLIGENCE,
        self::MOTIF_FRAUDE,
        self::MOTIF_AUTRE,
    ];

    public const STATUTS = [
        self::STATUT_NOUVEAU,
        self::STATUT_EN_COURS,
        self::STATUT_TRAITE,
        self::STATUT_REJETE,
    ];

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: Patient::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private ?Patient $patient = null;

    #[ORM\ManyToOne(targetEntity: Medecin::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private ?Medecin $medecin = null;

    #[ORM\Column(length: 80)]
    private string $motif;

    #[ORM\Column(type: 'text')]
    private string $description;

    #[ORM\Column(length: 30)]
    private string $statut = self::STATUT_NOUVEAU;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $noteAdmin = null;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column]
    private \DateTimeImmutable $updatedAt;

    #[ORM\Column(nullable: true)]
    private ?\DateTimeImmutable $traiteAt = null;

    public function __construct()
    {
        $now = new \DateTimeImmutable();
        $this->createdAt = $now;
        $this->updatedAt = $now;
    }

    public function getId(): ?int { return $this->id; }
    public function getPatient(): ?Patient { return $this->patient; }
    public function setPatient(Patient $patient): static { $this->patient = $patient; return $this; }
    public function getMedecin(): ?Medecin { return $this->medecin; }
    public function setMedecin(Medecin $medecin): static { $this->medecin = $medecin; return $this; }
    public function getMotif(): string { return $this->motif; }
    public function setMotif(string $motif): static { $this->motif = $motif; return $this; }
    public function getDescription(): string { return $this->description; }
    public function setDescription(string $description): static { $this->description = $description; return $this; }
    public function getStatut(): string { return $this->statut; }
    public function setStatut(string $statut): static { $this->statut = $statut; return $this; }
    public function getNoteAdmin(): ?string { return $this->noteAdmin; }
    public function setNoteAdmin(?string $noteAdmin): static { $this->noteAdmin = $noteAdmin; return $this; }
    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }
    public function getUpdatedAt(): \DateTimeImmutable { return $this->updatedAt; }
    public function setUpdatedAt(\DateTimeImmutable $updatedAt): static { $this->updatedAt = $updatedAt; return $this; }
    public function getTraiteAt(): ?\DateTimeImmutable { return $this->traiteAt; }
    public function setTraiteAt(?\DateTimeImmutable $traiteAt): static { $this->traiteAt = $traiteAt; return $this; }
}
