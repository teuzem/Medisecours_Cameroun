<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\OrdonnancePharmacie;
use App\Entity\Prescription;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<OrdonnancePharmacie>
 */
class OrdonnancePharmacieRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, OrdonnancePharmacie::class);
    }

    public function findOneByPrescription(Prescription $prescription): ?OrdonnancePharmacie
    {
        return $this->findOneBy(['prescription' => $prescription]);
    }
}
