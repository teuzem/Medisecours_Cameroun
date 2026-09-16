<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\MaladieSymptome;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<MaladieSymptome> */
class MaladieSymptomeRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, MaladieSymptome::class);
    }
}
