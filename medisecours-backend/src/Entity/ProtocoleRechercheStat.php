<?php

declare(strict_types=1);

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

/**
 * Statistiques quotidiennes anonymisées des recherches de premiers gestes.
 * Aucune requête brute, aucun identifiant : uniquement des compteurs agrégés.
 */
#[ORM\Entity]
#[ORM\UniqueConstraint(name: 'uniq_protocole_recherche_stat_date', columns: ['stat_date'])]
class ProtocoleRechercheStat
{
    #[ORM\Id, ORM\GeneratedValue, ORM\Column]
    private ?int $id = null;

    #[ORM\Column(type: 'date_immutable')]
    private \DateTimeImmutable $statDate;

    #[ORM\Column]
    private int $totalCount = 0;

    #[ORM\Column]
    private int $withResultCount = 0;

    #[ORM\Column]
    private int $withoutResultCount = 0;

    public function __construct(\DateTimeImmutable $date)
    {
        $this->statDate = $date->setTime(0, 0);
    }

    public function getId(): ?int { return $this->id; }
    public function getStatDate(): \DateTimeImmutable { return $this->statDate; }
    public function getTotalCount(): int { return $this->totalCount; }
    public function getWithResultCount(): int { return $this->withResultCount; }
    public function getWithoutResultCount(): int { return $this->withoutResultCount; }

    public function record(bool $hasResult): void
    {
        ++$this->totalCount;
        if ($hasResult) {
            ++$this->withResultCount;
        } else {
            ++$this->withoutResultCount;
        }
    }
}
