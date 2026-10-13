<?php

declare(strict_types=1);

namespace App\Service;

use App\Entity\Patient;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Table de bord patient : statistiques agrégées, séries temporelles,
 * répartition par établissement et par statut, prescriptions.
 *
 * Aggregats SQL uniquement (aucune hydratation d'entité), scopés sur le
 * patient connecté. Dialecte PostgreSQL.
 */
class PatientDashboardService
{
    public const ALLOWED_PERIODS = [7, 30, 90, 365];

    public function __construct(
        private EntityManagerInterface $entityManager,
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function buildDashboard(Patient $patient, int $period = 30): array
    {
        if (!in_array($period, self::ALLOWED_PERIODS, true)) {
            $period = 30;
        }
        $conn = $this->entityManager->getConnection();
        $uid = (string) $patient->getId();

        return [
            'period' => $period,
            'kpis' => [
                'consultations' => (int) $conn->fetchOne(
                    'SELECT COUNT(*) FROM consultation WHERE patient_id = :uid',
                    ['uid' => $uid]
                ),
                'consultationsPeriode' => (int) $conn->fetchOne(
                    'SELECT COUNT(*) FROM consultation WHERE patient_id = :uid AND created_at >= (CURRENT_DATE - INTERVAL \'' . $period . ' days\')',
                    ['uid' => $uid]
                ),
                'favoris' => (int) $conn->fetchOne(
                    'SELECT COUNT(*) FROM carte_saved_place WHERE user_id = :uid',
                    ['uid' => $uid]
                ),
                'prescriptionsActives' => (int) $conn->fetchOne(
                    "SELECT COUNT(*) FROM prescription WHERE patient_id = :uid AND statut IN ('SIGNEE', 'TRANSMISE')",
                    ['uid' => $uid]
                ),
                'prescriptionsTotal' => (int) $conn->fetchOne(
                    'SELECT COUNT(*) FROM prescription WHERE patient_id = :uid',
                    ['uid' => $uid]
                ),
                'teleconsultations' => (int) $conn->fetchOne(
                    "SELECT COUNT(*) FROM consultation WHERE patient_id = :uid AND mode = 'TELECONSULTATION'",
                    ['uid' => $uid]
                ),
                'consultationsPresentiel' => (int) $conn->fetchOne(
                    "SELECT COUNT(*) FROM consultation WHERE patient_id = :uid AND mode = 'PRESENTIEL'",
                    ['uid' => $uid]
                ),
            ],
            'statusCounts' => $this->buildStatusCounts($conn, $uid),
            'modeCounts' => $this->buildModeCounts($conn, $uid, $period),
            'timeline' => $this->buildTimeline($conn, $uid, $period),
            'weekdayDistribution' => $this->buildWeekdayDistribution($conn, $uid, $period),
            'hourlyDistribution' => $this->buildHourlyDistribution($conn, $uid, $period),
            'etablissementBreakdown' => $this->buildEtablissementBreakdown($conn, $uid, $period),
            'prescriptionsByStatut' => $this->buildPrescriptionCounts($conn, $uid, $period),
            'comparaison' => $this->buildComparaison($conn, $uid, $period),
        ];
    }

    /**
     * @return array<string, int>
     */
    private function buildStatusCounts(\Doctrine\DBAL\Connection $conn, string $uid): array
    {
        $rows = $conn->fetchAllAssociative(
            'SELECT statut, COUNT(*) AS n FROM consultation WHERE patient_id = :uid GROUP BY statut',
            ['uid' => $uid]
        );

        $counts = ['OUVERTE' => 0, 'EN_COURS' => 0, 'TERMINEE' => 0, 'ANNULEE' => 0];
        foreach ($rows as $row) {
            $statut = (string) $row['statut'];
            if (isset($counts[$statut])) {
                $counts[$statut] = (int) $row['n'];
            }
        }

        return $counts;
    }

    /**
     * @return array<string, int>
     */
    private function buildModeCounts(\Doctrine\DBAL\Connection $conn, string $uid, int $period): array
    {
        $rows = $conn->fetchAllAssociative(
            'SELECT mode, COUNT(*) AS n
             FROM consultation
             WHERE patient_id = :uid AND created_at >= (CURRENT_DATE - INTERVAL \'' . $period . ' days\')
             GROUP BY mode',
            ['uid' => $uid]
        );

        $counts = ['PRESENTIEL' => 0, 'TELECONSULTATION' => 0];
        foreach ($rows as $row) {
            $mode = (string) $row['mode'];
            if (isset($counts[$mode])) {
                $counts[$mode] = (int) $row['n'];
            }
        }

        return $counts;
    }

    /**
     * @return array<int, array{date: string, count: int}>
     */
    private function buildTimeline(\Doctrine\DBAL\Connection $conn, string $uid, int $period): array
    {
        $rows = $conn->fetchAllAssociative(
            'SELECT DATE(created_at) AS d, COUNT(*) AS n
             FROM consultation
             WHERE patient_id = :uid AND created_at >= (CURRENT_DATE - INTERVAL \'' . $period . ' days\')
             GROUP BY d ORDER BY d ASC',
            ['uid' => $uid]
        );

        $byDate = [];
        foreach ($rows as $row) {
            $byDate[(string) $row['d']] = (int) $row['n'];
        }

        $series = [];
        $today = new \DateTimeImmutable('today');
        for ($i = $period - 1; $i >= 0; $i--) {
            $day = $today->modify("-{$i} days")->format('Y-m-d');
            $series[] = ['date' => $day, 'count' => $byDate[$day] ?? 0];
        }

        return $series;
    }

    /**
     * @return array<int, int> indexé 0..6 (0 = dimanche)
     */
    private function buildWeekdayDistribution(\Doctrine\DBAL\Connection $conn, string $uid, int $period): array
    {
        $rows = $conn->fetchAllAssociative(
            'SELECT CAST(EXTRACT(DOW FROM created_at) AS INT) AS dow, COUNT(*) AS n
             FROM consultation
             WHERE patient_id = :uid AND created_at >= (CURRENT_DATE - INTERVAL \'' . $period . ' days\')
             GROUP BY dow',
            ['uid' => $uid]
        );

        $distribution = array_fill(0, 7, 0);
        foreach ($rows as $row) {
            $dow = (int) $row['dow'];
            if ($dow >= 0 && $dow <= 6) {
                $distribution[$dow] = (int) $row['n'];
            }
        }

        return $distribution;
    }

    /**
     * @return array<int, int> indexé 0..23
     */
    private function buildHourlyDistribution(\Doctrine\DBAL\Connection $conn, string $uid, int $period): array
    {
        $rows = $conn->fetchAllAssociative(
            'SELECT CAST(EXTRACT(HOUR FROM created_at) AS INT) AS h, COUNT(*) AS n
             FROM consultation
             WHERE patient_id = :uid AND created_at >= (CURRENT_DATE - INTERVAL \'' . $period . ' days\')
             GROUP BY h',
            ['uid' => $uid]
        );

        $distribution = array_fill(0, 24, 0);
        foreach ($rows as $row) {
            $hour = (int) $row['h'];
            if ($hour >= 0 && $hour <= 23) {
                $distribution[$hour] = (int) $row['n'];
            }
        }

        return $distribution;
    }

    /**
     * @return array<int, array{etablissementId: int|null, nom: string, count: int}>
     */
    private function buildEtablissementBreakdown(\Doctrine\DBAL\Connection $conn, string $uid, int $period): array
    {
        $rows = $conn->fetchAllAssociative(
            'SELECT c.etablissement_id AS eid, COALESCE(cs.nom, \'—\') AS nom, COUNT(*) AS n
             FROM consultation c
             LEFT JOIN centre_de_sante cs ON cs.id = c.etablissement_id
             WHERE c.patient_id = :uid AND c.created_at >= (CURRENT_DATE - INTERVAL \'' . $period . ' days\')
             GROUP BY c.etablissement_id, cs.nom
             ORDER BY n DESC
             LIMIT 8',
            ['uid' => $uid]
        );

        return array_map(
            static fn (array $row): array => [
                'etablissementId' => $row['eid'] !== null ? (int) $row['eid'] : null,
                'nom' => (string) $row['nom'],
                'count' => (int) $row['n'],
            ],
            $rows
        );
    }

    /**
     * @return array<string, int>
     */
    private function buildPrescriptionCounts(\Doctrine\DBAL\Connection $conn, string $uid, int $period): array
    {
        $rows = $conn->fetchAllAssociative(
            'SELECT statut, COUNT(*) AS n
             FROM prescription
             WHERE patient_id = :uid AND created_at >= (CURRENT_DATE - INTERVAL \'' . $period . ' days\')
             GROUP BY statut',
            ['uid' => $uid]
        );

        $counts = ['BROUILLON' => 0, 'SIGNEE' => 0, 'TRANSMISE' => 0, 'ANNULEE' => 0, 'EXPIREE' => 0, 'REMPLACEE' => 0];
        foreach ($rows as $row) {
            $statut = (string) $row['statut'];
            if (isset($counts[$statut])) {
                $counts[$statut] = (int) $row['n'];
            }
        }

        return $counts;
    }

    /**
     * @return array{totalPeriode: int, totalPeriodePrecedente: int, croissancePourcent: float|null}
     */
    private function buildComparaison(\Doctrine\DBAL\Connection $conn, string $uid, int $period): array
    {
        $totalPeriode = (int) $conn->fetchOne(
            'SELECT COUNT(*) FROM consultation
             WHERE patient_id = :uid AND created_at >= (CURRENT_DATE - INTERVAL \'' . $period . ' days\')',
            ['uid' => $uid]
        );

        $totalPrecedente = (int) $conn->fetchOne(
            'SELECT COUNT(*) FROM consultation
             WHERE patient_id = :uid
               AND created_at < (CURRENT_DATE - INTERVAL \'' . $period . ' days\')
               AND created_at >= (CURRENT_DATE - INTERVAL \'' . ($period * 2) . ' days\')',
            ['uid' => $uid]
        );

        $croissance = null;
        if ($totalPrecedente > 0) {
            $croissance = round((($totalPeriode - $totalPrecedente) / $totalPrecedente) * 100, 1);
        } elseif ($totalPeriode > 0) {
            $croissance = 100.0;
        }

        return [
            'totalPeriode' => $totalPeriode,
            'totalPeriodePrecedente' => $totalPrecedente,
            'croissancePourcent' => $croissance,
        ];
    }
}
