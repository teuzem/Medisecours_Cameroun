<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\DemandeSos;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<DemandeSos>
 */
class DemandeSosRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, DemandeSos::class);
    }

    /**
     * Statistiques SOS d'un établissement (dernier mois) pour le tableau de bord.
     *
     * @return array{total: int, enCours: int, traitees: int, cloturees: int}
     */
    public function statsForEtablissement(int $etablissementId, int $days = 30): array
    {
        $since = (new \DateTimeImmutable('-' . $days . ' days'))->format('Y-m-d H:i:s');

        $sql = <<<SQL
            SELECT
                COUNT(d.id) AS total,
                COALESCE(SUM(CASE WHEN d.statut = 'EN_COURS' THEN 1 ELSE 0 END), 0) AS en_cours,
                COALESCE(SUM(CASE WHEN d.statut = 'TRAITEE' THEN 1 ELSE 0 END), 0) AS traitees,
                COALESCE(SUM(CASE WHEN d.statut = 'CLOTUREE' THEN 1 ELSE 0 END), 0) AS cloturees
            FROM demande_sos d
            WHERE d.created_at >= :since
              AND d.proches::text LIKE :pattern
        SQL;

        $row = $this->getEntityManager()->getConnection()
            ->executeQuery($sql, [
                'since' => $since,
                'pattern' => '%"id":' . $etablissementId . '%',
            ])
            ->fetchAssociative();

        return [
            'total' => (int) ($row['total'] ?? 0),
            'enCours' => (int) ($row['en_cours'] ?? 0),
            'traitees' => (int) ($row['traitees'] ?? 0),
            'cloturees' => (int) ($row['cloturees'] ?? 0),
        ];
    }
}