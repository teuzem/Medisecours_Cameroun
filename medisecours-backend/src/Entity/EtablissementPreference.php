<?php

declare(strict_types=1);

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

/**
 * Préférences de personnalisation d'un établissement.
 *
 * Une ligne par centre (id = centre_id) : réglages d'affichage de l'espace
 * structure (accent, sirène SOS, densité, animations, surface, hero cover),
 * persistés côté serveur pour que tous les managers partagent la même
 * configuration — localStorage ne servant plus que de cache client.
 *
 * Entité interne — exposée uniquement via /api/carte/mon-etablissement/preferences
 * (restreinte aux managers de l'établissement et aux admins).
 */
#[ORM\Entity]
#[ORM\Table(name: 'etablissement_preference')]
class EtablissementPreference
{
    #[ORM\Id]
    #[ORM\OneToOne(targetEntity: CentreDeSante::class)]
    #[ORM\JoinColumn(name: 'centre_id', nullable: false, onDelete: 'CASCADE')]
    private ?CentreDeSante $centre = null;

    /**
     * Preferences validées : accent, showSos, compact, animations,
     * surface, showHeroCover.
     */
    #[ORM\Column(type: 'json')]
    private array $data = [];

    #[ORM\Column]
    private \DateTimeImmutable $updatedAt;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(name: 'updated_by', nullable: true, onDelete: 'SET NULL')]
    private ?User $updatedBy = null;

    public function __construct()
    {
        $this->updatedAt = new \DateTimeImmutable();
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

    public function getData(): array
    {
        return $this->data;
    }

    public function setData(array $data): static
    {
        $this->data = $data;

        return $this;
    }

    public function getUpdatedAt(): \DateTimeImmutable
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(\DateTimeImmutable $updatedAt): static
    {
        $this->updatedAt = $updatedAt;

        return $this;
    }

    public function getUpdatedBy(): ?User
    {
        return $this->updatedBy;
    }

    public function setUpdatedBy(?User $updatedBy): static
    {
        $this->updatedBy = $updatedBy;

        return $this;
    }
}
