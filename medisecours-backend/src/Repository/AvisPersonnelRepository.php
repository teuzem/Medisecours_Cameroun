<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\AvisPersonnel;
use App\Entity\PersonnelSante;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<AvisPersonnel>
 */
class AvisPersonnelRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, AvisPersonnel::class);
    }

    /**
     * Avis publiés d'un personnel, du plus récent au plus ancien.
     *
     * @return AvisPersonnel[]
     */
    public function findPublishedByPersonnel(PersonnelSante $personnel, int $limit = 50): array
    {
        return $this->createQueryBuilder('a')
            ->where('a.personnel = :personnel')
            ->setParameter('personnel', $personnel)
            ->andWhere('a.statut = :statut')
            ->setParameter('statut', AvisPersonnel::STATUT_PUBLIE)
            ->orderBy('a.createdAt', 'DESC')
            ->setMaxResults($limit)
            ->getQuery()
            ->getResult();
    }

    public function findOneByPersonnelAndPatient(PersonnelSante $personnel, \App\Entity\Patient $patient): ?AvisPersonnel
    {
        return $this->findOneBy(['personnel' => $personnel, 'patient' => $patient]);
    }

    /**
     * Note moyenne des avis publiés d'un personnel.
     */
    public function getNoteMoyenne(PersonnelSante $personnel): float
    {
        $moyenne = $this->createQueryBuilder('a')
            ->select('AVG(a.note) AS moyenne')
            ->where('a.personnel = :personnel')
            ->setParameter('personnel', $personnel)
            ->andWhere('a.statut = :statut')
            ->setParameter('statut', AvisPersonnel::STATUT_PUBLIE)
            ->getQuery()
            ->getSingleScalarResult();

        return $moyenne === null ? 0.0 : (float) $moyenne;
    }

    public function countPublished(PersonnelSante $personnel): int
    {
        return (int) $this->createQueryBuilder('a')
            ->select('COUNT(a.id)')
            ->where('a.personnel = :personnel')
            ->setParameter('personnel', $personnel)
            ->andWhere('a.statut = :statut')
            ->setParameter('statut', AvisPersonnel::STATUT_PUBLIE)
            ->getQuery()
            ->getSingleScalarResult();
    }

    /**
     * Répartition des notes (1 à 5) pour le graphique de notation.
     *
     * @return array<int, int>
     */
    public function getNoteDistribution(PersonnelSante $personnel): array
    {
        $lignes = $this->createQueryBuilder('a')
            ->select('a.note AS note, COUNT(a.id) AS total')
            ->where('a.personnel = :personnel')
            ->setParameter('personnel', $personnel)
            ->andWhere('a.statut = :statut')
            ->setParameter('statut', AvisPersonnel::STATUT_PUBLIE)
            ->groupBy('a.note')
            ->getQuery()
            ->getArrayResult();

        $distribution = [1 => 0, 2 => 0, 3 => 0, 4 => 0, 5 => 0];
        foreach ($lignes as $ligne) {
            $distribution[(int) $ligne['note']] = (int) $ligne['total'];
        }

        return $distribution;
    }
}
