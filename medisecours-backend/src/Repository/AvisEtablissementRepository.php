<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\AvisEtablissement;
use App\Entity\CentreDeSante;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\ORM\QueryBuilder;
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
     * Base commune à toutes les lectures publiques : seuls les avis PUBLIE,
     * triés du plus récent au plus ancien (id en second tri de stabilité).
     *
     * L'établissement est toujours comparé comme ENTITÉ (jamais un simple
     * entier) afin que Doctrine résolve la clé étrangère sans ambiguïté,
     * quel que soit le pilote de base de données.
     */
    private function createPublicQueryBuilder(?CentreDeSante $centre, ?int $note): QueryBuilder
    {
        $qb = $this->createQueryBuilder('a')
            ->where('a.statut = :statut')
            ->setParameter('statut', 'PUBLIE')
            ->orderBy('a.createdAt', 'DESC')
            ->addOrderBy('a.id', 'DESC');

        if ($centre instanceof CentreDeSante) {
            $qb->andWhere('a.etablissement = :centre')
                ->setParameter('centre', $centre);
        }

        if ($note !== null && $note >= 1 && $note <= 5) {
            $qb->andWhere('a.note = :note')
                ->setParameter('note', $note);
        }

        return $qb;
    }

    /**
     * Avis publiés d'un établissement (exposition publique).
     *
     * @return AvisEtablissement[]
     */
    public function findPublicByEtablissement(?int $etablissementId = null, ?int $note = null): array
    {
        $centre = $etablissementId !== null
            ? $this->getEntityManager()->getReference(CentreDeSante::class, $etablissementId)
            : null;

        return $this->createPublicQueryBuilder($centre, $note)->getQuery()->getResult();
    }

    /**
     * Page d'avis publiés d'un établissement déjà chargé.
     *
     * @return AvisEtablissement[]
     */
    public function findPublicList(CentreDeSante $centre, ?int $note, int $offset, int $limit): array
    {
        return $this->createPublicQueryBuilder($centre, $note)
            ->setFirstResult(max(0, $offset))
            ->setMaxResults(max(1, min(100, $limit)))
            ->getQuery()
            ->getResult();
    }

    /**
     * Nombre d'avis publiés d'un établissement déjà chargé.
     */
    public function countPublic(CentreDeSante $centre, ?int $note): int
    {
        $qb = $this->createPublicQueryBuilder($centre, $note)
            ->select('COUNT(a.id)')
            ->resetDQLPart('orderBy');

        return (int) $qb->getQuery()->getSingleScalarResult();
    }

    /**
     * Recalcule et met à jour la note moyenne et le total d'avis publiés d'un
     * établissement. Appelé après chaque écriture via AvisEtablissementProcessor,
     * les contrôleurs dédiés et la commande app:avis:refresh-aggregates.
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
