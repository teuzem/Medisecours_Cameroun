<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\AvisEtablissement;
use App\Entity\AvisJaime;
use App\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<AvisJaime>
 */
class AvisJaimeRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, AvisJaime::class);
    }

    public function findOneByAvisAndUser(AvisEtablissement $avis, User $user): ?AvisJaime
    {
        return $this->findOneBy(['avis' => $avis, 'user' => $user]);
    }

    /**
     * Nombre de « J'aime » par avis, en une seule requête.
     *
     * La jointure est explicite et le regroupement porte sur `a.id` (un
     * scalaire) : grouper sur l'association elle-même (`GROUP BY j.avis`)
     * produit une requête invalide selon la version de Doctrine.
     *
     * @param int[] $avisIds
     *
     * @return array<int, int> indexé par identifiant d'avis (0 si absent)
     */
    public function countByAvis(array $avisIds): array
    {
        if ($avisIds === []) {
            return [];
        }

        $rows = $this->createQueryBuilder('j')
            ->select('a.id AS avisId', 'COUNT(j.id) AS total')
            ->join('j.avis', 'a')
            ->where('a.id IN (:ids)')
            ->setParameter('ids', $avisIds)
            ->groupBy('a.id')
            ->getQuery()
            ->getArrayResult();

        $counts = array_fill_keys($avisIds, 0);
        foreach ($rows as $row) {
            $counts[(int) $row['avisId']] = (int) $row['total'];
        }

        return $counts;
    }

    public function countForAvis(AvisEtablissement $avis): int
    {
        return (int) $this->createQueryBuilder('j')
            ->select('COUNT(j.id) AS total')
            ->join('j.avis', 'a')
            ->where('a.id = :id')
            ->setParameter('id', $avis->getId())
            ->getQuery()
            ->getSingleScalarResult();
    }

    /**
     * Identifiants des avis déjà aimés par cet utilisateur.
     *
     * @param int[] $avisIds
     *
     * @return int[]
     */
    public function likedAvisIds(User $user, array $avisIds): array
    {
        if ($avisIds === []) {
            return [];
        }

        $rows = $this->createQueryBuilder('j')
            ->select('a.id AS avisId')
            ->join('j.avis', 'a')
            ->where('j.user = :user')
            ->andWhere('a.id IN (:ids)')
            ->setParameter('user', $user)
            ->setParameter('ids', $avisIds)
            ->getQuery()
            ->getArrayResult();

        return array_map(static fn (array $row): int => (int) $row['avisId'], $rows);
    }
}