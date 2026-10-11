<?php

declare(strict_types=1);

namespace App\Entity;

use App\Repository\SignatureNumeriqueRepository;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Annotation\Groups;

/**
 * Signature numérique manuscrite d'un utilisateur (médecin ou dirigeant).
 *
 * Stockée sous forme de data URI PNG (canvas de la signature pad) avec
 * empreinte SHA-256 côté serveur : toute altération ultérieure de l'image
 * casse l'empreinte → non-répudiation.
 *
 * Une seule signature active par utilisateur ; l'historique est conservé
 * (estActive = false) pour la piste d'audit.
 */
#[ORM\Entity(repositoryClass: SignatureNumeriqueRepository::class)]
#[ORM\Table(name: 'signature_numerique')]
#[ORM\Index(name: 'IDX_SIGNATURE_USER_ACTIVE', columns: ['utilisateur_id', 'est_active'])]
class SignatureNumerique
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(name: 'utilisateur_id', nullable: false, onDelete: 'CASCADE')]
    private ?User $utilisateur = null;

    /**
     * Data URI (data:image/png;base64,...) de la signature dessinée.
     *
     * @Groups(['signature:read'])
     */
    #[ORM\Column(type: 'text')]
    private ?string $imageData = null;

    /**
     * Empreinte SHA-256 hexadécimale de la chaîne imageData.
     *
     * @Groups(['signature:read'])
     */
    #[ORM\Column(length: 64)]
    private string $hashSha256 = '';

    /**
     * Grade académique/professionnel optionnel (Pr, Dr, Sr…).
     *
     * @Groups(['signature:read'])
     */
    #[ORM\Column(length: 120, nullable: true)]
    private ?string $grade = null;

    /**
     * @Groups(['signature:read'])
     */
    #[ORM\Column]
    private \DateTimeImmutable $signedAt;

    #[ORM\Column(options: ['default' => true])]
    private bool $estActive = true;

    public function __construct()
    {
        $this->signedAt = new \DateTimeImmutable();
    }

    public function getId(): ?int { return $this->id; }

    public function getUtilisateur(): ?User { return $this->utilisateur; }
    public function setUtilisateur(?User $utilisateur): static { $this->utilisateur = $utilisateur; return $this; }

    public function getImageData(): ?string { return $this->imageData; }
    public function setImageData(?string $imageData): static { $this->imageData = $imageData; return $this; }

    public function getHashSha256(): string { return $this->hashSha256; }
    public function setHashSha256(string $hashSha256): static { $this->hashSha256 = $hashSha256; return $this; }

    public function getGrade(): ?string { return $this->grade; }
    public function setGrade(?string $grade): static { $this->grade = $grade; return $this; }

    public function getSignedAt(): \DateTimeImmutable { return $this->signedAt; }
    public function setSignedAt(\DateTimeImmutable $signedAt): static { $this->signedAt = $signedAt; return $this; }

    public function isEstActive(): bool { return $this->estActive; }
    public function setEstActive(bool $estActive): static { $this->estActive = $estActive; return $this; }
}
