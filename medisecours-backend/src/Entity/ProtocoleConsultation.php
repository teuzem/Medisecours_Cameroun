<?php

declare(strict_types=1);

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

/**
 * Journal anonyme des versions de protocoles consultées.
 * Aucune donnée personnelle ni identifiable n'y est enregistrée.
 */
#[ORM\Entity]
#[ORM\Index(name: 'idx_protocole_consultation_date', columns: ['consulted_at'])]
class ProtocoleConsultation
{
    #[ORM\Id, ORM\GeneratedValue, ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: 120)]
    private string $slug;

    #[ORM\Column(length: 40)]
    private string $version;

    #[ORM\Column]
    private \DateTimeImmutable $consultedAt;

    public function __construct(string $slug, string $version)
    {
        $this->slug = $slug;
        $this->version = $version;
        $this->consultedAt = new \DateTimeImmutable();
    }

    public function getId(): ?int { return $this->id; }
    public function getSlug(): string { return $this->slug; }
    public function getVersion(): string { return $this->version; }
    public function getConsultedAt(): \DateTimeImmutable { return $this->consultedAt; }
}
