<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Patient;
use App\Entity\SignalementMedecin;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

class SignalementMedecinRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, SignalementMedecin::class);
    }

    /**
     * @return SignalementMedecin[]
     */
    public function findForPatient(Patient $patient): array
    {
        return $this->createQueryBuilder('signalement')
            ->andWhere('signalement.patient = :patient')
            ->setParameter('patient', $patient)
            ->orderBy('signalement.createdAt', 'DESC')
            ->getQuery()
            ->getResult();
    }
}
