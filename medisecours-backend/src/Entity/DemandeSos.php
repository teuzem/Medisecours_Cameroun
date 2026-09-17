<?php

declare(strict_types=1);

namespace App\Entity;

use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Delete;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Post;
use App\Repository\DemandeSosRepository;
use App\State\DemandeSosProcessor;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Annotation\Groups;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * Demande SOS émise depuis la carte Santé.
 *
 * - Accessible sans authentification : n'importe qui peut demander de l'aide.
 * - Le processor calcule automatiquement les établissements les plus proches
 *   (rayon 50 km, limit 8) et les enregistre dans `proches` pour restitution immédiate.
 * - Flux temps réel : un événement WebSocket est émis à la création.
 */
#[ORM\Entity(repositoryClass: DemandeSosRepository::class)]
#[ApiResource(
    operations: [
        // Fil d'actualité SOS : admin uniquement (monitoring central)
        new GetCollection(security: "is_granted('ROLE_ADMIN')", paginationEnabled: false, order: ['createdAt' => 'DESC']),
        new Get(security: "is_granted('ROLE_ADMIN') or (object.getUser() != null and object.getUser() == user)"),
        // Envoi d'une alerte : public (authentifié ou non)
        new Post(
            processor: DemandeSosProcessor::class,
            write: true,
            normalizationContext: ['groups' => ['demande_sos:read']]
        ),
        new Delete(security: "is_granted('ROLE_ADMIN')")
    ],
    normalizationContext: ['groups' => ['demande_sos:read']],
    denormalizationContext: ['groups' => ['demande_sos:write']]
)]
class DemandeSos
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['demande_sos:read'])]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    #[Groups(['demande_sos:read'])]
    private ?User $user = null;

    #[ORM\Column(length: 255, nullable: true)]
    #[Groups(['demande_sos:read', 'demande_sos:write'])]
    private ?string $nom = null;

    #[ORM\Column(length: 255, nullable: true)]
    #[Groups(['demande_sos:read', 'demande_sos:write'])]
    private ?string $telephone = null;

    #[ORM\Column]
    #[Assert\NotBlank(message: 'La latitude est obligatoire')]
    #[Assert\Range(min: -90, max: 90)]
    #[Groups(['demande_sos:read', 'demande_sos:write'])]
    private ?float $latitude = null;

    #[ORM\Column]
    #[Assert\NotBlank(message: 'La longitude est obligatoire')]
    #[Assert\Range(min: -180, max: 180)]
    #[Groups(['demande_sos:read', 'demande_sos:write'])]
    private ?float $longitude = null;

    #[ORM\Column(type: 'text', nullable: true)]
    #[Groups(['demande_sos:read', 'demande_sos:write'])]
    private ?string $description = null;

    #[ORM\Column(length: 20, options: ['default' => 'EN_COURS'])]
    #[Groups(['demande_sos:read'])]
    private string $statut = 'EN_COURS';

    /**
     * Établissements les plus proches calculés au moment de l'alerte.
     * Format : [{"id": 12, "nom": "...", "distance": 1.2, "telephone": "...", "type": "...", "ville": "...", "adresse": "...", "urgences24h": true}]
     */
    #[ORM\Column(type: 'json', nullable: true)]
    #[Groups(['demande_sos:read'])]
    private ?array $proches = null;

    #[ORM\Column]
    #[Groups(['demande_sos:read'])]
    private \DateTimeImmutable $createdAt;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getUser(): ?User
    {
        return $this->user;
    }

    public function setUser(?User $user): static
    {
        $this->user = $user;

        return $this;
    }

    public function getNom(): ?string
    {
        return $this->nom;
    }

    public function setNom(?string $nom): static
    {
        $this->nom = $nom;

        return $this;
    }

    public function getTelephone(): ?string
    {
        return $this->telephone;
    }

    public function setTelephone(?string $telephone): static
    {
        $this->telephone = $telephone;

        return $this;
    }

    public function getLatitude(): ?float
    {
        return $this->latitude;
    }

    public function setLatitude(?float $latitude): static
    {
        $this->latitude = $latitude;

        return $this;
    }

    public function getLongitude(): ?float
    {
        return $this->longitude;
    }

    public function setLongitude(?float $longitude): static
    {
        $this->longitude = $longitude;

        return $this;
    }

    public function getDescription(): ?string
    {
        return $this->description;
    }

    public function setDescription(?string $description): static
    {
        $this->description = $description;

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

    public function getProches(): ?array
    {
        return $this->proches;
    }

    public function setProches(?array $proches): static
    {
        $this->proches = $proches;

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
}