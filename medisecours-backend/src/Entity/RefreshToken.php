<?php

declare(strict_types=1);

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
#[ORM\Table(name: 'refresh_token')]
#[ORM\Index(columns: ['token_hash'], name: 'idx_refresh_token_hash')]
#[ORM\Index(columns: ['user_id', 'revoked_at'], name: 'idx_refresh_token_user_revoked')]
class RefreshToken
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private ?User $user = null;

    #[ORM\Column(length: 64, unique: true)]
    private string $tokenHash;

    #[ORM\Column(length: 64)]
    private string $family;

    #[ORM\Column]
    private \DateTimeImmutable $expiresAt;

    #[ORM\Column(nullable: true)]
    private ?\DateTimeImmutable $revokedAt = null;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getUser(): ?User { return $this->user; }
    public function setUser(User $user): static { $this->user = $user; return $this; }
    public function getTokenHash(): string { return $this->tokenHash; }
    public function setTokenHash(string $tokenHash): static { $this->tokenHash = $tokenHash; return $this; }
    public function getFamily(): string { return $this->family; }
    public function setFamily(string $family): static { $this->family = $family; return $this; }
    public function getExpiresAt(): \DateTimeImmutable { return $this->expiresAt; }
    public function setExpiresAt(\DateTimeImmutable $expiresAt): static { $this->expiresAt = $expiresAt; return $this; }
    public function getRevokedAt(): ?\DateTimeImmutable { return $this->revokedAt; }
    public function revoke(): void { $this->revokedAt = new \DateTimeImmutable(); }
    public function isUsable(): bool { return $this->revokedAt === null && $this->expiresAt > new \DateTimeImmutable(); }
}
