<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Avis;
use App\Entity\Medecin;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<Avis>
 */
class AvisRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Avis::class);
    }

    /**
     * Calcule la note moyenne d'un médecin (utilisée pour afficher ★★★★☆).
     */
    public function getNoteMoyenne(Medecin $medecin): float
    {
        $result = $this->createQueryBuilder('a')
            ->select('AVG(a.note) as moyenne')
            ->where('a.medecin = :medecin')
            ->andWhere('a.signale = false')
            ->setParameter('medecin', $medecin)
            ->getQuery()
            ->getSingleScalarResult();

        return round((float) $result, 1);
    }

    public function countPublishedByMedecin(Medecin $medecin): int
    {
        return (int) $this->createQueryBuilder('a')
            ->select('COUNT(a.id)')
            ->where('a.medecin = :medecin')
            ->andWhere('a.signale = false')
            ->setParameter('medecin', $medecin)
            ->getQuery()
            ->getSingleScalarResult();
    }

    /**
     * Distribution des notes d'un médecin par étoile (1..5), indexée par note.
     *
     * @return array<int, int> [1 => n, 2 => n, ... 5 => n]
     */
    public function getNoteDistribution(Medecin $medecin): array
    {
        $rows = $this->createQueryBuilder('a')
            ->select('a.note AS note, COUNT(a.id) AS total')
            ->where('a.medecin = :medecin')
            ->andWhere('a.signale = false')
            ->andWhere('a.note BETWEEN 1 AND 5')
            ->setParameter('medecin', $medecin)
            ->groupBy('a.note')
            ->getQuery()
            ->getResult();

        $distribution = [1 => 0, 2 => 0, 3 => 0, 4 => 0, 5 => 0];
        foreach ($rows as $row) {
            $note = (int) $row['note'];
            if (isset($distribution[$note])) {
                $distribution[$note] = (int) $row['total'];
            }
        }

        return $distribution;
    }

    /**
     * Retourne les avis signalés en attente de modération.
     *
     * @return Avis[]
     */
    public function findSignales(): array
    {
        return $this->createQueryBuilder('a')
            ->where('a.signale = true')
            ->orderBy('a.createdAt', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Retourne les avis d'un médecin, sans les avis signalés.
     *
     * @return Avis[]
     */
    public function findByMedecin(Medecin $medecin): array
    {
        return $this->createQueryBuilder('a')
            ->where('a.medecin = :medecin')
            ->andWhere('a.signale = false')
            ->setParameter('medecin', $medecin)
            ->orderBy('a.createdAt', 'DESC')
            ->getQuery()
            ->getResult();
    }
}
