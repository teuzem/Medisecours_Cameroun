<?php

namespace App\Entity;

use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Post;
use ApiPlatform\Metadata\Delete;
use App\Repository\MediaObjectRepository;
use App\State\MediaObjectProcessor;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\HttpFoundation\File\File;
use Symfony\Component\Serializer\Annotation\Groups;
use Vich\UploaderBundle\Mapping\Annotation as Vich;

/**
 * Entité pour le suivi des fichiers téléversés (images, documents, etc.).
 */
#[ORM\Entity(repositoryClass: MediaObjectRepository::class)]
#[Vich\Uploadable]
#[ApiResource(
    operations: [
        new GetCollection(security: "is_granted('ROLE_ADMIN')"),
        new Get(security: "object.isPublic() or is_granted('ROLE_ADMIN') or (not object.isIdentityVerificationMedia() and object.getUploadedBy() == user)"),
        new Post(
            security: "is_granted('ROLE_ADMIN')",
            processor: MediaObjectProcessor::class,
            inputFormats: [
                'json' => ['application/json'],
                'multipart' => ['multipart/form-data'],
            ],
            denormalizationContext: ['groups' => ['media:write']],
        ),
        new Delete(security: "is_granted('ROLE_ADMIN') or (not object.isIdentityVerificationMedia() and object.getUploadedBy() == user)")
    ],
    normalizationContext: ['groups' => ['media:read']],
    denormalizationContext: ['groups' => ['media:write']],
    paginationEnabled: true,
    paginationItemsPerPage: 30,
    paginationMaximumItemsPerPage: 100
)]
class MediaObject
{
    public const PURPOSE_GENERAL = 'general';
    public const PURPOSE_IDENTITY_DOCUMENT = 'identity_document';
    public const PURPOSE_IDENTITY_PHOTO = 'identity_photo';

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['media:read', 'centre_sante:read', 'categorie:read', 'maladie:read'])]
    private ?int $id = null;

    #[Vich\UploadableField(mapping: 'media_object', fileNameProperty: 'filePath', size: 'size', mimeType: 'mimeType', originalName: 'originalName')]
    private ?File $file = null;

    #[ORM\Column(length: 255, nullable: true)]
    #[Groups(['media:read', 'centre_sante:read', 'categorie:read', 'maladie:read', 'message:read', 'conversation:read'])]
    private ?string $filePath = null;

    #[ORM\Column(length: 255, nullable: true)]
    #[Groups(['media:read', 'centre_sante:read', 'categorie:read', 'maladie:read', 'message:read', 'conversation:read'])]
    private ?string $originalName = null;

    #[ORM\Column(length: 100, nullable: true)]
    #[Groups(['media:read', 'centre_sante:read', 'categorie:read', 'maladie:read', 'message:read'])]
    private ?string $mimeType = null;

    #[ORM\Column(nullable: true)]
    #[Groups(['media:read', 'centre_sante:read', 'categorie:read', 'maladie:read', 'message:read', 'conversation:read'])]
    private ?int $size = null;

    /**
     * Contenu binaire du fichier, encodé en base64. Le stockage en base évite
     * la perte des fichiers lors des redéploiements (disque éphémère Render).
     * Jamais exposé via l'API (aucun groupe de sérialisation).
     */
    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $data = null;

    #[ORM\Column]
    #[Groups(['media:read', 'centre_sante:read', 'categorie:read', 'maladie:read'])]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column(nullable: true)]
    #[Groups(['media:read', 'centre_sante:read', 'categorie:read', 'maladie:read'])]
    private ?\DateTimeImmutable $updatedAt = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: true)]
    #[Groups(['media:read'])]
    private ?User $uploadedBy = null;

    #[ORM\ManyToOne(targetEntity: CentreDeSante::class, inversedBy: 'images')]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    #[Groups(['media:read'])]
    private ?CentreDeSante $centre = null;

    #[ORM\ManyToOne(targetEntity: Categorie::class, inversedBy: 'images')]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?Categorie $categorie = null;

    #[ORM\ManyToOne(targetEntity: Maladie::class, inversedBy: 'images')]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    #[Groups(['media:write', 'media:read'])]
    private ?Maladie $maladie = null;

    #[ORM\Column(type: 'boolean', options: ['default' => true])]
    private bool $isPublic = true;

    #[ORM\Column(length: 40, options: ['default' => self::PURPOSE_GENERAL])]
    private string $purpose = self::PURPOSE_GENERAL;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getFile(): ?File
    {
        return $this->file;
    }

    public function setFile(?File $file = null): static
    {
        $this->file = $file;

        if ($file !== null) {
            // Force Doctrine à détecter le changement en mettant à jour updatedAt
            $this->updatedAt = new \DateTimeImmutable();
        }

        return $this;
    }

    public function getFilePath(): ?string
    {
        return $this->filePath;
    }

    public function setFilePath(?string $filePath): static
    {
        $this->filePath = $filePath;

        return $this;
    }

    public function getOriginalName(): ?string
    {
        return $this->originalName;
    }

    public function setOriginalName(?string $originalName): static
    {
        $this->originalName = $originalName;

        return $this;
    }

    public function getMimeType(): ?string
    {
        return $this->mimeType;
    }

    public function setMimeType(?string $mimeType): static
    {
        $this->mimeType = $mimeType;

        return $this;
    }

    public function getSize(): ?int
    {
        return $this->size;
    }

    public function getData(): ?string
    {
        if ($this->data === null) {
            return null;
        }

        return base64_decode($this->data, true) ?: null;
    }

    public function setData(?string $data): static
    {
        $this->data = $data !== null ? base64_encode($data) : null;

        return $this;
    }

    #[Groups(['media:read', 'centre_sante:read', 'categorie:read', 'maladie:read', 'message:read', 'conversation:read'])]
    public function getContentUrl(): ?string
    {
        return $this->filePath ? '/api/media_objects/' . $this->id . '/download' : null;
    }

    public function isPublic(): bool
    {
        return $this->isPublic;
    }

    public function setIsPublic(bool $isPublic): static
    {
        $this->isPublic = $isPublic;

        return $this;
    }

    public function getPurpose(): string
    {
        return $this->purpose;
    }

    public function setPurpose(string $purpose): static
    {
        $this->purpose = $purpose;

        return $this;
    }

    public function isIdentityVerificationMedia(): bool
    {
        return in_array($this->purpose, [
            self::PURPOSE_IDENTITY_DOCUMENT,
            self::PURPOSE_IDENTITY_PHOTO,
        ], true);
    }

    public function setSize(?int $size): static
    {
        $this->size = $size;

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

    public function getUploadedBy(): ?User
    {
        return $this->uploadedBy;
    }

    public function setUploadedBy(?User $uploadedBy): static
    {
        $this->uploadedBy = $uploadedBy;

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

    public function getCategorie(): ?Categorie
    {
        return $this->categorie;
    }

    public function setCategorie(?Categorie $categorie): static
    {
        $this->categorie = $categorie;

        return $this;
    }

    public function getMaladie(): ?Maladie
    {
        return $this->maladie;
    }

    public function setMaladie(?Maladie $maladie): static
    {
        $this->maladie = $maladie;

        return $this;
    }
}
