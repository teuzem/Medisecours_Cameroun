<?php

declare(strict_types=1);

namespace App\Controller;

use App\Entity\CentreDeSante;
use App\Entity\EtablissementEquipe;
use App\Entity\EvenementEtablissement;
use App\Entity\Medecin;
use App\Entity\User;
use App\Repository\AffiliationMedecinRepository;
use App\Repository\CentreDeSanteRepository;
use App\Repository\EtablissementEquipeRepository;
use App\Repository\EvenementEtablissementRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\Routing\Annotation\Route;

/**
 * API "Analytiques des fiches établissements".
 *
 * - POST /api/carte/evenements : enregistrement public d'une interaction
 *   (visite de fiche, appel, itinéraire, partage, sauvegarde, SOS…).
 * - GET  /api/carte/evenements : agrégations temps réel pour le manager de
 *   l'établissement (ou vue globale pour les admins).
 */
class EvenementController extends AbstractController
{
    public function __construct(
        private EntityManagerInterface $em,
        private CentreDeSanteRepository $centreRepository,
        private EvenementEtablissementRepository $evenementRepository,
        private AffiliationMedecinRepository $affiliationRepository,
        private EtablissementEquipeRepository $equipeRepository,
    ) {
    }

    /**
     * Enregistrement public d'une interaction sur une fiche établissement.
     *
     * POST /api/carte/evenements
     * Body : {"centre": <id>, "type": "...", "metadata"?: {...}}
     */
    #[Route('/api/carte/evenements', name: 'api_carte_evenements_enregistrer', methods: ['POST'])]
    public function enregistrer(Request $request): JsonResponse
    {
        $raw = json_decode($request->getContent(), true);
        $data = is_array($raw) ? $raw : [];

        $centreId = $data['centre'] ?? null;
        $type = isset($data['type']) ? trim((string) $data['type']) : '';

        if (!$centreId) {
            throw new BadRequestHttpException('Le paramètre "centre" est obligatoire.');
        }
        if (!in_array($type, EvenementEtablissement::TYPES, true)) {
            throw new BadRequestHttpException('Type d\'interaction inconnu : ' . $type);
        }

        $centre = $this->centreRepository->find((int) $centreId);
        if (!$centre instanceof CentreDeSante) {
            throw new NotFoundHttpException('Établissement introuvable.');
        }

        $evenement = (new EvenementEtablissement())
            ->setEtablissement($centre)
            ->setType($type)
            ->setMetadata(isset($data['metadata']) && is_array($data['metadata']) ? $this->sanitizeMetadata($data['metadata']) : []);

        $user = $this->getUser();
        if ($user instanceof User) {
            $evenement->setUtilisateur($user);
        }

        $this->em->persist($evenement);
        $this->em->flush();

        return new JsonResponse(['ok' => true, 'id' => $evenement->getId()], Response::HTTP_CREATED);
    }

    /**
     * Analytiques temps réel d'une fiche établissement.
     *
     * GET /api/carte/evenements?period=30&centre=&scope=etablissement|global
     * Réservé aux managers (DIRECTEUR/GESTIONNAIRE) ou aux administrateurs.
     */
    #[Route('/api/carte/evenements', name: 'api_carte_evenements_statistiques', methods: ['GET'])]
    public function statistiques(Request $request): JsonResponse
    {
        $user = $this->requireUser();
        $centre = $this->resolveManagedCentre($user, $request);
        $this->assertCanManage($user, $centre);

        $scope = $request->query->get('scope', 'etablissement');
        $global = $scope === 'global' && $this->isAdmin($user);
        $centreId = $global ? null : $centre->getId();

        $days = (int) $request->query->get('period', '30');
        if (!in_array($days, [7, 30, 90, 360], true)) {
            $days = 30;
        }
        $since = new \DateTimeImmutable(sprintf('-%d days', $days));

        $totaux = $this->evenementRepository->totaux($centreId, $since);
        $serieRows = $this->evenementRepository->serieJournaliere($centreId, $since);

        return new JsonResponse([
            'scope' => $global ? 'global' : 'etablissement',
            'centre' => $global ? null : $this->serializeCentreLeger($centre),
            'period' => $days,
            'since' => $since->format('c'),
            'generatedAt' => (new \DateTimeImmutable())->format('c'),
            'totaux' => $totaux,
            'total' => array_sum($totaux),
            'serie' => $this->remplirSerie($since, $days, $serieRows),
            'topServices' => $this->evenementRepository->topServices($centreId, $since),
            'medecinsActivite' => $global
                ? $this->activiteMedecinsGlobal($since)
                : $this->activiteEquipe($centre, $since),
            'equipe' => $this->statsEquipe($centre),
        ]);
    }

    private function requireUser(): User
    {
        $user = $this->getUser();
        if (!$user instanceof User) {
            throw new AccessDeniedHttpException('Authentification requise.');
        }

        return $user;
    }

    private function isAdmin(User $user): bool
    {
        return in_array('ROLE_ADMIN', $user->getRoles(), true);
    }

    private function resolveManagedCentre(User $user, Request $request): CentreDeSante
    {
        if ($this->isAdmin($user)) {
            $centreId = $request->query->get('centre');
            if ($centreId) {
                $centre = $this->centreRepository->find((int) $centreId);
                if ($centre) {
                    return $centre;
                }
            }
        }

        $centre = $this->equipeRepository->findManagedCentre($user);
        if (!$centre) {
            throw new AccessDeniedHttpException(
                'Vous devez avoir un rôle managérial (DIRECTEUR / GESTIONNAIRE) sur un établissement.'
            );
        }

        return $centre;
    }

    private function assertCanManage(User $user, CentreDeSante $centre): void
    {
        if ($this->isAdmin($user) || $this->equipeRepository->canManage($user, $centre)) {
            return;
        }

        throw new AccessDeniedHttpException('Accès réservé aux managers de cet établissement.');
    }

    /**
     * Construit la série journalière complète (aucun jour manquant).
     *
     * @param array<int, array{jour: string, type: string, nb: int}> $rows
     *
     * @return array<int, array{jour: string, type: string, nb: int}>
     */
    private function remplirSerie(\DateTimeImmutable $since, int $days, array $rows): array
    {
        $types = EvenementEtablissement::TYPES;
        $parJour = [];
        foreach ($types as $type) {
            $parJour[$type] = [];
        }

        foreach ($rows as $row) {
            $parJour[$row['type']][$row['jour']] = $row['nb'];
        }

        $out = [];
        $cursor = $since->setTime(0, 0);
        for ($i = 0; $i < $days; ++$i) {
            $jour = $cursor->format('Y-m-d');
            $point = ['jour' => $jour];
            foreach ($types as $type) {
                $point[$type] = $parJour[$type][$jour] ?? 0;
            }
            $out[] = $point;
            $cursor = $cursor->modify('+1 day');
        }

        return $out;
    }

    /**
     * Activité (consultations, prescriptions) des médecins de l'équipe.
     *
     * @return array<int, array<string, mixed>>
     */
    private function activiteEquipe(CentreDeSante $centre, \DateTimeImmutable $since): array
    {
        $medecins = [];
        foreach ($this->affiliationRepository->findValidatedByEtablissement($centre->getId()) as $affiliation) {
            $medecin = $affiliation->getMedecin();
            if ($medecin instanceof Medecin) {
                $medecins[$medecin->getId()] = [
                    'medecin' => $medecin,
                    'fonction' => $affiliation->getFonction(),
                    'salle' => $affiliation->getSalle(),
                    'role' => 'MEDECIN',
                    'teleconsultation' => $affiliation->isTeleconsultation(),
                ];
            }
        }

        foreach ($this->equipeRepository->findActiveByCentre($centre->getId()) as $membre) {
            if ($membre->getRole() !== 'MEDECIN') {
                continue;
            }
            $user = $membre->getUser();
            if ($user instanceof Medecin) {
                $medecins[$user->getId()] = array_merge($medecins[$user->getId()] ?? [
                    'medecin' => $user,
                    'fonction' => null,
                    'salle' => null,
                    'teleconsultation' => false,
                ], ['role' => 'MEDECIN']);
            }
        }

        if ($medecins === []) {
            return [];
        }

        $ids = array_map(static fn (array $m): int => $m['medecin']->getId(), $medecins);
        $activite = $this->compteActiviteMedecins($ids, $since);

        $out = [];
        foreach ($medecins as $id => $info) {
            $medecin = $info['medecin'];
            $a = $activite[$id] ?? ['consultations' => 0, 'prescriptions' => 0, 'dernierActivite' => null];
            $out[] = [
                'medecinId' => $medecin->getId(),
                'nom' => $medecin->getNom(),
                'prenom' => $medecin->getPrenom(),
                'specialite' => method_exists($medecin, 'getSpecialite') ? $medecin->getSpecialite() : null,
                'fonction' => $info['fonction'],
                'salle' => $info['salle'],
                'role' => $info['role'],
                'teleconsultation' => $info['teleconsultation'] ?? false,
                'consultations' => $a['consultations'],
                'prescriptions' => $a['prescriptions'],
                'dernierActivite' => $a['dernierActivite'],
            ];
        }

        usort(
            $out,
            static fn (array $left, array $right): int => ($right['consultations'] + $right['prescriptions'])
                <=> ($left['consultations'] + $left['prescriptions'])
        );

        return $out;
    }

    /**
     * Activité de tous les médecins de la plateforme (vue admin, top 20).
     *
     * @return array<int, array<string, mixed>>
     */
    private function activiteMedecinsGlobal(\DateTimeImmutable $since): array
    {
        $conn = $this->em->getConnection();
        $rows = $conn->fetchAllAssociative(
            'SELECT medecin_id AS mid, COUNT(*) AS nb, MAX(created_at) AS derniere
             FROM consultation
             WHERE medecin_id IS NOT NULL AND created_at >= :since
             GROUP BY medecin_id
             ORDER BY nb DESC
             LIMIT 20',
            ['since' => $since->format('Y-m-d H:i:s')]
        );

        $prRows = $conn->fetchAllAssociative(
            'SELECT medecin_id AS mid, COUNT(*) AS nb
             FROM prescription
             WHERE medecin_id IS NOT NULL AND created_at >= :since
             GROUP BY medecin_id',
            ['since' => $since->format('Y-m-d H:i:s')]
        );

        $prescriptionsByMedecin = [];
        foreach ($prRows as $row) {
            $prescriptionsByMedecin[(int) $row['mid']] = (int) $row['nb'];
        }

        $out = [];
        foreach ($rows as $row) {
            $mid = (int) $row['mid'];
            $user = $this->em->getRepository(User::class)->find($mid);
            if (!$user) {
                continue;
            }
            $out[] = [
                'medecinId' => $mid,
                'nom' => $user->getNom(),
                'prenom' => $user->getPrenom(),
                'specialite' => method_exists($user, 'getSpecialite') ? $user->getSpecialite() : null,
                'fonction' => null,
                'salle' => null,
                'role' => 'MEDECIN',
                'teleconsultation' => false,
                'consultations' => (int) $row['nb'],
                'prescriptions' => $prescriptionsByMedecin[$mid] ?? 0,
                'dernierActivite' => $row['derniere'] ? (new \DateTimeImmutable((string) $row['derniere']))->format('c') : null,
            ];
        }

        return $out;
    }

    /**
     * Comptes consultations/prescriptions par médecin depuis une date.
     *
     * @param int[] $medecinIds
     *
     * @return array<int, array{consultations: int, prescriptions: int, dernierActivite: ?string}>
     */
    private function compteActiviteMedecins(array $medecinIds, \DateTimeImmutable $since): array
    {
        if ($medecinIds === []) {
            return [];
        }

        $conn = $this->em->getConnection();
        $placeholders = implode(',', array_fill(0, count($medecinIds), '?'));
        $params = array_map('strval', array_values($medecinIds));
        $sinceStr = $since->format('Y-m-d H:i:s');

        $consRows = $conn->fetchAllAssociative(
            sprintf(
                'SELECT medecin_id AS mid, COUNT(*) AS nb, MAX(created_at) AS derniere
                 FROM consultation
                 WHERE medecin_id IN (%s) AND created_at >= ?
                 GROUP BY medecin_id',
                $placeholders
            ),
            array_merge($params, [$sinceStr])
        );

        $prRows = $conn->fetchAllAssociative(
            sprintf(
                'SELECT medecin_id AS mid, COUNT(*) AS nb, MAX(created_at) AS derniere
                 FROM prescription
                 WHERE medecin_id IN (%s) AND created_at >= ?
                 GROUP BY medecin_id',
                $placeholders
            ),
            array_merge($params, [$sinceStr])
        );

        $out = [];
        foreach ($medecinIds as $id) {
            $out[$id] = ['consultations' => 0, 'prescriptions' => 0, 'dernierActivite' => null];
        }
        foreach ($consRows as $row) {
            $out[(int) $row['mid']]['consultations'] = (int) $row['nb'];
            if ($row['derniere']) {
                $out[(int) $row['mid']]['dernierActivite'] = (new \DateTimeImmutable((string) $row['derniere']))->format('c');
            }
        }
        foreach ($prRows as $row) {
            $out[(int) $row['mid']]['prescriptions'] = (int) $row['nb'];
            if (null === $out[(int) $row['mid']]['dernierActivite'] && $row['derniere']) {
                $out[(int) $row['mid']]['dernierActivite'] = (new \DateTimeImmutable((string) $row['derniere']))->format('c');
            }
        }

        return $out;
    }

    /**
     * @return array{actifs: array<string, int>, total: int, medecinsAffilies: int}
     */
    private function statsEquipe(CentreDeSante $centre): array
    {
        $actifs = ['DIRECTEUR' => 0, 'GESTIONNAIRE' => 0, 'MEDECIN' => 0, 'INFIRMIER' => 0, 'LECTURE' => 0];
        foreach ($this->equipeRepository->findActiveByCentre($centre->getId()) as $membre) {
            $role = $membre->getRole();
            if (isset($actifs[$role])) {
                ++$actifs[$role];
            }
        }

        return [
            'actifs' => $actifs,
            'total' => array_sum($actifs),
            'medecinsAffilies' => count($this->affiliationRepository->findValidatedByEtablissement($centre->getId())),
        ];
    }

    private function serializeCentreLeger(CentreDeSante $centre): array
    {
        return [
            'id' => $centre->getId(),
            'nom' => $centre->getNom(),
            'type' => $centre->getType(),
            'ville' => $centre->getVille(),
            'region' => $centre->getRegion(),
            'latitude' => $centre->getLatitude(),
            'longitude' => $centre->getLongitude(),
            'noteMoyenne' => $centre->getNoteMoyenne(),
            'totalAvis' => $centre->getTotalAvis(),
        ];
    }

    /**
     * @param array<mixed> $raw
     *
     * @return array<string, string|int|float|bool|null>
     */
    private function sanitizeMetadata(array $raw): array
    {
        $out = [];
        foreach ($raw as $key => $value) {
            if (count($out) >= 10) {
                break;
            }
            if (!is_string($key)) {
                continue;
            }
            if (is_string($value)) {
                $value = trim(mb_substr($value, 0, 120));
            }
            if (!is_scalar($value) && null !== $value) {
                continue;
            }
            $out[$key] = is_bool($value) ? $value : (is_int($value) ? $value : (is_float($value) ? $value : (string) $value));
        }

        return $out;
    }
}