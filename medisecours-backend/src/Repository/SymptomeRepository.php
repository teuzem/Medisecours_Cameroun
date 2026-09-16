<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Symptome;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<Symptome> */
class SymptomeRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Symptome::class);
    }

    public function findOneBySlug(string $slug): ?Symptome
    {
        return $this->findOneBy(['slug' => $slug]);
    }
}
