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
 * - Cycle de vie complet (workflow SOS) :
 *     EN_COURS → VERIFIEE → EN_PRISE_EN_CHARGE → TRAITEE
 *              ↘ FRAUDULEUSE / CLOTUREE
 * - Vérification par la caméra : la preuve photo (`preuvePhoto`) est capturée
 *   côté client et l'équipe de l'établissement confirme la réalité (sirène)
 *   ou la fausseté (clôture frauduleuse, tracée).
 * - Prise en charge : validée en temps réel (affiliation ACCEPTEE) via
 *   /api/sos/{id}/prise-en-charge ; chaque transition est journalisée
 *   dans `sos_trace` (traçabilité complète).
 * - Flux temps réel : événements WebSocket ciblés à chaque transition.
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

    /**
     * Établissement ciblé par l'alerte (choisi sur la fiche ou le plus proche).
     * L'équipe de cet établissement reçoit les événements temps réel et
     * peut vérifier la réalité de l'urgence (sirène) et la prendre en charge.
     */
    #[ORM\ManyToOne(targetEntity: CentreDeSante::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    #[Groups(['demande_sos:read'])]
    private ?CentreDeSante $etablissement = null;

    /**
     * Propriété transitoire de confort pour la création :
     * `{"etablissementId": 12}` — convertie en relation par le processor.
     */
    #[Groups(['demande_sos:write'])]
    private ?int $etablissementId = null;

    /**
     * Preuve photo capturée par la caméra du demandeur (JPEG base64).
     * Permets à l'équipe de vérifier la réalité de l'urgence.
     */
    #[ORM\Column(type: 'text', nullable: true)]
    #[Groups(['demande_sos:write'])]
    private ?string $preuvePhoto = null;

    /**
     * Propriété transitoire : le client déclare l'absence de caméra
     * (aucun appareil / permission refusée) — tracé dans sos_trace.
     */
    #[Groups(['demande_sos:write'])]
    private bool $preuveIndisponible = false;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    #[Groups(['demande_sos:read'])]
    private ?User $verifiePar = null;

    #[ORM\Column(nullable: true)]
    #[Groups(['demande_sos:read'])]
    private ?\DateTimeImmutable $verifieAt = null;

    #[ORM\Column(type: 'text', nullable: true)]
    #[Groups(['demande_sos:read'])]
    private ?string $verificationComment = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    #[Groups(['demande_sos:read'])]
    private ?User $prisEnChargePar = null;

    #[ORM\Column(nullable: true)]
    #[Groups(['demande_sos:read'])]
    private ?\DateTimeImmutable $prisEnChargeAt = null;

    #[ORM\Column(nullable: true)]
    #[Groups(['demande_sos:read'])]
    private ?\DateTimeImmutable $resoluAt = null;

    /**
     * Sirène active sur les postes de l'établissement (après confirmation).
     */
    #[ORM\Column(type: 'boolean', options: ['default' => false])]
    #[Groups(['demande_sos:read'])]
    private bool $sireneActive = false;

    /**
     * Jeton de suivi anonyme (SOS sans compte) — renvoyé à la création,
     * permet de suivre l'alerte via /api/sos/{id}/suivi?token=… sans auth.
     */
    #[ORM\Column(length: 64, nullable: true)]
    #[Groups(['demande_sos:read'])]
    private ?string $suiviToken = null;

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

    public function getEtablissement(): ?CentreDeSante
    {
        return $this->etablissement;
    }

    public function setEtablissement(?CentreDeSante $etablissement): static
    {
        $this->etablissement = $etablissement;

        return $this;
    }

    public function getEtablissementId(): ?int
    {
        return $this->etablissementId;
    }

    public function setEtablissementId(?int $etablissementId): static
    {
        $this->etablissementId = $etablissementId;

        return $this;
    }

    public function getPreuvePhoto(): ?string
    {
        return $this->preuvePhoto;
    }

    public function setPreuvePhoto(?string $preuvePhoto): static
    {
        $this->preuvePhoto = $preuvePhoto;

        return $this;
    }

    public function isPreuveIndisponible(): bool
    {
        return $this->preuveIndisponible;
    }

    public function setPreuveIndisponible(bool $preuveIndisponible): static
    {
        $this->preuveIndisponible = $preuveIndisponible;

        return $this;
    }

    public function getVerifiePar(): ?User
    {
        return $this->verifiePar;
    }

    public function setVerifiePar(?User $verifiePar): static
    {
        $this->verifiePar = $verifiePar;

        return $this;
    }

    public function getVerifieAt(): ?\DateTimeImmutable
    {
        return $this->verifieAt;
    }

    public function setVerifieAt(?\DateTimeImmutable $verifieAt): static
    {
        $this->verifieAt = $verifieAt;

        return $this;
    }

    public function getVerificationComment(): ?string
    {
        return $this->verificationComment;
    }

    public function setVerificationComment(?string $verificationComment): static
    {
        $this->verificationComment = $verificationComment;

        return $this;
    }

    public function getPrisEnChargePar(): ?User
    {
        return $this->prisEnChargePar;
    }

    public function setPrisEnChargePar(?User $prisEnChargePar): static
    {
        $this->prisEnChargePar = $prisEnChargePar;

        return $this;
    }

    public function getPrisEnChargeAt(): ?\DateTimeImmutable
    {
        return $this->prisEnChargeAt;
    }

    public function setPrisEnChargeAt(?\DateTimeImmutable $prisEnChargeAt): static
    {
        $this->prisEnChargeAt = $prisEnChargeAt;

        return $this;
    }

    public function getResoluAt(): ?\DateTimeImmutable
    {
        return $this->resoluAt;
    }

    public function setResoluAt(?\DateTimeImmutable $resoluAt): static
    {
        $this->resoluAt = $resoluAt;

        return $this;
    }

    public function isSireneActive(): bool
    {
        return $this->sireneActive;
    }

    public function setSireneActive(bool $sireneActive): static
    {
        $this->sireneActive = $sireneActive;

        return $this;
    }

    public function getSuiviToken(): ?string
    {
        return $this->suiviToken;
    }

    public function setSuiviToken(?string $suiviToken): static
    {
        $this->suiviToken = $suiviToken;

        return $this;
    }
}