<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\AvisEtablissement;
use App\Entity\CentreDeSante;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<AvisEtablissement>
 */
class AvisEtablissementRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, AvisEtablissement::class);
    }

    /**
     * Avis publiés d'un établissement (exposition publique).
     *
     * @return AvisEtablissement[]
     */
    public function findPublicByEtablissement(?int $etablissementId = null, ?int $note = null): array
    {
        $qb = $this->createQueryBuilder('a')
            ->where('a.statut = :statut')
            ->setParameter('statut', 'PUBLIE')
            ->orderBy('a.createdAt', 'DESC');

        if ($etablissementId !== null) {
            $qb->andWhere('a.etablissement = :etablissement')
                ->setParameter('etablissement', $etablissementId);
        }

        if ($note !== null) {
            $qb->andWhere('a.note = :note')
                ->setParameter('note', $note);
        }

        return $qb->getQuery()->getResult();
    }

    /**
     * Recalcule et met à jour la note moyenne et le total d'avis publiés d'un
     * établissement. Appelé après publication / modération d'un avis.
     */
    public function refreshAggregates(CentreDeSante $etablissement): void
    {
        $em = $this->getEntityManager();

        $sql = <<<SQL
            SELECT
                COALESCE(AVG(a.note), 0) AS note_moyenne,
                COUNT(a.id) AS total_avis
            FROM avis_etablissement a
            WHERE a.etablissement_id = :id
              AND a.statut = 'PUBLIE'
        SQL;

        $row = $em->getConnection()
            ->executeQuery($sql, ['id' => $etablissement->getId()])
            ->fetchAssociative();

        $etablissement->setNoteMoyenne((float) ($row['note_moyenne'] ?? 0));
        $etablissement->setTotalAvis((int) ($row['total_avis'] ?? 0));

        $em->flush();
    }
}
