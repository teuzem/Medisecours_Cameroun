<?php

declare(strict_types=1);

namespace App\Entity;

use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Delete;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Post;
use ApiPlatform\Metadata\Patch;
use App\Repository\PrescriptionRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Annotation\Groups;
use Symfony\Component\Validator\Constraints as Assert;

#[ORM\Entity(repositoryClass: PrescriptionRepository::class)]
#[ApiResource(
    operations: [
        new GetCollection(security: "is_granted('ROLE_MEDECIN') or is_granted('ROLE_PATIENT')"),
        new Get(security: "is_granted('ROLE_ADMIN') or object.getMedecin() == user or object.getPatient() == user"),
        new Post(security: "is_granted('ROLE_MEDECIN')", processor: \App\State\PrescriptionProcessor::class),
        new Patch(
            security: "is_granted('ROLE_MEDECIN') and object.getMedecin() == user",
            processor: \App\State\PrescriptionProcessor::class
        ),
        new Delete(
            security: "is_granted('ROLE_MEDECIN') and object.getMedecin() == user and object.getStatut() == 'BROUILLON'",
            processor: \App\State\PrescriptionDeleteProcessor::class
        ),
        new Post(
            uriTemplate: '/prescriptions/{id}/sign',
            requirements: ['id' => '\d+'],
            security: "is_granted('ROLE_MEDECIN')",
            input: false,
            read: false,
            processor: \App\State\PrescriptionSignProcessor::class,
            normalizationContext: ['groups' => ['prescription:read']],
        ),
        new Post(
            uriTemplate: '/prescriptions/{id}/send',
            requirements: ['id' => '\d+'],
            security: "is_granted('ROLE_MEDECIN')",
            input: false,
            read: false,
            processor: \App\State\PrescriptionSendProcessor::class,
            normalizationContext: ['groups' => ['prescription:read']],
        ),
        new Post(
            uriTemplate: '/prescriptions/{id}/cancel',
            requirements: ['id' => '\d+'],
            security: "is_granted('ROLE_MEDECIN')",
            input: false,
            read: false,
            processor: \App\State\PrescriptionCancelProcessor::class,
            normalizationContext: ['groups' => ['prescription:read']],
        ),
        new Post(
            uriTemplate: '/prescriptions/{id}/replace',
            requirements: ['id' => '\d+'],
            security: "is_granted('ROLE_MEDECIN')",
            input: false,
            read: false,
            processor: \App\State\PrescriptionReplaceProcessor::class,
            normalizationContext: ['groups' => ['prescription:read']],
        ),
    ],
    normalizationContext: ['groups' => ['prescription:read']],
    denormalizationContext: ['groups' => ['prescription:write']],
)]
class Prescription
{
    public const STATUT_BROUILLON = 'BROUILLON';
    public const STATUT_SIGNEE = 'SIGNEE';
    public const STATUT_TRANSMISE = 'TRANSMISE';
    public const STATUT_ANNULEE = 'ANNULEE';
    public const STATUT_EXPIREE = 'EXPIREE';
    public const STATUT_REMPLACEE = 'REMPLACEE';

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['prescription:read', 'consultation:read'])]
    private ?int $id = null;

    #[ORM\ManyToOne(inversedBy: 'prescriptions')]
    #[ORM\JoinColumn(nullable: false)]
    #[Groups(['prescription:read', 'prescription:write'])]
    private ?Consultation $consultation = null;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false)]
    #[Groups(['prescription:read'])]
    private ?Medecin $medecin = null;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false)]
    #[Groups(['prescription:read'])]
    private ?Patient $patient = null;

    #[ORM\Column(type: Types::TEXT)]
    #[Assert\NotBlank]
    #[Groups(['prescription:read', 'prescription:write', 'consultation:read'])]
    private ?string $diagnostic = null;

    /**
     * @var Collection<int, PrescriptionItem>
     */
    #[ORM\OneToMany(targetEntity: PrescriptionItem::class, mappedBy: 'prescription', cascade: ['persist', 'remove'])]
    #[Assert\Count(min: 1, minMessage: 'Au moins un médicament est requis.')]
    #[Groups(['prescription:read', 'prescription:write', 'consultation:read'])]
    private Collection $medicaments;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    #[Groups(['prescription:read', 'prescription:write', 'consultation:read'])]
    private ?string $recommandations = null;

    #[ORM\Column]
    #[Groups(['prescription:read'])]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column(length: 40, unique: true)]
    #[Groups(['prescription:read'])]
    private string $reference;

    #[ORM\Column(length: 20, options: ['default' => self::STATUT_BROUILLON])]
    #[Assert\Choice(choices: [
        self::STATUT_BROUILLON,
        self::STATUT_SIGNEE,
        self::STATUT_TRANSMISE,
        self::STATUT_ANNULEE,
        self::STATUT_EXPIREE,
        self::STATUT_REMPLACEE,
    ])]
    #[Groups(['prescription:read'])]
    private string $statut = self::STATUT_BROUILLON;

    #[ORM\Column]
    #[Groups(['prescription:read'])]
    private \DateTimeImmutable $updatedAt;

    #[ORM\Column(nullable: true)]
    #[Groups(['prescription:read'])]
    private ?\DateTimeImmutable $signedAt = null;

    #[ORM\Column(nullable: true)]
    #[Groups(['prescription:read', 'prescription:write'])]
    private ?\DateTimeImmutable $expiresAt = null;

    #[ORM\Column(nullable: true)]
    #[Groups(['prescription:read'])]
    private ?\DateTimeImmutable $cancelledAt = null;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    #[Groups(['prescription:read', 'prescription:write'])]
    private ?string $cancelReason = null;

    #[ORM\Column(nullable: true)]
    #[Groups(['prescription:read'])]
    private ?\DateTimeImmutable $sentAt = null;

    #[ORM\ManyToOne(targetEntity: Prescription::class)]
    #[ORM\JoinColumn(nullable: true)]
    #[Groups(['prescription:read'])]
    private ?Prescription $supersededBy = null;

    #[ORM\Column(options: ['default' => 1])]
    #[Groups(['prescription:read'])]
    private int $version = 1;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable();
        $this->updatedAt = $this->createdAt;
        $this->reference = 'ORD-' . strtoupper(bin2hex(random_bytes(5)));
        $this->medicaments = new ArrayCollection();
    }

    public function getId(): ?int { return $this->id; }

    public function getConsultation(): ?Consultation { return $this->consultation; }
    public function setConsultation(?Consultation $consultation): static { $this->consultation = $consultation; return $this; }

    public function getMedecin(): ?Medecin { return $this->medecin; }
    public function setMedecin(?Medecin $medecin): static { $this->medecin = $medecin; return $this; }

    public function getPatient(): ?Patient { return $this->patient; }
    public function setPatient(?Patient $patient): static { $this->patient = $patient; return $this; }

    public function getDiagnostic(): ?string { return $this->diagnostic; }
    public function setDiagnostic(?string $diagnostic): static { $this->diagnostic = $diagnostic; return $this; }

    /**
     * @return Collection<int, PrescriptionItem>
     */
    public function getMedicaments(): Collection { return $this->medicaments; }

    public function addMedicament(PrescriptionItem $item): static
    {
        if (!$this->medicaments->contains($item)) {
            $this->medicaments->add($item);
            $item->setPrescription($this);
        }
        return $this;
    }

    public function removeMedicament(PrescriptionItem $item): static
    {
        if ($this->medicaments->removeElement($item)) {
            if ($item->getPrescription() === $this) {
                $item->setPrescription(null);
            }
        }
        return $this;
    }

    public function getRecommandations(): ?string { return $this->recommandations; }
    public function setRecommandations(?string $recommandations): static { $this->recommandations = $recommandations; return $this; }

    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }

    public function getReference(): string { return $this->reference; }
    public function setReference(string $reference): static { $this->reference = $reference; return $this; }

    public function getStatut(): string { return $this->statut; }
    public function setStatut(string $statut): static
    {
        $this->statut = $statut;
        $this->updatedAt = new \DateTimeImmutable();
        if ($statut === self::STATUT_SIGNEE && $this->signedAt === null) {
            $this->signedAt = new \DateTimeImmutable();
        }
        if ($statut === self::STATUT_TRANSMISE && $this->sentAt === null) {
            $this->sentAt = new \DateTimeImmutable();
        }
        if ($statut === self::STATUT_ANNULEE && $this->cancelledAt === null) {
            $this->cancelledAt = new \DateTimeImmutable();
        }
        return $this;
    }

    public function getUpdatedAt(): \DateTimeImmutable { return $this->updatedAt; }
    public function setUpdatedAt(\DateTimeImmutable $updatedAt): static { $this->updatedAt = $updatedAt; return $this; }

    public function getSignedAt(): ?\DateTimeImmutable { return $this->signedAt; }
    public function setSignedAt(?\DateTimeImmutable $signedAt): static { $this->signedAt = $signedAt; return $this; }

    public function getExpiresAt(): ?\DateTimeImmutable { return $this->expiresAt; }
    public function setExpiresAt(?\DateTimeImmutable $expiresAt): static { $this->expiresAt = $expiresAt; return $this; }

    public function getCancelledAt(): ?\DateTimeImmutable { return $this->cancelledAt; }
    public function setCancelledAt(?\DateTimeImmutable $cancelledAt): static { $this->cancelledAt = $cancelledAt; return $this; }

    public function getCancelReason(): ?string { return $this->cancelReason; }
    public function setCancelReason(?string $cancelReason): static { $this->cancelReason = $cancelReason; return $this; }

    public function getVersion(): int { return $this->version; }
    public function setVersion(int $version): static { $this->version = $version; return $this; }

    public function getSentAt(): ?\DateTimeImmutable { return $this->sentAt; }
    public function setSentAt(?\DateTimeImmutable $sentAt): static { $this->sentAt = $sentAt; return $this; }

    public function getSupersededBy(): ?Prescription { return $this->supersededBy; }
    public function setSupersededBy(?Prescription $supersededBy): static { $this->supersededBy = $supersededBy; return $this; }

    public function isEditable(): bool
    {
        return $this->statut === self::STATUT_BROUILLON;
    }

    public function getStatutLabel(): string
    {
        return match ($this->statut) {
            self::STATUT_BROUILLON => 'Brouillon',
            self::STATUT_SIGNEE => 'Signée',
            self::STATUT_TRANSMISE => 'Transmise',
            self::STATUT_ANNULEE => 'Annulée',
            self::STATUT_EXPIREE => 'Expirée',
            self::STATUT_REMPLACEE => 'Remplacée',
            default => $this->statut,
        };
    }
}
