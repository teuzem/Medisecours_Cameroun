<?php

namespace App\Repository;

use App\Entity\Consultation;
use App\Entity\Medecin;
use App\Entity\Patient;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<Consultation>
 */
class ConsultationRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Consultation::class);
    }

    public function hasCompletedConsultation(Patient $patient, Medecin $medecin): bool
    {
        return (int) $this->createQueryBuilder('c')
            ->select('COUNT(c.id)')
            ->where('c.patient = :patient')
            ->andWhere('c.medecin = :medecin')
            ->andWhere('c.statut = :status')
            ->setParameter('patient', $patient)
            ->setParameter('medecin', $medecin)
            ->setParameter('status', Consultation::STATUT_TERMINEE)
            ->getQuery()
            ->getSingleScalarResult() > 0;
    }

    /**
     * @return array{total: int, pending: int, inProgress: int, finished: int, cancelled: int}
     */
    public function countByStatusForPatient(Patient $patient): array
    {
        $rows = $this->createQueryBuilder('c')
            ->select('c.statut AS status, COUNT(c.id) AS total')
            ->where('c.patient = :patient')
            ->setParameter('patient', $patient)
            ->groupBy('c.statut')
            ->getQuery()
            ->getArrayResult();

        $counts = [
            Consultation::STATUT_OUVERTE => 0,
            Consultation::STATUT_EN_COURS => 0,
            Consultation::STATUT_TERMINEE => 0,
            Consultation::STATUT_ANNULEE => 0,
        ];

        foreach ($rows as $row) {
            $counts[$row['status']] = (int) $row['total'];
        }

        return [
            'total' => array_sum($counts),
            'pending' => $counts[Consultation::STATUT_OUVERTE],
            'inProgress' => $counts[Consultation::STATUT_EN_COURS],
            'finished' => $counts[Consultation::STATUT_TERMINEE],
            'cancelled' => $counts[Consultation::STATUT_ANNULEE],
        ];
    }
}
