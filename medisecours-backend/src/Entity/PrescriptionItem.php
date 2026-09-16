<?php

declare(strict_types=1);

namespace App\Entity;

use ApiPlatform\Metadata\ApiResource;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Annotation\Groups;
use Symfony\Component\Validator\Constraints as Assert;

#[ORM\Entity]
#[ApiResource(
    operations: [],
)]
class PrescriptionItem
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['prescription:read', 'consultation:read'])]
    private ?int $id = null;

    #[ORM\ManyToOne(inversedBy: 'medicaments')]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private ?Prescription $prescription = null;

    #[ORM\Column(length: 255)]
    #[Assert\NotBlank]
    #[Groups(['prescription:read', 'prescription:write', 'consultation:read'])]
    private string $nom;

    #[ORM\Column(length: 255)]
    #[Assert\NotBlank]
    #[Groups(['prescription:read', 'prescription:write', 'consultation:read'])]
    private string $posologie;

    #[ORM\Column(length: 100, nullable: true)]
    #[Groups(['prescription:read', 'prescription:write', 'consultation:read'])]
    private ?string $duree = null;

    #[ORM\Column(length: 100, nullable: true)]
    #[Groups(['prescription:read', 'prescription:write', 'consultation:read'])]
    private ?string $forme = null;

    #[ORM\Column(nullable: true)]
    #[Groups(['prescription:read', 'prescription:write', 'consultation:read'])]
    private ?float $dosage = null;

    #[ORM\Column(length: 50, nullable: true)]
    #[Groups(['prescription:read', 'prescription:write', 'consultation:read'])]
    private ?string $unite = null;

    #[ORM\Column(length: 100, nullable: true)]
    #[Groups(['prescription:read', 'prescription:write', 'consultation:read'])]
    private ?string $voieAdministration = null;

    #[ORM\Column(length: 100, nullable: true)]
    #[Groups(['prescription:read', 'prescription:write', 'consultation:read'])]
    private ?string $frequence = null;

    #[ORM\Column(length: 100, nullable: true)]
    #[Groups(['prescription:read', 'prescription:write', 'consultation:read'])]
    private ?string $momentPrise = null;

    #[ORM\Column(nullable: true)]
    #[Groups(['prescription:read', 'prescription:write', 'consultation:read'])]
    private ?int $dureeJours = null;

    #[ORM\Column(nullable: true)]
    #[Groups(['prescription:read', 'prescription:write', 'consultation:read'])]
    private ?float $quantite = null;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    #[Groups(['prescription:read', 'prescription:write', 'consultation:read'])]
    private ?string $instructions = null;

    #[ORM\Column(options: ['default' => false])]
    #[Groups(['prescription:read', 'prescription:write', 'consultation:read'])]
    private bool $siBesoin = false;

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

    public function getNom(): string
    {
        return $this->nom;
    }

    public function setNom(string $nom): static
    {
        $this->nom = $nom;

        return $this;
    }

    public function getPosologie(): string
    {
        return $this->posologie;
    }

    public function setPosologie(string $posologie): static
    {
        $this->posologie = $posologie;

        return $this;
    }

    public function getDuree(): ?string
    {
        return $this->duree;
    }

    public function setDuree(?string $duree): static
    {
        $this->duree = $duree;

        return $this;
    }

    public function getForme(): ?string
    {
        return $this->forme;
    }

    public function setForme(?string $forme): static
    {
        $this->forme = $forme;

        return $this;
    }

    public function getDosage(): ?float
    {
        return $this->dosage;
    }

    public function setDosage(?float $dosage): static
    {
        $this->dosage = $dosage;

        return $this;
    }

    public function getUnite(): ?string
    {
        return $this->unite;
    }

    public function setUnite(?string $unite): static
    {
        $this->unite = $unite;

        return $this;
    }

    public function getVoieAdministration(): ?string
    {
        return $this->voieAdministration;
    }

    public function setVoieAdministration(?string $voieAdministration): static
    {
        $this->voieAdministration = $voieAdministration;

        return $this;
    }

    public function getFrequence(): ?string
    {
        return $this->frequence;
    }

    public function setFrequence(?string $frequence): static
    {
        $this->frequence = $frequence;

        return $this;
    }

    public function getMomentPrise(): ?string
    {
        return $this->momentPrise;
    }

    public function setMomentPrise(?string $momentPrise): static
    {
        $this->momentPrise = $momentPrise;

        return $this;
    }

    public function getDureeJours(): ?int
    {
        return $this->dureeJours;
    }

    public function setDureeJours(?int $dureeJours): static
    {
        $this->dureeJours = $dureeJours;

        return $this;
    }

    public function getQuantite(): ?float
    {
        return $this->quantite;
    }

    public function setQuantite(?float $quantite): static
    {
        $this->quantite = $quantite;

        return $this;
    }

    public function getInstructions(): ?string
    {
        return $this->instructions;
    }

    public function setInstructions(?string $instructions): static
    {
        $this->instructions = $instructions;

        return $this;
    }

    public function isSiBesoin(): bool
    {
        return $this->siBesoin;
    }

    public function setSiBesoin(bool $siBesoin): static
    {
        $this->siBesoin = $siBesoin;

        return $this;
    }
}
