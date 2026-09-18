<?php

declare(strict_types=1);

namespace App\Controller;

use App\Entity\CentreDeSante;
use App\Entity\EtablissementEquipe;
use App\Entity\EtablissementManager;
use App\Entity\AvisEtablissement;
use App\Entity\MediaObject;
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
use Symfony\Component\HttpFoundation\File\UploadedFile;
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
            $centreId = $request->query->get('centre') ?? $request->request->get('centre');
            if (!$centreId && str_contains((string) $request->headers->get('Content-Type'), 'application/json')) {
                $centreId = $request->getContent() ? ($request->toArray()['centre'] ?? null) : null;
            }

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
     * Galerie publique de l'etablissement gere.
     *
     * GET /api/carte/medias?centre=
     */
    #[Route('/api/carte/medias', name: 'api_carte_medias_list', methods: ['GET'])]
    public function listeMedias(Request $request): JsonResponse
    {
        $user = $this->requireUser();
        $centre = $this->resolveManagedCentre($user, $request);
        $this->assertCanManage($user, $centre);

        $items = array_map(
            fn (MediaObject $media): array => $this->serializeMedia($media),
            $centre->getImages()->toArray()
        );

        usort(
            $items,
            static fn (array $left, array $right): int => strcmp($right['createdAt'], $left['createdAt'])
        );

        return new JsonResponse(['items' => $items, 'total' => count($items)]);
    }

    /**
     * Ajout d'une image ou video a la galerie de l'etablissement.
     *
     * POST /api/carte/medias (multipart: file, centre?)
     */
    #[Route('/api/carte/medias', name: 'api_carte_medias_add', methods: ['POST'])]
    public function ajouterMedia(Request $request): JsonResponse
    {
        $user = $this->requireUser();
        $centre = $this->resolveManagedCentre($user, $request);
        $this->assertCanManage($user, $centre);

        $file = $request->files->get('file');
        if (!$file instanceof UploadedFile || !$file->isValid()) {
            throw new BadRequestHttpException('Un fichier image ou video valide est obligatoire.');
        }

        $mimeType = strtolower((string) ($file->getMimeType() ?: $file->getClientMimeType()));
        $allowedMimeTypes = [
            'image/jpeg',
            'image/png',
            'image/webp',
            'image/gif',
            'video/mp4',
            'video/webm',
            'video/quicktime',
        ];
        if (!in_array($mimeType, $allowedMimeTypes, true)) {
            throw new BadRequestHttpException('Format refuse. Utilisez JPEG, PNG, WebP, GIF, MP4, WebM ou MOV.');
        }

        $maxBytes = str_starts_with($mimeType, 'video/') ? 30 * 1024 * 1024 : 10 * 1024 * 1024;
        if (($file->getSize() ?? 0) > $maxBytes) {
            throw new BadRequestHttpException(
                str_starts_with($mimeType, 'video/')
                    ? 'La video ne doit pas depasser 30 Mo.'
                    : "L'image ne doit pas depasser 10 Mo."
            );
        }

        $binary = file_get_contents($file->getPathname());
        if ($binary === false || $binary === '') {
            throw new BadRequestHttpException('Le fichier televerse est vide ou illisible.');
        }

        $extension = strtolower($file->guessExtension() ?: $file->getClientOriginalExtension() ?: 'bin');
        $media = new MediaObject();
        $media
            ->setFilePath(bin2hex(random_bytes(16)) . '.' . preg_replace('/[^a-z0-9]+/', '', $extension))
            ->setOriginalName($file->getClientOriginalName())
            ->setMimeType($mimeType)
            ->setSize(strlen($binary))
            ->setData($binary)
            ->setIsPublic(true)
            ->setPurpose(MediaObject::PURPOSE_GENERAL)
            ->setUploadedBy($user)
            ->setCentre($centre);

        $this->em->persist($media);
        $this->em->flush();

        return new JsonResponse(['media' => $this->serializeMedia($media)], Response::HTTP_CREATED);
    }

    /**
     * Suppression d'un media de la galerie geree.
     */
    #[Route('/api/carte/medias/{id}', name: 'api_carte_medias_delete', methods: ['DELETE'])]
    public function supprimerMedia(Request $request, int $id): JsonResponse
    {
        $user = $this->requireUser();
        $media = $this->em->getRepository(MediaObject::class)->find($id);
        if (!$media || !$media->getCentre()) {
            throw new NotFoundHttpException('Media introuvable.');
        }
        $this->assertCanManage($user, $media->getCentre());

        $this->em->remove($media);
        $this->em->flush();

        return new JsonResponse(null, Response::HTTP_NO_CONTENT);
    }

    /**
     * Avis de l'etablissement, y compris ceux masques par moderation.
     */
    #[Route('/api/carte/avis', name: 'api_carte_avis_list', methods: ['GET'])]
    public function listeAvis(Request $request): JsonResponse
    {
        $user = $this->requireUser();
        $centre = $this->resolveManagedCentre($user, $request);
        $this->assertCanManage($user, $centre);

        $statut = strtoupper(trim((string) $request->query->get('statut', '')));
        $qb = $this->avisRepository->createQueryBuilder('a')
            ->where('a.etablissement = :centre')
            ->setParameter('centre', $centre->getId())
            ->orderBy('a.createdAt', 'DESC');
        if (in_array($statut, ['PUBLIE', 'REJETE', 'EN_ATTENTE'], true)) {
            $qb->andWhere('a.statut = :statut')->setParameter('statut', $statut);
        }

        $items = array_map(
            fn (AvisEtablissement $avis): array => $this->serializeAvis($avis),
            $qb->getQuery()->getResult()
        );

        return new JsonResponse(['items' => $items, 'total' => count($items)]);
    }

    /**
     * Publication ou masquage d'un avis par le manager de l'etablissement.
     */
    #[Route('/api/carte/avis/{id}', name: 'api_carte_avis_moderate', methods: ['PATCH'])]
    public function modererAvis(Request $request, int $id): JsonResponse
    {
        $user = $this->requireUser();
        $avis = $this->avisRepository->find($id);
        if (!$avis instanceof AvisEtablissement || !$avis->getEtablissement()) {
            throw new NotFoundHttpException('Avis introuvable.');
        }
        $this->assertCanManage($user, $avis->getEtablissement());

        $data = $request->toArray();
        $statut = strtoupper(trim((string) ($data['statut'] ?? '')));
        if (!in_array($statut, ['PUBLIE', 'REJETE'], true)) {
            throw new BadRequestHttpException('Statut invalide. Valeurs autorisees: PUBLIE, REJETE.');
        }

        $avis
            ->setStatut($statut)
            ->setUpdatedAt(new \DateTimeImmutable());
        if ($statut === 'REJETE') {
            $avis->setSignale(true);
            $avis->setRaisonSignalement(mb_substr(trim((string) ($data['raison'] ?? 'Modere par l etablissement')), 0, 2000));
        } else {
            $avis->setSignale(false);
            $avis->setRaisonSignalement(null);
        }

        $this->em->flush();
        $this->avisRepository->refreshAggregates($avis->getEtablissement());

        return new JsonResponse(['avis' => $this->serializeAvis($avis)]);
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
            'description' => $centre->getDescription(),
            'services' => $centre->getServices(),
            'specialites' => $centre->getSpecialites(),
            'latitude' => $centre->getLatitude(),
            'longitude' => $centre->getLongitude(),
            'images' => array_map(
                fn (MediaObject $media): array => $this->serializeMedia($media),
                $centre->getImages()->toArray()
            ),
        ];
    }

    private function serializeMedia(MediaObject $media): array
    {
        return [
            'id' => $media->getId(),
            'contentUrl' => $media->getContentUrl(),
            'originalName' => $media->getOriginalName(),
            'mimeType' => $media->getMimeType(),
            'size' => $media->getSize(),
            'kind' => str_starts_with((string) $media->getMimeType(), 'video/') ? 'video' : 'image',
            'createdAt' => $media->getCreatedAt()->format('c'),
        ];
    }

    private function serializeAvis(AvisEtablissement $avis): array
    {
        return [
            'id' => $avis->getId(),
            'note' => $avis->getNote(),
            'commentaire' => $avis->getCommentaire(),
            'statut' => $avis->getStatut(),
            'signale' => $avis->isSignale(),
            'raisonSignalement' => $avis->getRaisonSignalement(),
            'auteurNom' => $avis->getAuteurNom(),
            'createdAt' => $avis->getCreatedAt()->format('c'),
            'updatedAt' => $avis->getUpdatedAt()?->format('c'),
        ];
    }
}
