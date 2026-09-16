<?php

declare(strict_types=1);

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(readOnly: true)]
#[ORM\Table(name: 'reference_data_version')]
class ReferenceDataVersion
{
    #[ORM\Id]
    #[ORM\Column(length: 100)]
    private string $dataset;

    #[ORM\Column(length: 80)]
    private string $catalogVersion;

    #[ORM\Column]
    private \DateTimeImmutable $appliedAt;

    public function getDataset(): string
    {
        return $this->dataset;
    }

    public function getCatalogVersion(): string
    {
        return $this->catalogVersion;
    }

    public function getAppliedAt(): \DateTimeImmutable
    {
        return $this->appliedAt;
    }
}
