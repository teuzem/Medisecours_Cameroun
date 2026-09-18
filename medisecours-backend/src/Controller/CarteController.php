<?php

declare(strict_types=1);

namespace App\Controller;

use App\Entity\CentreDeSante;
use App\Entity\EtablissementEquipe;
use App\Entity\EtablissementManager;
use App\Entity\Medecin;
use App\Entity\User;
use App\Repository\AffiliationMedecinRepository;
use App\Repository\AvisEtablissementRepository;
use App\Repository\CentreDeSanteRepository;
use App\Repository\DemandeSosRepository;
use App\Repository\EtablissementEquipeRepository;
use App\Repository\UserRepository;
use App\Service\StructureSyncService;
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
 * API "Carte Santé" — rôle établissement.
 *
 * Gestion par niveau d'accès au sein de la hiérarchie de l'établissement :
 *  - mon-etablissement : établissement rattaché à l'utilisateur connecté,
 *  - equipes           : gestion des membres et de leurs niveaux d'accès
 *    (DIRECTEUR / GESTIONNAIRE / MEDECIN / INFIRMIER / LECTURE),
 *  - dashboard         : indicateurs temps réel (SOS, avis, équipe, médecins).
 *
 * Seuls les managers (DIRECTEUR/GESTIONNAIRE) ou un admin (ROLE_ADMIN)
 * peuvent gérer l'équipe et consulter le tableau de bord.
 */
class CarteController extends AbstractController
{
    public function __construct(
        private EntityManagerInterface $em,
        private CentreDeSanteRepository $centreRepository,
        private UserRepository $userRepository,
        private EtablissementEquipeRepository $equipeRepository,
        private AffiliationMedecinRepository $affiliationRepository,
        private AvisEtablissementRepository $avisRepository,
        private DemandeSosRepository $sosRepository,
        private StructureSyncService $structureSync
    ) {
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

    /**
     * Centre visé (via query/body, priorité au centre géré par l'utilisateur).
     * Vérifie les droits managériaux quand l'utilisateur n'est pas admin.
     */
    private function resolveManagedCentre(User $user, Request $request): CentreDeSante
    {
        if ($this->isAdmin($user)) {
            $centreId = $request->query->get('centre')
                ?? (method_exists($request, 'toArray') && $request->getContent()
                    ? ($request->toArray()['centre'] ?? null)
                    : null);

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
     * Établissement rattaché à l'utilisateur connecté.
     *
     * GET /api/carte/mon-etablissement
     */
    #[Route('/api/carte/mon-etablissement', name: 'api_carte_mon_etablissement', methods: ['GET'])]
    public function monEtablissement(): JsonResponse
    {
        $user = $this->requireUser();

        // Manager → établissement dirigé
        $equipe = $this->equipeRepository->findManagedCentre($user);
        if ($equipe) {
            return new JsonResponse([
                'centre' => $this->serializeCentre($equipe),
                'role' => $this->equipeRepository
                    ->findActiveMember($user, $equipe)?->getRole(),
                'statut' => 'ACTIF',
                'via' => 'equipe',
            ]);
        }

        // Médecin affilié (ACCEPTEE) → établissement d'exercice
        if ($user instanceof Medecin) {
            foreach ($this->affiliationRepository->findByMedecin($user) as $affiliation) {
                if ($affiliation->getStatut() === 'ACCEPTEE' && $affiliation->getEtablissement()) {
                    return new JsonResponse([
                        'centre' => $this->serializeCentre($affiliation->getEtablissement()),
                        'role' => 'MEDECIN',
                        'statut' => $affiliation->getStatut(),
                        'via' => 'affiliation',
                    ]);
                }
            }
        }

        return $this->json(['centre' => null, 'role' => null, 'via' => null]);
    }

    /**
     * Liste des membres de l'équipe (gestion des accès par niveau).
     *
     * GET /api/carte/equipes?centre=
     */
    #[Route('/api/carte/equipes', name: 'api_carte_equipes_list', methods: ['GET'])]
    public function listeEquipes(Request $request): JsonResponse
    {
        $user = $this->requireUser();
        $centre = $this->resolveManagedCentre($user, $request);
        $this->assertCanManage($user, $centre);

        $members = array_map(
            static fn (EtablissementEquipe $member): array => [
                'id' => $member->getId(),
                'userId' => (string) $member->getUser()->getId(),
                'nom' => $member->getUser()->getNom(),
                'prenom' => $member->getUser()->getPrenom(),
                'email' => $member->getUser()->getEmail(),
                'photoProfil' => $member->getUser()->getPhotoProfil(),
                'role' => $member->getRole(),
                'statut' => $member->getStatut(),
                'createdAt' => $member->getCreatedAt()->format('c'),
            ],
            $this->equipeRepository->findByCentreOrdered($centre->getId())
        );

        return new JsonResponse(['centreId' => $centre->getId(), 'members' => $members, 'total' => count($members)]);
    }

    /**
     * Ajout d'un membre (par email) à l'équipe de l'établissement.
     *
     * POST /api/carte/equipes   body: {"centre"?: int, "email": string, "role": string}
     */
    #[Route('/api/carte/equipes', name: 'api_carte_equipes_add', methods: ['POST'])]
    public function ajouterMembre(Request $request): JsonResponse
    {
        $user = $this->requireUser();
        $data = $request->toArray();
        $centre = $this->resolveManagedCentre($user, $request);
        $this->assertCanManage($user, $centre);

        $email = trim((string) ($data['email'] ?? ''));
        $role = (string) ($data['role'] ?? 'LECTURE');
        $allowedRoles = ['DIRECTEUR', 'GESTIONNAIRE', 'MEDECIN', 'INFIRMIER', 'LECTURE'];

        if ($email === '') {
            throw new BadRequestHttpException("L'email du membre est obligatoire.");
        }
        if (!in_array($role, $allowedRoles, true)) {
            throw new BadRequestHttpException('Rôle invalide.');
        }

        $target = $this->userRepository->findOneBy(['email' => $email]);
        if (!$target) {
            throw new NotFoundHttpException('Aucun compte MediSecours avec cet email.');
        }
        if ($target === $user && !$this->isAdmin($user)) {
            throw new BadRequestHttpException('Vous êtes déjà manager de cet établissement.');
        }

        $existing = $this->equipeRepository->createQueryBuilder('e')
            ->select('e.id, e.role, e.statut')
            ->where('e.etablissement = :centre')
            ->andWhere('e.user = :user')
            ->setParameters(['centre' => $centre->getId(), 'user' => $target->getId()])
            ->getQuery()
            ->getOneOrNullResult();

        if ($existing) {
            $existing['id'] = (int) $existing['id'];
            return $this->json([
                'member' => [
                    'id' => $existing['id'],
                    'role' => $existing['role'],
                    'statut' => $existing['statut'],
                ],
                'alreadyExists' => true,
            ], Response::HTTP_CONFLICT);
        }

        $member = new EtablissementEquipe();
        $member->setEtablissement($centre);
        $member->setUser($target);
        $member->setRole($role);
        $member->setStatut('ACTIF');
        $member->setInvitePar($user);
        $member->setUpdatedAt(new \DateTimeImmutable());

        $this->em->persist($member);
        $this->em->flush();

        return $this->json([
            'member' => [
                'id' => $member->getId(),
                'userId' => (string) $member->getUser()->getId(),
                'nom' => $member->getUser()->getNom(),
                'prenom' => $member->getUser()->getPrenom(),
                'email' => $member->getUser()->getEmail(),
                'role' => $member->getRole(),
                'statut' => $member->getStatut(),
            ],
        ], Response::HTTP_CREATED);
    }

    /**
     * Modification du rôle / statut d'un membre.
     *
     * PATCH /api/carte/equipes/{id}   body: {"role"?: string, "statut"?: string}
     */
    #[Route('/api/carte/equipes/{id}', name: 'api_carte_equipes_update', methods: ['PATCH'])]
    public function modifierMembre(Request $request, int $id): JsonResponse
    {
        $user = $this->requireUser();
        $member = $this->em->getRepository(EtablissementEquipe::class)->find($id);
        if (!$member || !$member->getEtablissement()) {
            throw new NotFoundHttpException('Membre introuvable.');
        }
        $this->assertCanManage($user, $member->getEtablissement());

        $data = $request->toArray();

        if (isset($data['role'])) {
            $allowedRoles = ['DIRECTEUR', 'GESTIONNAIRE', 'MEDECIN', 'INFIRMIER', 'LECTURE'];
            if (!in_array((string) $data['role'], $allowedRoles, true)) {
                throw new BadRequestHttpException('Rôle invalide.');
            }
            $member->setRole((string) $data['role']);
        }

        if (isset($data['statut'])) {
            if (!in_array((string) $data['statut'], ['INVITE', 'ACTIF', 'REVOQUE'], true)) {
                throw new BadRequestHttpException('Statut invalide.');
            }
            $member->setStatut((string) $data['statut']);
        }

        $member->setUpdatedAt(new \DateTimeImmutable());
        $this->em->flush();

        return $this->json([
            'member' => [
                'id' => $member->getId(),
                'userId' => (string) $member->getUser()->getId(),
                'nom' => $member->getUser()->getNom(),
                'prenom' => $member->getUser()->getPrenom(),
                'email' => $member->getUser()->getEmail(),
                'role' => $member->getRole(),
                'statut' => $member->getStatut(),
            ],
        ]);
    }

    /**
     * Retrait d'un membre de l'équipe.
     *
     * DELETE /api/carte/equipes/{id}
     */
    #[Route('/api/carte/equipes/{id}', name: 'api_carte_equipes_delete', methods: ['DELETE'])]
    public function supprimerMembre(int $id): JsonResponse
    {
        $user = $this->requireUser();
        $member = $this->em->getRepository(EtablissementEquipe::class)->find($id);
        if (!$member || !$member->getEtablissement()) {
            throw new NotFoundHttpException('Membre introuvable.');
        }
        $this->assertCanManage($user, $member->getEtablissement());

        $this->em->remove($member);
        $this->em->flush();

        return new JsonResponse(['deleted' => true], Response::HTTP_NO_CONTENT);
    }

    /**
     * Tableau de bord temps réel de l'établissement.
     *
     * GET /api/carte/dashboard?centre=
     */
    #[Route('/api/carte/dashboard', name: 'api_carte_dashboard', methods: ['GET'])]
    public function dashboard(Request $request): JsonResponse
    {
        $user = $this->requireUser();
        $centre = $this->resolveManagedCentre($user, $request);
        $this->assertCanManage($user, $centre);

        $sosStats = $this->sosRepository->statsForEtablissement($centre->getId());

        // Avis : volume + répartition par statut
        $avisStats = [
            'total' => $centre->getTotalAvis(),
            'noteMoyenne' => round($centre->getNoteMoyenne(), 1),
            'totalEnBase' => (int) $this->avisRepository->createQueryBuilder('a')
                ->select('COUNT(a.id)')
                ->where('a.etablissement = :centre')
                ->setParameter('centre', $centre->getId())
                ->getQuery()->getSingleScalarResult(),
        ];

        // Médecins affiliés
        $medecinsStats = [
            'acceptes' => count($this->affiliationRepository->findValidatedByEtablissement($centre->getId())),
            'enAttente' => (int) $this->affiliationRepository->createQueryBuilder('a')
                ->select('COUNT(a.id)')
                ->where('a.etablissement = :centre')
                ->andWhere('a.statut = :statut')
                ->setParameters(['centre' => $centre->getId(), 'statut' => 'EN_ATTENTE'])
                ->getQuery()->getSingleScalarResult(),
        ];

        // Équipe : effectif par rôle
        $equipeStats = ['DIRECTEUR' => 0, 'GESTIONNAIRE' => 0, 'MEDECIN' => 0, 'INFIRMIER' => 0, 'LECTURE' => 0, 'total' => 0];
        foreach ($this->equipeRepository->findByCentreOrdered($centre->getId()) as $member) {
            $role = $member->getRole();
            if (array_key_exists($role, $equipeStats)) {
                ++$equipeStats[$role];
            }
            ++$equipeStats['total'];
        }

        return new JsonResponse([
            'centre' => $this->serializeCentre($centre),
            'sos' => $sosStats,
            'avis' => $avisStats,
            'medecins' => $medecinsStats,
            'equipe' => $equipeStats,
            'generatedAt' => (new \DateTimeImmutable())->format('c'),
        ]);
    }

    /**
     * Réclamation d'un établissement par un manager (compte "etablissement").
     *
     * POST /api/carte/revendiquer   body: {"centre": int, "force"?: bool}
     * Crée / réactive le rattachement DIRECTEUR ACTIF de l'utilisateur au centre.
     */
    #[Route('/api/carte/revendiquer', name: 'api_carte_revendiquer', methods: ['POST'])]
    public function revendiquer(Request $request): JsonResponse
    {
        $user = $this->requireUser();

        if (!$user instanceof EtablissementManager && !$this->isAdmin($user)) {
            throw new AccessDeniedHttpException('Un compte de type établissement est requis.');
        }

        $data = $request->toArray();
        $centreId = isset($data['centre']) ? (int) $data['centre'] : 0;
        $centre = $centreId > 0 ? $this->centreRepository->find($centreId) : null;
        if (!$centre) {
            throw new NotFoundHttpException('Établissement introuvable.');
        }

        $existing = $this->equipeRepository->findActiveMember($user, $centre);
        if ($existing) {
            return new JsonResponse([
                'centre' => $this->serializeCentre($centre),
                'role' => $existing->getRole(),
                'alreadyClaimed' => true,
            ]);
        }

        $other = $this->equipeRepository->findManagedCentre($user);
        if ($other && $other->getId() !== $centre->getId() && !(bool) ($data['force'] ?? false)) {
            return new JsonResponse(
                ['error' => 'Vous gérez déjà un autre établissement. Passez "force": true pour le remplacer.'],
                Response::HTTP_CONFLICT
            );
        }

        $member = new EtablissementEquipe();
        $member
            ->setEtablissement($centre)
            ->setUser($user)
            ->setRole('DIRECTEUR')
            ->setStatut('ACTIF')
            ->setInvitePar($user)
            ->setUpdatedAt(new \DateTimeImmutable());

        $this->em->persist($member);
        $this->em->flush();

        return new JsonResponse([
            'centre' => $this->serializeCentre($centre),
            'role' => 'DIRECTEUR',
            'alreadyClaimed' => false,
        ], Response::HTTP_CREATED);
    }

    /**
     * Lancement de la synchronisation temps réel des structures (Google Places).
     *
     * POST /api/carte/sync   body: {"limitQuery"?: int, "cap"?: int}
     * Réservé aux administrateurs de plateforme.
     */
    #[Route('/api/carte/sync', name: 'api_carte_sync', methods: ['POST'])]
    public function syncStructures(Request $request): JsonResponse
    {
        $user = $this->requireUser();
        if (!$this->isAdmin($user)) {
            throw new AccessDeniedHttpException('Réservé aux administrateurs.');
        }

        $data = $request->toArray();
        $limitQuery = isset($data['limitQuery']) ? (int) $data['limitQuery'] : 60;
        $cap = isset($data['cap']) ? (int) $data['cap'] : 400;

        $stats = $this->structureSync->sync(null, max(1, min(100, $limitQuery)), max(1, min(2000, $cap)));

        return $this->json($stats);
    }

    /**
     * Statistiques publiques de la carte (volume, types, régions, sources, dernier sync).
     *
     * GET /api/carte/stats
     */
    #[Route('/api/carte/stats', name: 'api_carte_stats', methods: ['GET'])]
    public function stats(): JsonResponse
    {
        $lastSyncValue = $this->em->createQueryBuilder()
            ->select('MAX(c.lastSyncedAt)')
            ->from(CentreDeSante::class, 'c')
            ->getQuery()
            ->getSingleScalarResult();

        return new JsonResponse([
            'total'       => (int) $this->centreRepository->count(['estActif' => true]),
            'parType'     => $this->statsGroup('type'),
            'parRegion'   => $this->statsGroup('region'),
            'parSource'   => $this->statsGroup('source'),
            'dernierSync' => $lastSyncValue
                ? (new \DateTimeImmutable((string) $lastSyncValue))->format('c')
                : null,
            'generatedAt' => (new \DateTimeImmutable())->format('c'),
        ]);
    }

    /**
     * Regroupe les centres actifs par valeur d'une colonne.
     *
     * @return array<string, int>
     */
    private function statsGroup(string $field): array
    {
        $rows = $this->em->createQueryBuilder()
            ->select(sprintf('c.%s AS cle, COUNT(c.id) AS nb', $field))
            ->from(CentreDeSante::class, 'c')
            ->where('c.estActif = true')
            ->groupBy('cle')
            ->getQuery()
            ->getResult();

        $out = [];
        foreach ($rows as $row) {
            $out[(string) $row['cle']] = (int) $row['nb'];
        }

        return $out;
    }

    private function serializeCentre(CentreDeSante $centre): array
    {
        return [
            'id' => $centre->getId(),
            'nom' => $centre->getNom(),
            'type' => $centre->getType(),
            'ville' => $centre->getVille(),
            'region' => $centre->getRegion(),
            'quartier' => $centre->getQuartier(),
            'adresse' => $centre->getAdresse(),
            'telephone' => $centre->getTelephone(),
            'email' => $centre->getEmail(),
            'siteWeb' => $centre->getSiteWeb(),
            'horaires' => $centre->getHoraires(),
            'urgences24h' => $centre->isUrgences24h(),
            'noteMoyenne' => $centre->getNoteMoyenne(),
            'totalAvis' => $centre->getTotalAvis(),
            'verificationStatut' => $centre->getVerificationStatut(),
            'statut' => $centre->getStatut(),
        ];
    }
}