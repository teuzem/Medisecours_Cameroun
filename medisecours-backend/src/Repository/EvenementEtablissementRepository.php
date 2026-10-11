<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\EvenementEtablissement;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<EvenementEtablissement>
 */
class EvenementEtablissementRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, EvenementEtablissement::class);
    }

    /**
     * Totaux par type d'interaction depuis une date (ou tous temps si null).
     *
     * @return array<string, int>
     */
    public function totaux(?int $centreId, ?\DateTimeImmutable $since = null): array
    {
        $qb = $this->createQueryBuilder('e')
            ->select('e.type AS cle, COUNT(e.id) AS nb')
            ->groupBy('e.type');

        if (null !== $centreId) {
            $qb->andWhere('e.etablissement = :centre')->setParameter('centre', $centreId);
        }
        if (null !== $since) {
            $qb->andWhere('e.createdAt >= :since')->setParameter('since', $since);
        }

        $out = [];
        foreach ($qb->getQuery()->getResult() as $row) {
            $out[(string) $row['cle']] = (int) $row['nb'];
        }

        return $out;
    }

    /**
     * Nombre total d'événements depuis une date (ou tous temps si null).
     */
    public function total(?int $centreId, ?\DateTimeImmutable $since = null): int
    {
        $qb = $this->createQueryBuilder('e')->select('COUNT(e.id)');

        if (null !== $centreId) {
            $qb->andWhere('e.etablissement = :centre')->setParameter('centre', $centreId);
        }
        if (null !== $since) {
            $qb->andWhere('e.createdAt >= :since')->setParameter('since', $since);
        }

        return (int) $qb->getQuery()->getSingleScalarResult();
    }

    /**
     * Série journalière : nombre d'événements par jour et par type.
     *
     * Retourne un tableau plat [ ['jour' => 'YYYY-MM-DD', 'type' => 'telephone', 'nb' => 3], ... ]
     *
     * @return array<int, array{jour: string, type: string, nb: int}>
     */
    public function serieJournaliere(?int $centreId, \DateTimeImmutable $since): array
    {
        $sql = '
            SELECT TO_CHAR(e.created_at, \'YYYY-MM-DD\') AS jour, e.type AS type, COUNT(*) AS nb
            FROM evenement_etablissement e
            WHERE e.created_at >= :since
        ';
        $params = ['since' => $since->format('Y-m-d H:i:s')];
        if (null !== $centreId) {
            $sql .= ' AND e.etablissement_id = :centre';
            $params['centre'] = $centreId;
        }
        $sql .= ' GROUP BY jour, e.type ORDER BY jour ASC';

        $rows = $this->getEntityManager()->getConnection()->fetchAllAssociative($sql, $params);

        return array_map(
            static fn (array $row): array => [
                'jour' => (string) $row['jour'],
                'type' => (string) $row['type'],
                'nb' => (int) $row['nb'],
            ],
            $rows
        );
    }

    /**
     * Totaux par type d'interaction sur une fenêtre bornée (période courante ou précédente).
     *
     * @return array<string, int>
     */
    public function totauxPeriode(?int $centreId, \DateTimeImmutable $since, \DateTimeImmutable $until): array
    {
        $qb = $this->createQueryBuilder('e')
            ->select('e.type AS cle, COUNT(e.id) AS nb')
            ->andWhere('e.createdAt >= :since')->setParameter('since', $since)
            ->andWhere('e.createdAt < :until')->setParameter('until', $until)
            ->groupBy('e.type');

        if (null !== $centreId) {
            $qb->andWhere('e.etablissement = :centre')->setParameter('centre', $centreId);
        }

        $out = [];
        foreach ($qb->getQuery()->getResult() as $row) {
            $out[(string) $row['cle']] = (int) $row['nb'];
        }

        return $out;
    }

    /**
     * Série horaire : nombre d'événements par heure de la journée (0–23).
     *
     * @return array<int, int> index 0–23, valeur = nombre d'événements
     */
    public function serieHoraire(?int $centreId, \DateTimeImmutable $since): array
    {
        $sql = '
            SELECT EXTRACT(HOUR FROM e.created_at) AS heure, COUNT(*) AS nb
            FROM evenement_etablissement e
            WHERE e.created_at >= :since
        ';
        $params = ['since' => $since->format('Y-m-d H:i:s')];
        if (null !== $centreId) {
            $sql .= ' AND e.etablissement_id = :centre';
            $params['centre'] = $centreId;
        }
        $sql .= ' GROUP BY heure ORDER BY heure ASC';

        $rows = $this->getEntityManager()->getConnection()->fetchAllAssociative($sql, $params);

        $out = array_fill(0, 24, 0);
        foreach ($rows as $row) {
            $heure = (int) $row['heure'];
            if ($heure >= 0 && $heure < 24) {
                $out[$heure] = (int) $row['nb'];
            }
        }

        return $out;
    }

    /**
     * Services/spécialités les plus demandés (événements de type 'service').
     *
     * @return array<int, array{service: string, nb: int}>
     */
    public function topServices(?int $centreId, \DateTimeImmutable $since, int $limit = 10): array
    {
        $sql = "
            SELECT (e.metadata->>'service') AS service, COUNT(*) AS nb
            FROM evenement_etablissement e
            WHERE e.type = 'service'
              AND e.created_at >= :since
              AND e.metadata->>'service' IS NOT NULL
              AND e.metadata->>'service' != ''
        ";
        $params = ['since' => $since->format('Y-m-d H:i:s')];
        if (null !== $centreId) {
            $sql .= ' AND e.etablissement_id = :centre';
            $params['centre'] = $centreId;
        }
        $sql .= ' GROUP BY service ORDER BY nb DESC, service ASC LIMIT ' . max(1, min(25, $limit));

        $rows = $this->getEntityManager()->getConnection()->fetchAllAssociative($sql, $params);

        return array_map(
            static fn (array $row): array => [
                'service' => (string) $row['service'],
                'nb' => (int) $row['nb'],
            ],
            $rows
        );
    }
}