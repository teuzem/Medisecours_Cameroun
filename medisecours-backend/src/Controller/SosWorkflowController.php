<?php

declare(strict_types=1);

namespace App\Controller;

use App\Entity\AffiliationMedecin;
use App\Entity\CentreDeSante;
use App\Entity\DemandeSos;
use App\Entity\EtablissementEquipe;
use App\Entity\Medecin;
use App\Entity\SosTrace;
use App\Entity\User;
use App\Message\WebSocketNotification;
use App\Repository\DemandeSosRepository;
use App\Repository\EtablissementEquipeRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\Messenger\MessageBusInterface;
use Symfony\Component\Routing\Annotation\Route;

/**
 * Workflow SOS complet : vérification → sirène → prise en charge → clôture.
 *
 *  - POST /api/sos/{id}/verifier        : l'équipe confirme la réalité (sirène)
 *                                         ou la fausseté (fraude, clôture).
 *  - POST /api/sos/{id}/prise-en-charge : un médecin habilité prend l'alerte
 *                                         (habilitation vérifiée en temps réel).
 *  - POST /api/sos/{id}/cloturer        : fin d'intervention / annulation.
 *  - GET  /api/sos/{id}/traces          : journal d'audit complet.
 *  - GET  /api/sos/{id}/suivi?token=    : suivi anonyme (jeton) pour sans-compte.
 *  - GET  /api/sos/etablissement?centre=: fil d'alertes d'un établissement
 *                                         (managers/admins) avec preuve photo.
 *  - GET  /api/medecin/sos              : alertes ouvertes + mes prises (médecin).
 *
 * Chaque transition laisse une trace `sos_trace` et publie un événement
 * WebSocket ciblé (équipe + demandeur + répondant).
 */
class SosWorkflowController extends AbstractController
{
    public function __construct(
        private EntityManagerInterface $em,
        private DemandeSosRepository $sosRepository,
        private EtablissementEquipeRepository $equipeRepository,
        private MessageBusInterface $messageBus,
    ) {
    }

    // ── Vérification : réelle (sirène) ou fausse (fraude) ──────────────────

    /**
     * POST /api/sos/{id}/verifier   body: {"decision": "REEL"|"FAUX", "commentaire"?: string}
     */
    #[Route('/api/sos/{id}/verifier', name: 'api_sos_verifier', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function verifier(int $id, Request $request): JsonResponse
    {
        $user = $this->requireUser();
        $sos = $this->findSos($id);
        $this->assertPeutVerifier($user, $sos);

        if (!in_array($sos->getStatut(), ['EN_COURS'], true)) {
            throw new BadRequestHttpException('Cette alerte a déjà été vérifiée.');
        }

        $data = $request->toArray();
        $decision = strtoupper(trim((string) ($data['decision'] ?? '')));
        if (!in_array($decision, ['REEL', 'FAUX'], true)) {
            throw new BadRequestHttpException('Décision invalide (REEL ou FAUX).');
        }
        $commentaire = trim((string) ($data['commentaire'] ?? ''));
        $commentaire = $commentaire !== '' ? mb_substr($commentaire, 0, 1000) : null;

        $sos->setVerifiePar($user)
            ->setVerifieAt(new \DateTimeImmutable())
            ->setVerificationComment($commentaire);

        if ($decision === 'REEL') {
            $sos->setStatut('VERIFIEE')
                ->setSireneActive(true);
            $action = SosTrace::ACTION_CONFIRMEE;
        } else {
            $sos->setStatut('FRAUDULEUSE')
                ->setSireneActive(false)
                ->setResoluAt(new \DateTimeImmutable());
            $action = SosTrace::ACTION_FRAUDULEUSE;
        }

        $this->em->persist(
            (new SosTrace())
                ->setSos($sos)
                ->setAction($action)
                ->setAuteur($user)
                ->setDetails(['decision' => $decision, 'commentaire' => $commentaire])
        );
        if ($decision === 'REEL') {
            $this->em->persist(
                (new SosTrace())
                    ->setSos($sos)
                    ->setAction(SosTrace::ACTION_SIRENE_ACTIVEE)
                    ->setAuteur($user)
            );
        }
        $this->em->flush();

        $this->publish($sos, $decision === 'REEL' ? 'sos_verifiee' : 'sos_cloturee', [
            'id' => $sos->getId(),
            'statut' => $sos->getStatut(),
            'sireneActive' => $sos->isSireneActive(),
            'verifiePar' => $this->displayName($user),
            'verifieAt' => $sos->getVerifieAt()?->format('c'),
        ]);

        return new JsonResponse(['sos' => $this->serializeSos($sos, true)]);
    }

    // ── Prise en charge : habilitation vérifiée en temps réel ──────────────

    /**
     * POST /api/sos/{id}/prise-en-charge
     */
    #[Route('/api/sos/{id}/prise-en-charge', name: 'api_sos_prise_en_charge', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function priseEnCharge(int $id): JsonResponse
    {
        $user = $this->requireUser();
        if (!in_array('ROLE_MEDECIN', $user->getRoles(), true) && !$this->isAdmin($user)) {
            throw new AccessDeniedHttpException('Seul un médecin peut prendre une alerte SOS en charge.');
        }
        if ($user instanceof Medecin && !$user->isEstValide()) {
            throw new AccessDeniedHttpException('Votre compte médecin n\'est pas encore validé.');
        }

        $sos = $this->findSos($id);
        if ($sos->getStatut() !== 'VERIFIEE') {
            throw new BadRequestHttpException(
                $sos->getStatut() === 'EN_COURS'
                    ? 'Alerte encore en vérification par l\'établissement.'
                    : 'Cette alerte n\'est plus disponible.'
            );
        }
        if ($sos->getPrisEnChargePar()) {
            throw new BadRequestHttpException('Cette alerte est déjà prise en charge.');
        }

        // ── Habilitation temps réel (affiliation / équipe / ouverte) ────────
        $habilitation = $this->evaluerHabilitation($user, $sos->getEtablissement());
        if ($habilitation['autorise'] === false) {
            throw new AccessDeniedHttpException($habilitation['motif']);
        }

        $sos->setPrisEnChargePar($user)
            ->setPrisEnChargeAt(new \DateTimeImmutable())
            ->setStatut('EN_PRISE_EN_CHARGE')
            ->setSireneActive(false);

        $this->em->persist(
            (new SosTrace())
                ->setSos($sos)
                ->setAction(SosTrace::ACTION_PRISE_EN_CHARGE)
                ->setAuteur($user)
                ->setDetails([
                    'habilitation' => $habilitation['type'],
                    'etablissementId' => $sos->getEtablissement()?->getId(),
                ])
        );
        $this->em->persist(
            (new SosTrace())
                ->setSos($sos)
                ->setAction(SosTrace::ACTION_SIRENE_ETEINTE)
                ->setAuteur($user)
        );
        $this->em->flush();

        $this->publish($sos, 'sos_prise_en_charge', [
            'id' => $sos->getId(),
            'statut' => $sos->getStatut(),
            'sireneActive' => false,
            'prisEnChargePar' => $this->displayName($user),
            'prisEnChargeAt' => $sos->getPrisEnChargeAt()?->format('c'),
            'habilitation' => $habilitation['type'],
        ]);

        return new JsonResponse([
            'sos' => $this->serializeSos($sos, true),
            'habilitation' => $habilitation['type'],
        ]);
    }

    // ── Clôture : intervention terminée ou annulation ──────────────────────

    /**
     * POST /api/sos/{id}/cloturer   body: {"motif"?: string}
     */
    #[Route('/api/sos/{id}/cloturer', name: 'api_sos_cloturer', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function cloturer(int $id, Request $request): JsonResponse
    {
        $user = $this->requireUser();
        $sos = $this->findSos($id);

        $estRepondant = $sos->getPrisEnChargePar() === $user;
        $estDemandeur = $sos->getUser() !== null && $sos->getUser() === $user;
        $estManager = $sos->getEtablissement() !== null
            && $this->equipeRepository->canManage($user, $sos->getEtablissement());

        if (!$this->isAdmin($user) && !$estRepondant && !$estDemandeur && !$estManager) {
            throw new AccessDeniedHttpException('Action non autorisée sur cette alerte.');
        }

        if (!in_array($sos->getStatut(), ['EN_COURS', 'VERIFIEE', 'EN_PRISE_EN_CHARGE'], true)) {
            throw new BadRequestHttpException('Cette alerte est déjà clôturée.');
        }

        $data = $request->toArray();
        $motif = trim((string) ($data['motif'] ?? ''));
        $motif = $motif !== '' ? mb_substr($motif, 0, 1000) : null;

        $traitement = $estRepondant || $sos->getStatut() === 'EN_PRISE_EN_CHARGE';
        $sireneEtaitActive = $sos->isSireneActive();
        $sos->setStatut($traitement ? 'TRAITEE' : 'CLOTUREE')
            ->setSireneActive(false)
            ->setResoluAt(new \DateTimeImmutable());

        $this->em->persist(
            (new SosTrace())
                ->setSos($sos)
                ->setAction($traitement ? SosTrace::ACTION_TRAITEE : SosTrace::ACTION_CLOTUREE)
                ->setAuteur($user)
                ->setDetails(['motif' => $motif])
        );
        if ($sireneEtaitActive) {
            $this->em->persist(
                (new SosTrace())
                    ->setSos($sos)
                    ->setAction(SosTrace::ACTION_SIRENE_ETEINTE)
                    ->setAuteur($user)
            );
        }
        $this->em->flush();

        $this->publish($sos, 'sos_cloturee', [
            'id' => $sos->getId(),
            'statut' => $sos->getStatut(),
            'sireneActive' => false,
            'cloturePar' => $this->displayName($user),
            'resoluAt' => $sos->getResoluAt()?->format('c'),
        ]);

        return new JsonResponse(['sos' => $this->serializeSos($sos, true)]);
    }

    // ── Traçabilité ────────────────────────────────────────────────────────

    /**
     * GET /api/sos/{id}/traces
     */
    #[Route('/api/sos/{id}/traces', name: 'api_sos_traces', methods: ['GET'], requirements: ['id' => '\d+'])]
    public function traces(int $id): JsonResponse
    {
        $user = $this->requireUser();
        $sos = $this->findSos($id);

        $estDemandeur = $sos->getUser() !== null && $sos->getUser() === $user;
        $estRepondant = $sos->getPrisEnChargePar() === $user;
        $estManager = $sos->getEtablissement() !== null
            && $this->equipeRepository->canManage($user, $sos->getEtablissement());

        if (!$this->isAdmin($user) && !$estDemandeur && !$estRepondant && !$estManager) {
            throw new AccessDeniedHttpException('Accès au journal refusé.');
        }

        $rows = $this->em->createQueryBuilder()
            ->select('t')
            ->from(SosTrace::class, 't')
            ->where('t.sos = :sos')
            ->setParameter('sos', $sos->getId())
            ->orderBy('t.createdAt', 'ASC')
            ->getQuery()
            ->getResult();

        return new JsonResponse([
            'sosId' => $sos->getId(),
            'traces' => array_map(static fn (SosTrace $t): array => [
                'id' => $t->getId(),
                'action' => $t->getAction(),
                'auteur' => $t->getAuteur() ? [
                    'id' => (string) $t->getAuteur()->getId(),
                    'nom' => $t->getAuteur()->getNom(),
                    'prenom' => $t->getAuteur()->getPrenom(),
                ] : null,
                'details' => $t->getDetails(),
                'createdAt' => $t->getCreatedAt()->format('c'),
            ], $rows),
        ]);
    }

    // ── Suivi anonyme (jeton) pour les demandeurs sans compte ──────────────

    /**
     * GET /api/sos/{id}/suivi?token=…
     */
    #[Route('/api/sos/{id}/suivi', name: 'api_sos_suivi', methods: ['GET'], requirements: ['id' => '\d+'])]
    public function suivi(int $id, Request $request): JsonResponse
    {
        $sos = $this->findSos($id);
        $token = (string) $request->query->get('token', '');

        $attendu = (string) $sos->getSuiviToken();
        if ($attendu === '' || !hash_equals($attendu, $token)) {
            throw new NotFoundHttpException('Alerte introuvable.');
        }

        return new JsonResponse(['sos' => $this->serializeSuivi($sos)]);
    }

    // ── Fil d'alertes d'un établissement (managers) ────────────────────────

    /**
     * GET /api/sos/etablissement?centre=
     */
    #[Route('/api/sos/etablissement', name: 'api_sos_etablissement', methods: ['GET'])]
    public function filEtablissement(Request $request): JsonResponse
    {
        $user = $this->requireUser();
        $centre = $this->resolveManagedCentre($user, $request);
        $this->assertCanManage($user, $centre);

        $sos = $this->em->createQueryBuilder()
            ->select('d')
            ->from(DemandeSos::class, 'd')
            ->where('d.etablissement = :centre')
            ->setParameter('centre', $centre->getId())
            ->orderBy('d.createdAt', 'DESC')
            ->setMaxResults(100)
            ->getQuery()
            ->getResult();

        $ouvertes = 0;
        $items = array_map(function (DemandeSos $item) use (&$ouvertes): array {
            if (in_array($item->getStatut(), ['EN_COURS', 'VERIFIEE', 'EN_PRISE_EN_CHARGE'], true)) {
                $ouvertes++;
            }

            return $this->serializeSos($item, true);
        }, $sos);

        return new JsonResponse([
            'centreId' => $centre->getId(),
            'ouvertes' => $ouvertes,
            'alertes' => $items,
        ]);
    }

    // ── Vue médecin : alertes ouvertes + mes prises ────────────────────────

    /**
     * GET /api/medecin/sos
     */
    #[Route('/api/medecin/sos', name: 'api_medecin_sos', methods: ['GET'])]
    public function filMedecin(): JsonResponse
    {
        $user = $this->requireUser();
        if (!in_array('ROLE_MEDECIN', $user->getRoles(), true) && !$this->isAdmin($user)) {
            throw new AccessDeniedHttpException('Accès réservé aux médecins.');
        }

        $ouvertes = $this->em->createQueryBuilder()
            ->select('d')
            ->from(DemandeSos::class, 'd')
            ->where('d.statut = :statut')
            ->setParameter('statut', 'VERIFIEE')
            ->andWhere('d.prisEnChargePar IS NULL')
            ->orderBy('d.createdAt', 'ASC')
            ->setMaxResults(30)
            ->getQuery()
            ->getResult();

        $mesPrises = $this->em->createQueryBuilder()
            ->select('d')
            ->from(DemandeSos::class, 'd')
            ->where('d.prisEnChargePar = :user')
            ->setParameter('user', $user->getId())
            ->andWhere('d.statut = :statut')
            ->setParameter('statut', 'EN_PRISE_EN_CHARGE')
            ->orderBy('d.createdAt', 'DESC')
            ->setMaxResults(30)
            ->getQuery()
            ->getResult();

        $serializer = function (DemandeSos $item) use ($user): array {
            $payload = $this->serializeSos($item, false);
            $payload['habilitation'] = $this->evaluerHabilitation($user, $item->getEtablissement())['type'];

            return $payload;
        };

        return new JsonResponse([
            'ouvertes' => array_map($serializer, $ouvertes),
            'mesPrises' => array_map($serializer, $mesPrises),
        ]);
    }

    // ── Habilitation temps réel ─────────────────────────────────────────────

    /**
     * Un médecin est habilité à traiter l'alerte d'un établissement si :
     *  1. il est admin, ou
     *  2. il détient une affiliation ACCEPTEE, ou
     *  3. il est membre ACTIF de l'équipe (rôle MEDECIN) de l'établissement, ou
     *  4. l'établissement n'a encore aucune affiliation ni équipe (mode ouvert).
     * Sinon : refus motivé — l'habilitation est vérifiée à chaque prise.
     *
     * @return array{autorise: bool, type: string, motif: string|null}
     */
    private function evaluerHabilitation(User $user, ?CentreDeSante $etablissement): array
    {
        if ($this->isAdmin($user)) {
            return ['autorise' => true, 'type' => 'admin', 'motif' => null];
        }

        if (!$etablissement) {
            return ['autorise' => true, 'type' => 'ouverte', 'motif' => null];
        }

        $affiliations = (int) $this->em->createQueryBuilder()
            ->select('COUNT(a.id)')
            ->from(AffiliationMedecin::class, 'a')
            ->where('a.etablissement = :eta')
            ->setParameter('eta', $etablissement->getId())
            ->andWhere('a.statut = :statut')
            ->setParameter('statut', 'ACCEPTEE')
            ->getQuery()
            ->getSingleScalarResult();

        if ($affiliations > 0) {
            $moi = $this->em->createQueryBuilder()
                ->select('COUNT(a.id)')
                ->from(AffiliationMedecin::class, 'a')
                ->where('a.etablissement = :eta')
                ->setParameter('eta', $etablissement->getId())
                ->andWhere('a.statut = :statut')
                ->setParameter('statut', 'ACCEPTEE')
                ->andWhere('a.medecin = :user')
                ->setParameter('user', $user->getId())
                ->getQuery()
                ->getSingleScalarResult();

            if ((int) $moi > 0) {
                return ['autorise' => true, 'type' => 'affiliation', 'motif' => null];
            }

            return [
                'autorise' => false,
                'type' => 'affiliation_requise',
                'motif' => 'Vous n\'êtes pas affilié à cet établissement.',
            ];
        }

        $membresEquipe = (int) $this->em->createQueryBuilder()
            ->select('COUNT(e.id)')
            ->from(EtablissementEquipe::class, 'e')
            ->where('e.etablissement = :eta')
            ->setParameter('eta', $etablissement->getId())
            ->andWhere('e.statut = :statut')
            ->setParameter('statut', 'ACTIF')
            ->andWhere('e.role = :role')
            ->setParameter('role', 'MEDECIN')
            ->getQuery()
            ->getSingleScalarResult();

        if ($membresEquipe > 0) {
            $moiMembre = $this->equipeRepository->findActiveMember($user, $etablissement);
            if ($moiMembre && $moiMembre->getRole() === 'MEDECIN') {
                return ['autorise' => true, 'type' => 'equipe', 'motif' => null];
            }

            return [
                'autorise' => false,
                'type' => 'equipe_requise',
                'motif' => 'Les alertes de cet établissement sont réservées à son équipe médicale.',
            ];
        }

        return ['autorise' => true, 'type' => 'ouverte', 'motif' => null];
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private function findSos(int $id): DemandeSos
    {
        $sos = $this->sosRepository->find($id);
        if (!$sos) {
            throw new NotFoundHttpException('Alerte introuvable.');
        }

        return $sos;
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

    private function assertPeutVerifier(User $user, DemandeSos $sos): void
    {
        if ($this->isAdmin($user)) {
            return;
        }

        $centre = $sos->getEtablissement();
        if ($centre && $this->equipeRepository->canManage($user, $centre)) {
            return;
        }

        throw new AccessDeniedHttpException('Vérification réservée aux managers de l\'établissement ciblé.');
    }

    private function resolveManagedCentre(User $user, Request $request): CentreDeSante
    {
        if ($this->isAdmin($user)) {
            $centreId = $request->query->get('centre');
            if ($centreId) {
                $centre = $this->em->getRepository(CentreDeSante::class)->find((int) $centreId);
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
     * Publie les événements temps réel :
     *  - `event` (sos_verifiee / sos_prise_en_charge / sos_cloturee)
     *    → uniquement l'équipe de l'établissement (ce sont eux qui
     *    pilotent la sirène et le poste d'alerte) ;
     *  - `sos_suivi` (même charge utile) → demandeur + répondant,
     *    pour suivre l'avancement sans jamais déclencher la sirène.
     */
    private function publish(DemandeSos $sos, string $event, array $payload): void
    {
        $equipe = [];
        if ($sos->getEtablissement()) {
            foreach ($this->equipeRepository->findActiveByCentre($sos->getEtablissement()->getId()) as $membre) {
                if ($membre->getUser()) {
                    $equipe[] = (string) $membre->getUser()->getId();
                }
            }
        }
        $equipe = array_values(array_unique($equipe));

        if ($equipe !== []) {
            $this->messageBus->dispatch(new WebSocketNotification($event, $payload, $equipe));
        }

        $suivi = [];
        if ($sos->getUser()) {
            $suivi[] = (string) $sos->getUser()->getId();
        }
        if ($sos->getPrisEnChargePar()) {
            $suivi[] = (string) $sos->getPrisEnChargePar()->getId();
        }
        $suivi = array_values(array_unique($suivi));

        if ($suivi !== []) {
            $this->messageBus->dispatch(new WebSocketNotification('sos_suivi', $payload, $suivi));
        }
    }

    private function displayName(User $user): string
    {
        return trim(($user->getPrenom() ?? '') . ' ' . ($user->getNom() ?? '')) ?: (string) $user->getEmail();
    }

    private function serializeSos(DemandeSos $sos, bool $avecPreuve): array
    {
        return [
            'id' => $sos->getId(),
            'statut' => $sos->getStatut(),
            'nom' => $sos->getNom(),
            'telephone' => $sos->getTelephone(),
            'description' => $sos->getDescription(),
            'latitude' => $sos->getLatitude(),
            'longitude' => $sos->getLongitude(),
            'sireneActive' => $sos->isSireneActive(),
            'preuvePhoto' => $avecPreuve ? $sos->getPreuvePhoto() : null,
            'etablissement' => $sos->getEtablissement() ? [
                'id' => $sos->getEtablissement()->getId(),
                'nom' => $sos->getEtablissement()->getNom(),
            ] : null,
            'verifiePar' => $sos->getVerifiePar() ? $this->displayName($sos->getVerifiePar()) : null,
            'verifieAt' => $sos->getVerifieAt()?->format('c'),
            'verificationComment' => $sos->getVerificationComment(),
            'prisEnChargePar' => $sos->getPrisEnChargePar() ? [
                'id' => (string) $sos->getPrisEnChargePar()->getId(),
                'nom' => $this->displayName($sos->getPrisEnChargePar()),
            ] : null,
            'prisEnChargeAt' => $sos->getPrisEnChargeAt()?->format('c'),
            'resoluAt' => $sos->getResoluAt()?->format('c'),
            'createdAt' => $sos->getCreatedAt()->format('c'),
        ];
    }

    private function serializeSuivi(DemandeSos $sos): array
    {
        return [
            'id' => $sos->getId(),
            'statut' => $sos->getStatut(),
            'sireneActive' => $sos->isSireneActive(),
            'etablissement' => $sos->getEtablissement() ? [
                'id' => $sos->getEtablissement()->getId(),
                'nom' => $sos->getEtablissement()->getNom(),
                'telephone' => $sos->getEtablissement()->getTelephone(),
            ] : null,
            'prisEnChargePar' => $sos->getPrisEnChargePar()
                ? $this->displayName($sos->getPrisEnChargePar())
                : null,
            'verifieAt' => $sos->getVerifieAt()?->format('c'),
            'resoluAt' => $sos->getResoluAt()?->format('c'),
            'createdAt' => $sos->getCreatedAt()->format('c'),
        ];
    }
}
