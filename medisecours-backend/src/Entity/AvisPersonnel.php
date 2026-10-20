<?php

declare(strict_types=1);

namespace App\Entity;

use App\Repository\AvisPersonnelRepository;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Annotation\Groups;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * Avis laissé par un patient sur un personnel de santé (infirmier, aide-
 * soignant, pharmacien, réceptionniste, ambulancier).
 *
 * - Un avis par patient et par personnel (unicité en base).
 * - L'auteur est toujours le patient connecté (injecté par le contrôleur).
 * - Les agrégats (note moyenne, total) sont recalculés après chaque écriture
 *   et stockés sur l'utilisateur : le profil public et les tableaux de bord
 *   ne repassent jamais par un calcul à la volée.
 * - Règle de sécurité : une note moyenne inférieure à 2 étoiles entraîne le
 *   bannissement automatique du personnel (cf. AvisPersonnelController).
 */
#[ORM\Entity(repositoryClass: AvisPersonnelRepository::class)]
class AvisPersonnel
{
    public const STATUT_PUBLIE = 'PUBLIE';
    public const STATUT_REJETE = 'REJETE';

    /**
     * Nombre d'avis minimal avant application automatique de la règle de
     * bannissement. Sans plancher, un avis isolé pourrait exclure un
     * professionnel ; trois avis permettent de parler d'une tendance.
     */
    public const SEUIL_AVIS_BANNISSEMENT = 3;

    /**
     * Note moyenne en dessous de laquelle le personnel est banni.
     */
    public const SEUIL_NOTE_BANNISSEMENT = 2.0;

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['avis_personnel:read'])]
    private ?int $id = null;

    /**
     * Personnel de santé noté.
     */
    #[ORM\ManyToOne(targetEntity: PersonnelSante::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    #[Groups(['avis_personnel:read'])]
    private ?PersonnelSante $personnel = null;

    /**
     * Patient auteur de l'avis.
     */
    #[ORM\ManyToOne(targetEntity: Patient::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    #[Groups(['avis_personnel:read'])]
    private ?Patient $patient = null;

    #[ORM\Column(type: 'smallint')]
    #[Assert\Range(min: 1, max: 5, notInRangeMessage: 'La note doit être comprise entre {{ min }} et {{ max }}.')]
    #[Groups(['avis_personnel:read', 'avis_personnel:write'])]
    private ?int $note = null;

    #[ORM\Column(type: 'text', nullable: true)]
    #[Assert\Length(min: 5, max: 2000, minMessage: 'Le commentaire doit faire au moins {{ limit }} caractères.', maxMessage: 'Le commentaire ne peut pas dépasser {{ limit }} caractères.')]
    #[Groups(['avis_personnel:read', 'avis_personnel:write'])]
    private ?string $commentaire = null;

    #[ORM\Column(length: 20, options: ['default' => self::STATUT_PUBLIE])]
    #[Groups(['avis_personnel:read'])]
    private string $statut = self::STATUT_PUBLIE;

    #[ORM\Column(type: 'boolean', options: ['default' => false])]
    #[Groups(['avis_personnel:read'])]
    private bool $signale = false;

    #[ORM\Column]
    #[Groups(['avis_personnel:read'])]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column(nullable: true)]
    #[Groups(['avis_personnel:read'])]
    private ?\DateTimeImmutable $updatedAt = null;

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

    public function getPatient(): ?Patient
    {
        return $this->patient;
    }

    public function setPatient(?Patient $patient): static
    {
        $this->patient = $patient;

        return $this;
    }

    public function getNote(): ?int
    {
        return $this->note;
    }

    public function setNote(?int $note): static
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

    public function getStatut(): string
    {
        return $this->statut;
    }

    public function setStatut(string $statut): static
    {
        $this->statut = $statut;

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
