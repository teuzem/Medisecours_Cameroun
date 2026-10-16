<?php

declare(strict_types=1);

namespace App\Controller;

use App\Entity\CentreDeSante;
use App\Entity\DemandeSos;
use App\Entity\User;
use App\Repository\DemandeSosRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\Routing\Annotation\Route;

/**
 * Centre de contrôle SOS de l'administration centrale.
 *
 * Vision nationale : toutes les structures, tous les statuts, toutes les
 * interventions, avec des analytiquesAdvanced permettant de mesurer la
 * performance du réseau (délais, taux de fraude, preuves, répartition
 * médecin / ambulancier) et d'identifier les établissements à risque.
 *
 * Réservé à ROLE_ADMIN : c'est la seule surface qui expose l'ensemble du
 * réseau, proofs comprises.
 */
final class AdminSosController extends AbstractController
{
    /** Délai au-delà duquel une alerte non prise en charge est considérée en retard. */
    private const SEUIL_RETARD_SEC = 900;

    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly DemandeSosRepository $sosRepository,
    ) {
    }

    // ── Fil national ────────────────────────────────────────────────────────

    /**
     * GET /api/admin/sos/alertes
     *   ?statut=&gravite=&centre=&jours=30&limit=100
     *
     * Tri par priorité de triage puis ancienneté : la caserne voit d'abord
     * ce qui peut tuer, pas ce qui est le plus récent.
     */
    #[Route('/api/admin/sos/alertes', name: 'api_admin_sos_alertes', methods: ['GET'])]
    public function alertes(Request $request): JsonResponse
    {
        $this->assertAdmin();

        $jours = min(365, max(1, (int) $request->query->get('jours', 30)));
        $limite = min(300, max(1, (int) $request->query->get('limit', 100)));

        $qb = $this->em->createQueryBuilder()
            ->select('d')
            ->from(DemandeSos::class, 'd')
            ->where('d.createdAt >= :depuis')
            ->setParameter('depuis', new \DateTimeImmutable('-' . $jours . ' days'));

        $statuts = $this->listeParam($request, 'statut', ['EN_COURS', 'VERIFIEE', 'EN_PRISE_EN_CHARGE', 'TRAITEE', 'FRAUDULEUSE', 'CLOTUREE']);
        if ($statuts !== []) {
            $qb->andWhere('d.statut IN (:statuts)')->setParameter('statuts', $statuts);
        }
        $gravites = $this->listeParam($request, 'gravite', DemandeSos::GRAVITES);
        if ($gravites !== []) {
            $qb->andWhere('d.gravite IN (:gravites)')->setParameter('gravites', $gravites);
        }
        $centreId = (int) $request->query->get('centre', 0);
        if ($centreId > 0) {
            $qb->andWhere('IDENTITY(d.etablissement) = :centre')->setParameter('centre', $centreId);
        }
        $sansCible = filter_var($request->query->get('sansCible'), FILTER_VALIDATE_BOOLEAN);
        if ($sansCible) {
            $qb->andWhere('d.etablissement IS NULL');
        }

        $alertes = $qb
            ->orderBy('d.createdAt', 'DESC')
            ->setMaxResults($limite)
            ->getQuery()
            ->getResult();

        $ouvertes = 0;
        $enRetard = 0;
        $maintenant = new \DateTimeImmutable();
        $items = array_map(function (DemandeSos $sos) use (&$ouvertes, &$enRetard, $maintenant): array {
            $statut = $sos->getStatut();
            if (in_array($statut, ['EN_COURS', 'VERIFIEE', 'EN_PRISE_EN_CHARGE'], true)) {
                $ouvertes++;
                if ($sos->getPrisEnChargeAt() === null
                    && ($maintenant->getTimestamp() - $sos->getCreatedAt()->getTimestamp()) > self::SEUIL_RETARD_SEC) {
                    $enRetard++;
                }
            }

            return $this->serialize($sos);
        }, $alertes);

        return new JsonResponse([
            'filtre' => [
                'jours' => $jours,
                'statut' => $statuts,
                'gravite' => $gravites,
                'centre' => $centreId > 0 ? $centreId : null,
            ],
            'ouvertes' => $ouvertes,
            'enRetard' => $enRetard,
            'alertes' => $items,
        ]);
    }

    // ── Analytiques avancées ───────────────────────────────────────────────

    /**
     * GET /api/admin/sos/stats?jours=30
     *
     * Agrégats réseau : tendance journalière, gravité, afflux horaire,
     * nature des preuves, délais moyens par étape, répartition des
     * intervenants, classement des établissements les plus sollicités et
     * compteurs de retard (alerte non prise en charge au-delà de 15 min).
     */
    #[Route('/api/admin/sos/stats', name: 'api_admin_sos_stats', methods: ['GET'])]
    public function stats(Request $request): JsonResponse
    {
        $this->assertAdmin();

        $jours = min(365, max(1, (int) $request->query->get('jours', 30)));
        $depuis = new \DateTimeImmutable('-' . $jours . ' days');

        $alertes = $this->em->createQueryBuilder()
            ->select('d')
            ->from(DemandeSos::class, 'd')
            ->where('d.createdAt >= :depuis')
            ->setParameter('depuis', $depuis)
            ->orderBy('d.createdAt', 'DESC')
            ->setMaxResults(2000)
            ->getQuery()
            ->getResult();

        $parJour = [];
        for ($j = $jours - 1; $j >= 0; $j--) {
            $parJour[(new \DateTimeImmutable())->modify('-' . $j . ' days')->format('Y-m-d')] = 0;
        }
        $parStatut = ['EN_COURS' => 0, 'VERIFIEE' => 0, 'EN_PRISE_EN_CHARGE' => 0, 'TRAITEE' => 0, 'FRAUDULEUSE' => 0, 'CLOTUREE' => 0];
        $parGravite = ['LEGERE' => 0, 'URGENTE' => 0, 'CRITIQUE' => 0];
        $parHeure = array_fill(0, 24, 0);
        $parIntervenant = ['MEDECIN' => 0, 'AMBULANCIER' => 0, 'NON_POURVU' => 0];
        $preuves = ['PHOTO' => 0, 'VIDEO' => 0, 'AUCUNE' => 0];
        $delais = ['verification' => [], 'priseEnCharge' => [], 'depart' => [], 'arrivee' => [], 'resolution' => []];
        $parEtablissement = [];
        $ouvertes = 0;
        $sirenesActives = 0;
        $enRetard = 0;
        $demandeursConnectes = 0;
        $maintenant = new \DateTimeImmutable();

        foreach ($alertes as $sos) {
            $statut = $sos->getStatut();
            $parStatut[$statut] = ($parStatut[$statut] ?? 0) + 1;
            $parGravite[$sos->getGravite()] = ($parGravite[$sos->getGravite()] ?? 0) + 1;
            $parHeure[(int) $sos->getCreatedAt()->format('G')]++;

            $cleJour = $sos->getCreatedAt()->format('Y-m-d');
            if (array_key_exists($cleJour, $parJour)) {
                $parJour[$cleJour]++;
            }

            if ($sos->getUser() !== null) {
                $demandeursConnectes++;
            }
            if ($sos->isSireneActive()) {
                $sirenesActives++;
            }
            if (in_array($statut, ['EN_COURS', 'VERIFIEE', 'EN_PRISE_EN_CHARGE'], true)) {
                $ouvertes++;
                if ($sos->getPrisEnChargeAt() === null
                    && ($maintenant->getTimestamp() - $sos->getCreatedAt()->getTimestamp()) > self::SEUIL_RETARD_SEC) {
                    $enRetard++;
                }
            }

            $type = $sos->getPriseEnChargeType();
            if ($type === 'MEDECIN' || $type === 'AMBULANCIER') {
                $parIntervenant[$type]++;
            } elseif ($sos->getPrisEnChargePar() !== null) {
                $parIntervenant['NON_POURVU']++;
            }

            if ($sos->getPreuveType() === DemandeSos::PREUVE_VIDEO) {
                $preuves['VIDEO']++;
            } elseif ($sos->getPreuveType() === DemandeSos::PREUVE_PHOTO || $sos->getPreuvePhoto() !== null) {
                $preuves['PHOTO']++;
            } else {
                $preuves['AUCUNE']++;
            }

            $priseEnCharge = $sos->getPrisEnChargeAt();
            $verifie = $sos->getVerifieAt();
            $depart = $sos->getDepartAt();
            $arrivee = $sos->getArriveeAt();
            $resolu = $sos->getResoluAt();
            if ($verifie) {
                $delais['verification'][] = $verifie->getTimestamp() - $sos->getCreatedAt()->getTimestamp();
            }
            if ($priseEnCharge && $verifie) {
                $delais['priseEnCharge'][] = $priseEnCharge->getTimestamp() - $verifie->getTimestamp();
            }
            if ($depart && $priseEnCharge) {
                $delais['depart'][] = $depart->getTimestamp() - $priseEnCharge->getTimestamp();
            }
            if ($arrivee && $priseEnCharge) {
                $delais['arrivee'][] = $arrivee->getTimestamp() - $priseEnCharge->getTimestamp();
            }
            if ($resolu) {
                $delais['resolution'][] = $resolu->getTimestamp() - $sos->getCreatedAt()->getTimestamp();
            }

            $centre = $sos->getEtablissement();
            $cleCentre = $centre !== null ? (string) $centre->getId() : 'SANS_CIBLE';
            if (!isset($parEtablissement[$cleCentre])) {
                $parEtablissement[$cleCentre] = [
                    'id' => $centre?->getId(),
                    'nom' => $centre?->getNom() ?? '—',
                    'ville' => $centre?->getVille(),
                    'total' => 0,
                    'ouvertes' => 0,
                    'sommeDelai' => 0,
                    'mesures' => 0,
                    'critiques' => 0,
                ];
            }
            $parEtablissement[$cleCentre]['total']++;
            $parEtablissement[$cleCentre]['critiques'] += $sos->getGravite() === DemandeSos::GRAVITE_CRITIQUE ? 1 : 0;
            if (in_array($statut, ['EN_COURS', 'VERIFIEE', 'EN_PRISE_EN_CHARGE'], true)) {
                $parEtablissement[$cleCentre]['ouvertes']++;
            }
            if ($resolu) {
                $parEtablissement[$cleCentre]['sommeDelai'] += $resolu->getTimestamp() - $sos->getCreatedAt()->getTimestamp();
                $parEtablissement[$cleCentre]['mesures']++;
            }
        }

        $moyenne = static fn (array $valeurs): ?int => $valeurs === [] ? null : (int) round(array_sum($valeurs) / count($valeurs));

        $classement = array_values($parEtablissement);
        usort($classement, static fn (array $a, array $b): int => [$b['total'], $b['critiques']] <=> [$a['total'], $a['critiques']]);
        foreach ($classement as &$ligne) {
            $ligne['delaiMoyenResolutionSec'] = $ligne['mesures'] > 0
                ? (int) round($ligne['sommeDelai'] / $ligne['mesures'])
                : null;
            unset($ligne['sommeDelai'], $ligne['mesures']);
        }
        unset($ligne);

        $serie = [];
        foreach ($parJour as $jour => $nombre) {
            $serie[] = ['jour' => $jour, 'total' => $nombre];
        }
        $parHeureFormat = [];
        foreach ($parHeure as $heure => $nombre) {
            $parHeureFormat[] = ['heure' => sprintf('%02dh', $heure), 'total' => $nombre];
        }

        $total = count($alertes);
        $avecPreuve = $preuves['PHOTO'] + $preuves['VIDEO'];

        return new JsonResponse([
            'jours' => $jours,
            'total' => $total,
            'ouvertes' => $ouvertes,
            'enRetard' => $enRetard,
            'sirenesActives' => $sirenesActives,
            'tauxPreuve' => $total > 0 ? round($avecPreuve / $total, 3) : null,
            'tauxFrauduleuses' => $total > 0 ? round($parStatut['FRAUDULEUSE'] / $total, 3) : null,
            'tauxDemandeursConnectes' => $total > 0 ? round($demandeursConnectes / $total, 3) : null,
            'serieJour' => $serie,
            'parStatut' => $parStatut,
            'parGravite' => $parGravite,
            'parHeure' => $parHeureFormat,
            'parIntervenant' => $parIntervenant,
            'preuves' => $preuves,
            'delais' => [
                'verification' => $moyenne($delais['verification']),
                'priseEnCharge' => $moyenne($delais['priseEnCharge']),
                'depart' => $moyenne($delais['depart']),
                'arrivee' => $moyenne($delais['arrivee']),
                'resolution' => $moyenne($delais['resolution']),
            ],
            'topEtablissements' => array_slice($classement, 0, 10),
        ]);
    }

    /**
     * Identifiants des administrateurs connectés : cibles du canal temps réel
     * du centre de contrôle. Résolu à chaque transition pour éviter un cache
     * de rôles qui deviendrait faux après une révocation.
     *
     * @return list<string>
     */
    public static function idsAdministrateurs(EntityManagerInterface $em): array
    {
        try {
            $lignes = $em->getConnection()->executeQuery(
                'SELECT id FROM "user" WHERE roles::text LIKE :role',
                ['role' => '%ROLE_ADMIN%'],
            )->fetchAllAssociative();
        } catch (\Throwable) {
            return [];
        }

        return array_values(array_map(static fn (array $ligne): string => (string) $ligne['id'], $lignes));
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private function assertAdmin(): void
    {
        $user = $this->getUser();
        if (!$user instanceof User || !in_array('ROLE_ADMIN', $user->getRoles(), true)) {
            throw new AccessDeniedHttpException('Accès réservé aux administrateurs.');
        }
    }

    /**
     * @param list<string> $autorises
     *
     * @return list<string>
     */
    private function listeParam(Request $request, string $cle, array $autorises): array
    {
        $brut = (string) $request->query->get($cle, '');
        if (trim($brut) === '') {
            return [];
        }
        $valeurs = array_values(array_filter(array_map(
            static fn (string $v): string => strtoupper(trim($v)),
            explode(',', $brut)
        )));

        return array_values(array_intersect($valeurs, $autorises));
    }

    private function serialize(DemandeSos $sos): array
    {
        $etablissement = $sos->getEtablissement();
        $priseEnCharge = $sos->getPrisEnChargePar();

        return [
            'id' => $sos->getId(),
            'statut' => $sos->getStatut(),
            'gravite' => $sos->getGravite(),
            'urgenceVitale' => $sos->isUrgenceVitale(),
            'agePatient' => $sos->getAgePatient(),
            'enceinte' => $sos->isEnceinte(),
            'nom' => $sos->getNom(),
            'telephone' => $sos->getTelephone(),
            'description' => $sos->getDescription(),
            'latitude' => $sos->getLatitude(),
            'longitude' => $sos->getLongitude(),
            'sireneActive' => $sos->isSireneActive(),
            'preuveType' => $sos->getPreuveType(),
            'etablissement' => $etablissement instanceof CentreDeSante ? [
                'id' => $etablissement->getId(),
                'nom' => $etablissement->getNom(),
                'ville' => $etablissement->getVille(),
            ] : null,
            'verifiePar' => $sos->getVerifiePar() ? trim(($sos->getVerifiePar()->getPrenom() ?? '') . ' ' . ($sos->getVerifiePar()->getNom() ?? '')) : null,
            'verifieAt' => $sos->getVerifieAt()?->format('c'),
            'prisEnChargePar' => $priseEnCharge ? trim(($priseEnCharge->getPrenom() ?? '') . ' ' . ($priseEnCharge->getNom() ?? '')) : null,
            'priseEnChargeType' => $sos->getPriseEnChargeType(),
            'prisEnChargeAt' => $sos->getPrisEnChargeAt()?->format('c'),
            'departAt' => $sos->getDepartAt()?->format('c'),
            'arriveeAt' => $sos->getArriveeAt()?->format('c'),
            'patientEmbarqueAt' => $sos->getPatientEmbarqueAt()?->format('c'),
            'noteIntervention' => $sos->getNoteIntervention(),
            'resoluAt' => $sos->getResoluAt()?->format('c'),
            'createdAt' => $sos->getCreatedAt()->format('c'),
        ];
    }
}