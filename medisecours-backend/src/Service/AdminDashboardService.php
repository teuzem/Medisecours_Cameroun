<?php

declare(strict_types=1);

namespace App\Service;

use Doctrine\DBAL\Connection;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Agrège toutes les métriques du tableau de bord administrateur.
 */
class AdminDashboardService
{
    private const REGIONS = [
        'Adamaoua', 'Centre', 'Est', 'Extrême-Nord', 'Littoral',
        'Nord', 'Nord-Ouest', 'Ouest', 'Sud', 'Sud-Ouest',
    ];

    public function __construct(
        private EntityManagerInterface $entityManager,
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function buildDashboard(string $period = '30d'): array
    {
        $days = $this->parsePeriod($period);
        $conn = $this->entityManager->getConnection();

        $now = new \DateTimeImmutable();
        $periodStart = $now->modify(sprintf('-%d days', $days));
        $prevStart = $now->modify(sprintf('-%d days', $days * 2));
        $prevEnd = $periodStart;

        $stats = $this->buildStats($conn);
        $kpis = $this->buildKpis($conn, $periodStart, $prevStart, $prevEnd, $now);
        $timeseries = $this->buildTimeseries($conn, $days, $now);
        $sparklines = $this->extractSparklines($timeseries);

        return [
            'period' => $period,
            'periodDays' => $days,
            'generatedAt' => $now->format(\DateTimeInterface::ATOM),
            'stats' => $stats,
            'kpis' => $kpis,
            'sparklines' => $sparklines,
            'alerts' => $this->buildAlerts($conn, $stats),
            'timeseries' => $timeseries,
            'funnel' => $this->buildConsultationFunnel($conn),
            'gravite' => $this->buildGraviteDistribution($conn),
            'geographie' => $this->buildGeographie($conn),
            'catalogue' => $this->buildCatalogueHealth($conn),
            'avis' => $this->buildAvisStats($conn),
            'dataQuality' => $this->buildDataQuality($conn),
            'activityHeatmap' => $this->buildActivityHeatmap($conn, $days),
            'activityFeed' => $this->buildActivityFeed($conn),
            'auditLog' => $this->buildAuditLog($conn),
            'systemHealth' => $this->buildSystemHealth($conn),
        ];
    }

    private function parsePeriod(string $period): int
    {
        return match ($period) {
            '7d' => 7,
            '90d' => 90,
            default => 30,
        };
    }

    /**
     * @return array<string, mixed>
     */
    private function buildStats(Connection $conn): array
    {
        $patients = (int) $conn->fetchOne("SELECT COUNT(*) FROM \"user\" WHERE type = 'patient'");
        $medecins = (int) $conn->fetchOne("SELECT COUNT(*) FROM \"user\" WHERE type = 'medecin'");
        $medecinsValides = (int) $conn->fetchOne("SELECT COUNT(*) FROM \"user\" WHERE type = 'medecin' AND est_valide = true");
        $medecinsEnAttente = $medecins - $medecinsValides;
        $maladies = (int) $conn->fetchOne('SELECT COUNT(*) FROM maladie');
        $categories = (int) $conn->fetchOne('SELECT COUNT(*) FROM categorie');
        $centres = (int) $conn->fetchOne('SELECT COUNT(*) FROM centre_de_sante WHERE est_actif = true');
        $centresTotal = (int) $conn->fetchOne('SELECT COUNT(*) FROM centre_de_sante');
        $consultations = (int) $conn->fetchOne('SELECT COUNT(*) FROM consultation');
        $consultationsEnCours = (int) $conn->fetchOne("SELECT COUNT(*) FROM consultation WHERE statut IN ('OUVERTE', 'EN_COURS')");
        $messages = (int) $conn->fetchOne('SELECT COUNT(*) FROM message WHERE deleted_at IS NULL');
        $avis = (int) $conn->fetchOne('SELECT COUNT(*) FROM avis WHERE signale = false');
        $avisSignales = (int) $conn->fetchOne('SELECT COUNT(*) FROM avis WHERE signale = true');
        $premiersSoins = (int) $conn->fetchOne('SELECT COUNT(*) FROM premier_soin');

        return [
            'utilisateurs' => [
                'patients' => $patients,
                'medecins' => $medecins,
                'medecinsValides' => $medecinsValides,
                'medecinsEnAttente' => $medecinsEnAttente,
                'total' => $patients + $medecins,
            ],
            'contenu' => [
                'maladies' => $maladies,
                'categories' => $categories,
                'centres' => $centres,
                'centresTotal' => $centresTotal,
                'premiersSoins' => $premiersSoins,
            ],
            'activite' => [
                'consultations' => $consultations,
                'consultationsEnCours' => $consultationsEnCours,
                'messages' => $messages,
                'avis' => $avis,
                'avisSignales' => $avisSignales,
            ],
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function buildKpis(Connection $conn, \DateTimeImmutable $periodStart, \DateTimeImmutable $prevStart, \DateTimeImmutable $prevEnd, \DateTimeImmutable $now): array
    {
        $metrics = [
            ['key' => 'patients', 'label' => 'Patients', 'table' => '"user"', 'where' => "type = 'patient'", 'dateCol' => 'created_at'],
            ['key' => 'medecins', 'label' => 'Médecins', 'table' => '"user"', 'where' => "type = 'medecin'", 'dateCol' => 'created_at'],
            ['key' => 'consultations', 'label' => 'Consultations', 'table' => 'consultation', 'where' => '1=1', 'dateCol' => 'created_at'],
            ['key' => 'messages', 'label' => 'Messages', 'table' => 'message', 'where' => 'deleted_at IS NULL', 'dateCol' => 'created_at'],
            ['key' => 'avis', 'label' => 'Avis', 'table' => 'avis', 'where' => '1=1', 'dateCol' => 'created_at'],
            ['key' => 'centres', 'label' => 'Centres actifs', 'table' => 'centre_de_sante', 'where' => 'est_actif = true', 'dateCol' => null],
            ['key' => 'maladies', 'label' => 'Maladies', 'table' => 'maladie', 'where' => '1=1', 'dateCol' => 'created_at'],
            ['key' => 'consultationsEnCours', 'label' => 'Consult. en cours', 'table' => 'consultation', 'where' => "statut IN ('OUVERTE', 'EN_COURS')", 'dateCol' => null],
        ];

        $kpis = [];
        foreach ($metrics as $m) {
            $total = (int) $conn->fetchOne(sprintf('SELECT COUNT(*) FROM %s WHERE %s', $m['table'], $m['where']));

            $current = $total;
            $previous = 0;
            $delta = 0.0;

            if ($m['dateCol'] !== null && $this->columnExists($conn, $m['table'], $m['dateCol'])) {
                $current = (int) $conn->fetchOne(
                    sprintf('SELECT COUNT(*) FROM %s WHERE %s AND %s >= :start', $m['table'], $m['where'], $m['dateCol']),
                    ['start' => $periodStart->format('Y-m-d H:i:s')]
                );
                $previous = (int) $conn->fetchOne(
                    sprintf('SELECT COUNT(*) FROM %s WHERE %s AND %s >= :prevStart AND %s < :prevEnd', $m['table'], $m['where'], $m['dateCol'], $m['dateCol']),
                    ['prevStart' => $prevStart->format('Y-m-d H:i:s'), 'prevEnd' => $prevEnd->format('Y-m-d H:i:s')]
                );
                $delta = $previous > 0 ? round((($current - $previous) / $previous) * 100, 1) : ($current > 0 ? 100.0 : 0.0);
            }

            $kpis[] = [
                'key' => $m['key'],
                'label' => $m['label'],
                'value' => $m['dateCol'] !== null && $this->columnExists($conn, $m['table'], $m['dateCol']) ? $total : $total,
                'periodValue' => $current,
                'previousPeriodValue' => $previous,
                'deltaPercent' => $delta,
            ];
        }

        $noteMoyenne = $conn->fetchOne('SELECT ROUND(AVG(note)::numeric, 2) FROM avis WHERE signale = false');
        $avisSignales = (int) $conn->fetchOne('SELECT COUNT(*) FROM avis WHERE signale = true');
        $kpis[] = [
            'key' => 'noteMoyenne',
            'label' => 'Note moyenne',
            'value' => $noteMoyenne !== false ? (float) $noteMoyenne : 0.0,
            'periodValue' => null,
            'previousPeriodValue' => null,
            'deltaPercent' => null,
        ];
        $kpis[] = [
            'key' => 'avisSignales',
            'label' => 'Avis signalés',
            'value' => $avisSignales,
            'periodValue' => null,
            'previousPeriodValue' => null,
            'deltaPercent' => null,
        ];

        return $kpis;
    }

    private function columnExists(Connection $conn, string $table, string $column): bool
    {
        $tableName = trim($table, '"');
        $result = $conn->fetchOne(
            "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = :table AND column_name = :column",
            ['table' => $tableName, 'column' => $column]
        );

        return (int) $result > 0;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function buildTimeseries(Connection $conn, int $days, \DateTimeImmutable $now): array
    {
        $series = [];
        for ($i = $days - 1; $i >= 0; $i--) {
            $day = $now->modify(sprintf('-%d days', $i))->format('Y-m-d');
            $nextDay = $now->modify(sprintf('-%d days', $i - 1))->format('Y-m-d');

            $utilisateurs = 0;
            if ($this->columnExists($conn, '"user"', 'created_at')) {
                $utilisateurs = (int) $conn->fetchOne(
                    "SELECT COUNT(*) FROM \"user\" WHERE created_at >= :start AND created_at < :end",
                    ['start' => $day, 'end' => $nextDay]
                );
            }

            $consultations = (int) $conn->fetchOne(
                'SELECT COUNT(*) FROM consultation WHERE created_at >= :start AND created_at < :end',
                ['start' => $day, 'end' => $nextDay]
            );
            $messages = (int) $conn->fetchOne(
                'SELECT COUNT(*) FROM message WHERE deleted_at IS NULL AND created_at >= :start AND created_at < :end',
                ['start' => $day, 'end' => $nextDay]
            );
            $avis = (int) $conn->fetchOne(
                'SELECT COUNT(*) FROM avis WHERE created_at >= :start AND created_at < :end',
                ['start' => $day, 'end' => $nextDay]
            );

            $series[] = [
                'date' => $day,
                'label' => (new \DateTimeImmutable($day))->format('d/m'),
                'utilisateurs' => $utilisateurs,
                'consultations' => $consultations,
                'messages' => $messages,
                'avis' => $avis,
            ];
        }

        return $series;
    }

    /**
     * @param list<array<string, mixed>> $timeseries
     *
     * @return array<string, list<int>>
     */
    private function extractSparklines(array $timeseries): array
    {
        $last = array_slice($timeseries, -7);

        return [
            'utilisateurs' => array_column($last, 'utilisateurs'),
            'consultations' => array_column($last, 'consultations'),
            'messages' => array_column($last, 'messages'),
            'avis' => array_column($last, 'avis'),
        ];
    }

    /**
     * @param array<string, mixed> $stats
     *
     * @return list<array<string, mixed>>
     */
    private function buildAlerts(Connection $conn, array $stats): array
    {
        $alerts = [];

        $pending = $stats['utilisateurs']['medecinsEnAttente'] ?? 0;
        if ($pending > 0) {
            $alerts[] = [
                'type' => 'medecins_en_attente',
                'severity' => 'warning',
                'count' => $pending,
                'message' => sprintf('%d médecin(s) en attente de validation', $pending),
                'href' => '/admin/medecins',
            ];
        }

        $signales = $stats['activite']['avisSignales'] ?? 0;
        if ($signales > 0) {
            $alerts[] = [
                'type' => 'avis_signales',
                'severity' => 'danger',
                'count' => $signales,
                'message' => sprintf('%d avis signalé(s) à modérer', $signales),
                'href' => '/admin/avis',
            ];
        }

        $stagnantes = (int) $conn->fetchOne(
            "SELECT COUNT(*) FROM consultation WHERE statut IN ('OUVERTE', 'EN_COURS') AND created_at < NOW() - INTERVAL '48 hours'"
        );
        if ($stagnantes > 0) {
            $alerts[] = [
                'type' => 'consultations_stagnantes',
                'severity' => 'warning',
                'count' => $stagnantes,
                'message' => sprintf('%d consultation(s) ouverte(s) depuis plus de 48 h', $stagnantes),
                'href' => '/admin',
            ];
        }

        $critiquesSansProtocole = (int) $conn->fetchOne(
            "SELECT COUNT(*) FROM maladie m WHERE m.niveau_gravite IN ('CRITIQUE', 'SÉVÈRE') AND NOT EXISTS (SELECT 1 FROM premier_soin ps WHERE ps.maladie_id = m.id)"
        );
        if ($critiquesSansProtocole > 0) {
            $alerts[] = [
                'type' => 'catalogue_incomplet',
                'severity' => 'info',
                'count' => $critiquesSansProtocole,
                'message' => sprintf('%d maladie(s) grave(s) sans protocole de premiers soins', $critiquesSansProtocole),
                'href' => '/admin/catalogue',
            ];
        }

        return $alerts;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function buildConsultationFunnel(Connection $conn): array
    {
        $rows = $conn->fetchAllAssociative(
            'SELECT statut, COUNT(*) AS total FROM consultation GROUP BY statut ORDER BY total DESC'
        );

        $labels = [
            'OUVERTE' => 'Ouvertes',
            'EN_COURS' => 'En cours',
            'TERMINEE' => 'Terminées',
            'ANNULEE' => 'Annulées',
        ];

        return array_map(static fn (array $row) => [
            'statut' => $row['statut'],
            'label' => $labels[$row['statut']] ?? $row['statut'],
            'count' => (int) $row['total'],
        ], $rows);
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function buildGraviteDistribution(Connection $conn): array
    {
        $rows = $conn->fetchAllAssociative(
            'SELECT niveau_gravite AS name, COUNT(*) AS value FROM maladie GROUP BY niveau_gravite ORDER BY value DESC'
        );

        return array_map(static fn (array $row) => [
            'name' => $row['name'],
            'value' => (int) $row['value'],
        ], $rows);
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function buildGeographie(Connection $conn): array
    {
        $counts = $conn->fetchAllAssociative(
            'SELECT region, COUNT(*) AS centres FROM centre_de_sante WHERE est_actif = true GROUP BY region'
        );
        $byRegion = [];
        foreach ($counts as $row) {
            $byRegion[$row['region']] = (int) $row['centres'];
        }

        $result = [];
        foreach (self::REGIONS as $region) {
            $result[] = [
                'region' => $region,
                'centres' => $byRegion[$region] ?? 0,
            ];
        }

        return $result;
    }

    /**
     * @return array<string, mixed>
     */
    private function buildCatalogueHealth(Connection $conn): array
    {
        $critiquesSansProtocole = $conn->fetchAllAssociative(
            "SELECT m.id, m.nom, m.niveau_gravite FROM maladie m
             WHERE m.niveau_gravite IN ('CRITIQUE', 'SÉVÈRE')
             AND NOT EXISTS (SELECT 1 FROM premier_soin ps WHERE ps.maladie_id = m.id)
             ORDER BY m.nom LIMIT 10"
        );

        $sansSymptomes = (int) $conn->fetchOne(
            "SELECT COUNT(*) FROM maladie WHERE symptomes IS NULL OR TRIM(symptomes) = ''"
        );
        $sansTraitement = (int) $conn->fetchOne(
            "SELECT COUNT(*) FROM maladie WHERE traitement IS NULL OR TRIM(traitement) = ''"
        );
        $categoriesVides = (int) $conn->fetchOne(
            'SELECT COUNT(*) FROM categorie c WHERE NOT EXISTS (SELECT 1 FROM maladie m WHERE m.categorie_id = c.id)'
        );
        $urgenceSansProtocole = (int) $conn->fetchOne(
            "SELECT COUNT(*) FROM maladie m WHERE m.urgence = true AND NOT EXISTS (SELECT 1 FROM premier_soin ps WHERE ps.maladie_id = m.id)"
        );

        return [
            'maladiesCritiquesSansProtocole' => array_map(static fn (array $r) => [
                'id' => (int) $r['id'],
                'nom' => $r['nom'],
                'niveauGravite' => $r['niveau_gravite'],
            ], $critiquesSansProtocole),
            'sansSymptomes' => $sansSymptomes,
            'sansTraitement' => $sansTraitement,
            'categoriesVides' => $categoriesVides,
            'urgenceSansProtocole' => $urgenceSansProtocole,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function buildAvisStats(Connection $conn): array
    {
        $noteMoyenne = $conn->fetchOne('SELECT ROUND(AVG(note)::numeric, 2) FROM avis WHERE signale = false');
        $total = (int) $conn->fetchOne('SELECT COUNT(*) FROM avis');
        $signales = (int) $conn->fetchOne('SELECT COUNT(*) FROM avis WHERE signale = true');

        $distribution = $conn->fetchAllAssociative(
            'SELECT note, COUNT(*) AS count FROM avis GROUP BY note ORDER BY note ASC'
        );

        return [
            'noteMoyenne' => $noteMoyenne !== false ? (float) $noteMoyenne : 0.0,
            'total' => $total,
            'signales' => $signales,
            'distribution' => array_map(static fn (array $r) => [
                'note' => (int) $r['note'],
                'count' => (int) $r['count'],
            ], $distribution),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function buildDataQuality(Connection $conn): array
    {
        $checks = [];

        $maladiesTotal = max(1, (int) $conn->fetchOne('SELECT COUNT(*) FROM maladie'));
        $maladiesCompletes = (int) $conn->fetchOne(
            "SELECT COUNT(*) FROM maladie WHERE symptomes IS NOT NULL AND TRIM(symptomes) != '' AND traitement IS NOT NULL AND TRIM(traitement) != ''"
        );
        $checks['maladiesCompletes'] = round(($maladiesCompletes / $maladiesTotal) * 100, 1);

        $medecinsTotal = max(1, (int) $conn->fetchOne("SELECT COUNT(*) FROM \"user\" WHERE type = 'medecin'"));
        $medecinsValides = (int) $conn->fetchOne("SELECT COUNT(*) FROM \"user\" WHERE type = 'medecin' AND est_valide = true");
        $checks['medecinsValides'] = round(($medecinsValides / $medecinsTotal) * 100, 1);

        $centresTotal = max(1, (int) $conn->fetchOne('SELECT COUNT(*) FROM centre_de_sante'));
        $centresGeo = (int) $conn->fetchOne('SELECT COUNT(*) FROM centre_de_sante WHERE latitude IS NOT NULL AND longitude IS NOT NULL');
        $checks['centresGeolocalises'] = round(($centresGeo / $centresTotal) * 100, 1);

        $usersTotal = max(1, (int) $conn->fetchOne('SELECT COUNT(*) FROM "user"'));
        $usersPhone = (int) $conn->fetchOne("SELECT COUNT(*) FROM \"user\" WHERE telephone IS NOT NULL AND TRIM(telephone) != ''");
        $checks['utilisateursAvecTelephone'] = round(($usersPhone / $usersTotal) * 100, 1);

        $regionsCouvertes = (int) $conn->fetchOne('SELECT COUNT(DISTINCT region) FROM centre_de_sante WHERE est_actif = true');
        $checks['couvertureRegionale'] = round(($regionsCouvertes / count(self::REGIONS)) * 100, 1);

        $score = round(array_sum($checks) / count($checks), 1);

        $issues = [];
        if ($checks['maladiesCompletes'] < 80) {
            $issues[] = 'Fiches maladies incomplètes (symptômes/traitement manquants)';
        }
        if ($checks['medecinsValides'] < 100) {
            $issues[] = 'Médecins non validés en attente';
        }
        if ($checks['couvertureRegionale'] < 100) {
            $issues[] = sprintf('Couverture régionale : %d/10 régions', $regionsCouvertes);
        }

        return [
            'score' => $score,
            'checks' => $checks,
            'issues' => $issues,
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function buildActivityHeatmap(Connection $conn, int $days): array
    {
        $rows = $conn->fetchAllAssociative(
            "SELECT EXTRACT(DOW FROM created_at)::int AS day, EXTRACT(HOUR FROM created_at)::int AS hour, COUNT(*) AS count
             FROM (
                 SELECT created_at FROM message WHERE deleted_at IS NULL AND created_at >= NOW() - INTERVAL '1 day' * :days
                 UNION ALL
                 SELECT created_at FROM consultation WHERE created_at >= NOW() - INTERVAL '1 day' * :days
             ) AS activity
             GROUP BY day, hour
             ORDER BY day, hour",
            ['days' => $days]
        );

        return array_map(static fn (array $r) => [
            'day' => (int) $r['day'],
            'hour' => (int) $r['hour'],
            'count' => (int) $r['count'],
        ], $rows);
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function buildActivityFeed(Connection $conn): array
    {
        $feed = [];

        $consultations = $conn->fetchAllAssociative(
            "SELECT c.id, c.statut, c.created_at, p.prenom AS patient_prenom, p.nom AS patient_nom,
                    m.prenom AS medecin_prenom, m.nom AS medecin_nom
             FROM consultation c
             JOIN \"user\" p ON p.id = c.patient_id
             JOIN \"user\" m ON m.id = c.medecin_id
             ORDER BY c.created_at DESC LIMIT 5"
        );
        foreach ($consultations as $c) {
            $feed[] = [
                'type' => 'consultation',
                'id' => (int) $c['id'],
                'message' => sprintf('Consultation %s — Dr %s %s / %s %s', $c['statut'], $c['medecin_prenom'], $c['medecin_nom'], $c['patient_prenom'], $c['patient_nom']),
                'at' => (new \DateTimeImmutable($c['created_at']))->format(\DateTimeInterface::ATOM),
            ];
        }

        if ($this->columnExists($conn, '"user"', 'created_at')) {
            $medecins = $conn->fetchAllAssociative(
                "SELECT id, prenom, nom, est_valide, created_at FROM \"user\"
                 WHERE type = 'medecin' AND est_valide = false
                 ORDER BY created_at DESC LIMIT 3"
            );
            foreach ($medecins as $m) {
                $feed[] = [
                    'type' => 'medecin_inscription',
                    'id' => $m['id'],
                    'message' => sprintf('Nouveau médecin : Dr %s %s (en attente)', $m['prenom'], $m['nom']),
                    'at' => (new \DateTimeImmutable($m['created_at']))->format(\DateTimeInterface::ATOM),
                ];
            }
        }

        $avis = $conn->fetchAllAssociative(
            'SELECT a.id, a.note, a.signale, a.created_at FROM avis a WHERE a.signale = true ORDER BY a.created_at DESC LIMIT 3'
        );
        foreach ($avis as $a) {
            $feed[] = [
                'type' => 'avis_signale',
                'id' => (int) $a['id'],
                'message' => sprintf('Avis signalé (note %d/5)', $a['note']),
                'at' => (new \DateTimeImmutable($a['created_at']))->format(\DateTimeInterface::ATOM),
            ];
        }

        usort($feed, static fn (array $a, array $b) => strcmp($b['at'], $a['at']));

        return array_slice($feed, 0, 10);
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function getAuditLog(): array
    {
        return $this->buildAuditLog($this->entityManager->getConnection());
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function buildAuditLog(Connection $conn): array
    {
        if (!$this->tableExists($conn, 'ext_log_entries')) {
            return [];
        }

        $rows = $conn->fetchAllAssociative(
            'SELECT id, action, object_class, object_id, username, logged_at
             FROM ext_log_entries ORDER BY logged_at DESC LIMIT 20'
        );

        return array_map(static fn (array $r) => [
            'id' => (int) $r['id'],
            'action' => $r['action'],
            'objectClass' => $r['object_class'],
            'objectId' => $r['object_id'],
            'username' => $r['username'],
            'loggedAt' => (new \DateTimeImmutable($r['logged_at']))->format(\DateTimeInterface::ATOM),
        ], $rows);
    }

    /**
     * @return array<string, mixed>
     */
    private function buildSystemHealth(Connection $conn): array
    {
        $dbOk = false;
        try {
            $conn->executeQuery('SELECT 1');
            $dbOk = true;
        } catch (\Throwable) {
            $dbOk = false;
        }

        return [
            'api' => 'ok',
            'database' => $dbOk ? 'ok' : 'error',
            'websocket' => 'configured',
            'timestamp' => (new \DateTimeImmutable())->format(\DateTimeInterface::ATOM),
        ];
    }

    private function tableExists(Connection $conn, string $table): bool
    {
        $result = $conn->fetchOne(
            'SELECT COUNT(*) FROM information_schema.tables WHERE table_name = :table',
            ['table' => $table]
        );

        return (int) $result > 0;
    }
}
