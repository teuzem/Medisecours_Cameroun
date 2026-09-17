<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\SuggestionEtablissement;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<SuggestionEtablissement>
 */
class SuggestionEtablissementRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, SuggestionEtablissement::class);
    }
}