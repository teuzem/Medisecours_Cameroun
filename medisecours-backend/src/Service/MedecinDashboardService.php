<?php

declare(strict_types=1);

namespace App\Service;

use App\Entity\Avis;
use App\Entity\Consultation;
use App\Entity\Medecin;
use App\Entity\Message;
use App\Repository\AvisRepository;
use Doctrine\DBAL\Connection;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Agrège toutes les métriques du tableau de bord médecin.
 *
 * Contrairement à l'ancienne implémentation (qui chargeait TOUTES les
 * consultations du médecin en RAM pour les compter en PHP), ce service
 * n'émet que des requêtes d'agrégat SQL (COUNT / GROUP BY) et ne charge
 * que les sous-ensembles strictement nécessaires aux widgets (5 lignes max).
 *
 * Toutes les requêtes sont scopées sur le médecin connecté (pas de fuite
 * de données entre médecins). Dialecte PostgreSQL.
 */
class MedecinDashboardService
{
    /** Seuil de garde (consultations actives > 48h = alerte). */
    private const ALERT_THRESHOLD_HOURS = 48;
    private const WIDGET_LIMIT = 5;
    private const TOP_MOTIFS_LIMIT = 8;
    private const TOP_ALLERGIES_LIMIT = 5;

    public function __construct(
        private EntityManagerInterface $entityManager,
        private AvisRepository $avisRepository,
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function buildDashboard(Medecin $medecin): array
    {
        $conn = $this->entityManager->getConnection();

        // --- Agrégats purs (aucune hydratation d'entité) ---
        $kpis = $this->buildKpis($conn, $medecin);
        $statusCounts = $this->buildStatusCounts($conn, $medecin);
        $alerts = $this->buildAlerts($conn, $medecin);
        $bloodDistribution = $this->buildBloodDistribution($conn, $medecin);
        $allergies = $this->buildAllergies($conn, $medecin);
        $topMotifs = $this->buildTopMotifs($conn, $medecin);
        $timeline = $this->buildTimeline($conn, $medecin, 30);
        $avisStats = $this->buildAvisStats($medecin);
        $unreadMessages = $this->countUnreadMessages($medecin);

        // --- Sous-ensembles sérialisables (widgets listes) ---
        $activeConsultations = $this->fetchActiveConsultations($medecin);
        $riskConsultations = $this->fetchRiskConsultations($medecin);
        $upcomingAppointments = $this->fetchUpcomingAppointments($medecin);
        $recentPatients = $this->fetchRecentPatients($medecin);

        return [
            'kpis' => $kpis,
            'statusCounts' => $statusCounts,
            'alerts' => $alerts,
            'noteMoyenne' => $avisStats['noteMoyenne'],
            'totalAvis' => $avisStats['totalAvis'],
            'ratingsDistribution' => $avisStats['distribution'],
            'unreadMessages' => $unreadMessages,
            'bloodDistribution' => $bloodDistribution,
            'allergies' => $allergies,
            'motifsCount' => $topMotifs,
            'timeline' => $timeline,
            'activeConsultations' => $activeConsultations,
            'riskConsultations' => $riskConsultations,
            'upcomingAppointments' => $upcomingAppointments,
            'recentPatients' => $recentPatients,
        ];
    }

    /**
     * KPI principaux (compteurs distincts, pas d'hydratation).
     *
     * @return array{totalPatients: int, casActifs: int, consultations: int, enAttente: int, terminees: int}
     */
    private function buildKpis(Connection $conn, Medecin $medecin): array
    {
        $uid = $this->userId($medecin);

        $totalPatients = (int) $conn->fetchOne(
            'SELECT COUNT(DISTINCT patient_id) FROM consultation WHERE medecin_id = :uid',
            ['uid' => $uid]
        );

        $consultations = (int) $conn->fetchOne(
            'SELECT COUNT(*) FROM consultation WHERE medecin_id = :uid',
            ['uid' => $uid]
        );

        $casActifs = (int) $conn->fetchOne(
            "SELECT COUNT(*) FROM consultation WHERE medecin_id = :uid AND statut = 'EN_COURS'",
            ['uid' => $uid]
        );

        $enAttente = (int) $conn->fetchOne(
            "SELECT COUNT(*) FROM consultation WHERE medecin_id = :uid AND statut = 'OUVERTE'",
            ['uid' => $uid]
        );

        $terminees = (int) $conn->fetchOne(
            "SELECT COUNT(*) FROM consultation WHERE medecin_id = :uid AND statut = 'TERMINEE'",
            ['uid' => $uid]
        );

        return [
            'totalPatients' => $totalPatients,
            'casActifs' => $casActifs,
            'consultations' => $consultations,
            'enAttente' => $enAttente,
            'terminees' => $terminees,
        ];
    }

    /**
     * Répartition des consultations par statut (pour le graphique "Répartition").
     *
     * @return array<string, int>
     */
    private function buildStatusCounts(Connection $conn, Medecin $medecin): array
    {
        $rows = $conn->fetchAllAssociative(
            'SELECT statut, COUNT(*) AS total FROM consultation WHERE medecin_id = :uid GROUP BY statut',
            ['uid' => $this->userId($medecin)]
        );

        $counts = [
            Consultation::STATUT_OUVERTE => 0,
            Consultation::STATUT_EN_COURS => 0,
            Consultation::STATUT_TERMINEE => 0,
            Consultation::STATUT_ANNULEE => 0,
        ];
        foreach ($rows as $row) {
            $statut = (string) $row['statut'];
            if (isset($counts[$statut])) {
                $counts[$statut] = (int) $row['total'];
            }
        }

        return $counts;
    }

    /**
     * Alertes de garde : consultations actives de plus de ALERT_THRESHOLD_HOURS.
     *
     * @return array{enAttenteLongue: int, enCoursLongue: int, urgentes: int}
     */
    private function buildAlerts(Connection $conn, Medecin $medecin): array
    {
        $uid = $this->userId($medecin);

        $enAttenteLongue = (int) $conn->fetchOne(
            "SELECT COUNT(*) FROM consultation
             WHERE medecin_id = :uid AND statut = 'OUVERTE'
               AND created_at < (NOW() - INTERVAL '48 hours')",
            ['uid' => $uid]
        );

        $enCoursLongue = (int) $conn->fetchOne(
            "SELECT COUNT(*) FROM consultation
             WHERE medecin_id = :uid AND statut = 'EN_COURS'
               AND created_at < (NOW() - INTERVAL '48 hours')",
            ['uid' => $uid]
        );

        $urgentes = (int) $conn->fetchOne(
            "SELECT COUNT(*) FROM consultation
             WHERE medecin_id = :uid
               AND statut NOT IN ('TERMINEE', 'ANNULEE')",
            ['uid' => $uid]
        );

        return [
            'enAttenteLongue' => $enAttenteLongue,
            'enCoursLongue' => $enCoursLongue,
            'urgentes' => $urgentes,
        ];
    }

    /**
     * Répartition des groupes sanguins des patients distincts du médecin.
     *
     * @return array<string, int>
     */
    private function buildBloodDistribution(Connection $conn, Medecin $medecin): array
    {
        $rows = $conn->fetchAllAssociative(
            'SELECT u.groupe_sanguin AS gs, COUNT(DISTINCT u.id) AS total
             FROM "user" u
             JOIN consultation c ON c.patient_id = u.id
             WHERE c.medecin_id = :uid AND u.groupe_sanguin IS NOT NULL AND u.groupe_sanguin <> \'\'
             GROUP BY u.groupe_sanguin',
            ['uid' => $this->userId($medecin)]
        );

        $distribution = [];
        foreach ($rows as $row) {
            $distribution[(string) $row['gs']] = (int) $row['total'];
        }

        return $distribution;
    }

    /**
     * Top allergies parmi les patients du médecin.
     *
     * @return array<int, array{name: string, count: int}>
     */
    private function buildAllergies(Connection $conn, Medecin $medecin): array
    {
        // Récupère les tableaux JSON d'allergies (patients distincts).
        $rows = $conn->fetchFirstColumn(
            'SELECT DISTINCT u.allergies::text
             FROM "user" u
             JOIN consultation c ON c.patient_id = u.id
             WHERE c.medecin_id = :uid AND u.allergies IS NOT NULL',
            ['uid' => $this->userId($medecin)]
        );

        // Agrège en PHP (tableaux JSON de petite taille).
        $counts = [];
        foreach ($rows as $json) {
            $list = $this->decodeAllergies($json);
            foreach ($list as $name) {
                $name = trim((string) $name);
                if ($name === '') {
                    continue;
                }
                $counts[$name] = ($counts[$name] ?? 0) + 1;
            }
        }

        arsort($counts);

        $top = [];
        $i = 0;
        foreach ($counts as $name => $count) {
            if ($i++ >= self::TOP_ALLERGIES_LIMIT) {
                break;
            }
            $top[] = ['name' => $name, 'count' => $count];
        }

        return $top;
    }

    /**
     * Top motifs de consultation.
     *
     * @return array<int, array{motif: string, count: int}>
     */
    private function buildTopMotifs(Connection $conn, Medecin $medecin): array
    {
        $rows = $conn->fetchAllAssociative(
            'SELECT motif, COUNT(*) AS n
             FROM consultation
             WHERE medecin_id = :uid AND motif IS NOT NULL AND motif <> \'\'
             GROUP BY motif
             ORDER BY n DESC
             LIMIT ' . self::TOP_MOTIFS_LIMIT,
            ['uid' => $this->userId($medecin)]
        );

        return array_map(
            static fn (array $row) => ['motif' => (string) $row['motif'], 'count' => (int) $row['n']],
            $rows
        );
    }

    /**
     * Série temporelle du volume de consultations sur N jours.
     *
     * @return array<int, array{date: string, count: int}>
     */
    private function buildTimeline(Connection $conn, Medecin $medecin, int $days): array
    {
        $rows = $conn->fetchAllAssociative(
            'SELECT DATE(created_at) AS d, COUNT(*) AS n
             FROM consultation
             WHERE medecin_id = :uid AND created_at >= (CURRENT_DATE - INTERVAL \'' . $days . ' days\')
             GROUP BY d
             ORDER BY d ASC',
            ['uid' => $this->userId($medecin)]
        );

        // Complète les jours sans consultation (trous dans la série).
        $series = [];
        $byDate = [];
        foreach ($rows as $row) {
            $byDate[(string) $row['d']] = (int) $row['n'];
        }
        $today = new \DateTimeImmutable('today');
        for ($i = $days - 1; $i >= 0; $i--) {
            $day = $today->modify("-{$i} days")->format('Y-m-d');
            $series[] = [
                'date' => $day,
                'count' => $byDate[$day] ?? 0,
            ];
        }

        return $series;
    }

    /**
     * Statistiques d'avis via le repository (note moyenne + distribution).
     *
     * @return array{noteMoyenne: float, totalAvis: int, distribution: array<int, int>}
     */
    private function buildAvisStats(Medecin $medecin): array
    {
        $noteMoyenne = $this->avisRepository->getNoteMoyenne($medecin);
        $distribution = $this->avisRepository->getNoteDistribution($medecin);

        $totalAvis = array_sum($distribution);

        return [
            'noteMoyenne' => $noteMoyenne,
            'totalAvis' => $totalAvis,
            'distribution' => $distribution,
        ];
    }

    /**
     * Compte les messages non lus (1 requête optimisée).
     */
    private function countUnreadMessages(Medecin $medecin): int
    {
        return (int) $this->entityManager->createQueryBuilder()
            ->select('COUNT(m.id)')
            ->from(Message::class, 'm')
            ->join('m.conversation', 'conv')
            ->join('conv.participants', 'part')
            ->where('part = :user')
            ->andWhere('m.expediteur != :user')
            ->andWhere('m.statut != :statut_lu')
            ->setParameter('user', $medecin)
            ->setParameter('statut_lu', Message::STATUT_LU)
            ->getQuery()
            ->getSingleScalarResult();
    }

    /**
     * Consultations actives (non terminées/annulées) — top 5 pour le widget.
     *
     * @return Consultation[]
     */
    private function fetchActiveConsultations(Medecin $medecin): array
    {
        return $this->entityManager->createQueryBuilder()
            ->select('c', 'p')
            ->from(Consultation::class, 'c')
            ->leftJoin('c.patient', 'p')
            ->where('c.medecin = :medecin')
            ->andWhere('c.statut NOT IN (:excluded)')
            ->setParameter('medecin', $medecin)
            ->setParameter('excluded', [Consultation::STATUT_TERMINEE, Consultation::STATUT_ANNULEE])
            ->orderBy('c.createdAt', 'DESC')
            ->setMaxResults(self::WIDGET_LIMIT)
            ->getQuery()
            ->getResult();
    }

    /**
     * Consultations à risque (priorité urgente/critique, non terminées) — top 5.
     *
     * @return Consultation[]
     */
    private function fetchRiskConsultations(Medecin $medecin): array
    {
        return $this->entityManager->createQueryBuilder()
            ->select('c', 'p')
            ->from(Consultation::class, 'c')
            ->leftJoin('c.patient', 'p')
            ->where('c.medecin = :medecin')
            ->andWhere('c.priorite IN (:risk)')
            ->andWhere('c.statut NOT IN (:excluded)')
            ->setParameter('medecin', $medecin)
            ->setParameter('risk', [Consultation::PRIORITE_URGENTE, Consultation::PRIORITE_CRITIQUE])
            ->setParameter('excluded', [Consultation::STATUT_TERMINEE, Consultation::STATUT_ANNULEE])
            ->orderBy('c.priorite', 'DESC') // CRITIQUE avant URGENTE
            ->addOrderBy('c.createdAt', 'DESC')
            ->setMaxResults(self::WIDGET_LIMIT)
            ->getQuery()
            ->getResult();
    }

    /**
     * Prochains rendez-vous (date future), triés chronologiquement — top 5.
     *
     * @return Consultation[]
     */
    private function fetchUpcomingAppointments(Medecin $medecin): array
    {
        return $this->entityManager->createQueryBuilder()
            ->select('c', 'p')
            ->from(Consultation::class, 'c')
            ->leftJoin('c.patient', 'p')
            ->where('c.medecin = :medecin')
            ->andWhere('c.dateConsultation IS NOT NULL')
            ->andWhere('c.dateConsultation > :now')
            ->setParameter('medecin', $medecin)
            ->setParameter('now', new \DateTimeImmutable())
            ->orderBy('c.dateConsultation', 'ASC')
            ->setMaxResults(self::WIDGET_LIMIT)
            ->getQuery()
            ->getResult();
    }

    /**
     * 5 derniers patients distincts (pour le widget "Patients récents").
     *
     * @return Medecin[]|\App\Entity\Patient[] Liste de patients.
     */
    private function fetchRecentPatients(Medecin $medecin): array
    {
        $conn = $this->entityManager->getConnection();
        $recentIds = $conn->fetchFirstColumn(
            'SELECT patient_id FROM consultation WHERE medecin_id = :uid GROUP BY patient_id ORDER BY MAX(created_at) DESC LIMIT ' . self::WIDGET_LIMIT,
            ['uid' => $this->userId($medecin)]
        );

        if ($recentIds === []) {
            return [];
        }

        return $this->entityManager->createQueryBuilder()
            ->select('p')
            ->from(\App\Entity\Patient::class, 'p')
            ->where('p.id IN (:ids)')
            ->setParameter('ids', $recentIds)
            ->getQuery()
            ->getResult();
    }

    /**
     * Convertit l'UUID du médecin en chaîne bindable par DBAL.
     */
    private function userId(Medecin $medecin): string
    {
        $id = $medecin->getId();

        return $id !== null ? (string) $id : '';
    }

    /**
     * Décode une valeur JSON d'allergies (PostgreSQL renvoie déjà un tableau
     * pour les colonnes JSON, mais on gère les deux cas par sécurité).
     *
     * @return string[]
     */
    private function decodeAllergies(mixed $json): array
    {
        if (is_array($json)) {
            return array_values(array_filter($json, 'is_string'));
        }
        if (is_string($json)) {
            try {
                $decoded = json_decode($json, true, 8, JSON_THROW_ON_ERROR);
            } catch (\JsonException) {
                return [];
            }

            return is_array($decoded) ? array_values(array_filter($decoded, 'is_string')) : [];
        }

        return [];
    }
}
