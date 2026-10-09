<?php

declare(strict_types=1);

namespace App\Controller;

use App\Entity\AffiliationMedecin;
use App\Entity\CentreDeSante;
use App\Entity\Medecin;
use App\Entity\User;
use App\Repository\AffiliationMedecinRepository;
use App\Repository\EtablissementEquipeRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\Routing\Annotation\Route;

/**
 * Gestion des affiliations médecins ↔ établissement.
 *
 *  - GET  /api/etablissement/affiliations?centre= : fil complet (tous statuts)
 *    pour les managers de l'établissement (demandes EN_ATTENTE comprises).
 *  - GET  /api/medecin/affiliations                : ses propres affiliations,
 *    tous statuts (tableau de bord médecin).
 *  - POST /api/affiliation_medecins/{id}/decision   : ACCEPTEE / REFUSEE /
 *    SUSPENDUE, réservé aux managers de l'établissement et aux admins.
 *
 * La création (POST /api/affiliation_medecins) reste gérée par API Platform
 * (statut initial EN_ATTENTE), y compris à l'inscription d'un médecin.
 */
class AffiliationController extends AbstractController
{
    public function __construct(
        private EntityManagerInterface $em,
        private AffiliationMedecinRepository $affiliationRepository,
        private EtablissementEquipeRepository $equipeRepository,
    ) {
    }

    // ── Fil d'affiliations d'un établissement (managers) ───────────────────

    /**
     * GET /api/etablissement/affiliations?centre=
     */
    #[Route('/api/etablissement/affiliations', name: 'api_etablissement_affiliations', methods: ['GET'])]
    public function filEtablissement(Request $request): JsonResponse
    {
        $user = $this->requireUser();
        $centre = $this->resolveManagedCentre($user, $request);
        $this->assertCanManage($user, $centre);

        $rows = $this->affiliationRepository->createQueryBuilder('a')
            ->where('a.etablissement = :centre')
            ->setParameter('centre', $centre->getId())
            ->orderBy('a.createdAt', 'DESC')
            ->setMaxResults(200)
            ->getQuery()
            ->getResult();

        $comptes = ['EN_ATTENTE' => 0, 'ACCEPTEE' => 0, 'REFUSEE' => 0, 'SUSPENDUE' => 0];
        $items = array_map(static function (AffiliationMedecin $a) use (&$comptes): array {
            $comptes[$a->getStatut()] = ($comptes[$a->getStatut()] ?? 0) + 1;

            return self::serializeAffiliation($a);
        }, $rows);

        return new JsonResponse([
            'centreId' => $centre->getId(),
            'comptes' => $comptes,
            'affiliations' => $items,
        ]);
    }

    // ── Ses propres affiliations (médecin) ─────────────────────────────────

    /**
     * GET /api/medecin/affiliations
     */
    #[Route('/api/medecin/affiliations', name: 'api_medecin_affiliations', methods: ['GET'])]
    public function filMedecin(): JsonResponse
    {
        $user = $this->requireUser();
        if (!$user instanceof Medecin && !$this->isAdmin($user)) {
            throw new AccessDeniedHttpException('Accès réservé aux médecins.');
        }

        $rows = $user instanceof Medecin
            ? $this->affiliationRepository->findByMedecin($user)
            : [];

        return new JsonResponse([
            'affiliations' => array_map(
                static fn (AffiliationMedecin $a): array => self::serializeAffiliation($a),
                $rows
            ),
        ]);
    }

    // ── Décision managériale (accepter / refuser / suspendre) ──────────────

    /**
     * POST /api/affiliation_medecins/{id}/decision
     * body: {"statut": "ACCEPTEE"|"REFUSEE"|"SUSPENDUE"}
     */
    #[Route('/api/affiliation_medecins/{id}/decision', name: 'api_affiliation_decision', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function decision(int $id, Request $request): JsonResponse
    {
        $user = $this->requireUser();

        $affiliation = $this->affiliationRepository->find($id);
        if (!$affiliation instanceof AffiliationMedecin) {
            throw new NotFoundHttpException('Affiliation introuvable.');
        }

        $centre = $affiliation->getEtablissement();
        if (!$this->isAdmin($user) && ($centre === null || !$this->equipeRepository->canManage($user, $centre))) {
            throw new AccessDeniedHttpException(
                'Décision réservée aux managers de cet établissement.'
            );
        }

        $data = $request->toArray();
        $statut = strtoupper(trim((string) ($data['statut'] ?? '')));
        if (!in_array($statut, ['ACCEPTEE', 'REFUSEE', 'SUSPENDUE'], true)) {
            throw new BadRequestHttpException('Décision invalide (ACCEPTEE, REFUSEE ou SUSPENDUE).');
        }
        if ($affiliation->getStatut() === $statut) {
            throw new BadRequestHttpException('Cette affiliation est déjà dans ce statut.');
        }

        $affiliation->setStatut($statut)->setUpdatedAt(new \DateTimeImmutable());
        $this->em->flush();

        return new JsonResponse(['affiliation' => self::serializeAffiliation($affiliation)]);
    }

    // ── Helpers ────────────────────────────────────────────────────────────

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
     * Sérialisation riche (médicale + établissement) — indépendante des
     * groupes de normalisation d'API Platform.
     */
    private static function serializeAffiliation(AffiliationMedecin $a): array
    {
        $medecin = $a->getMedecin();

        return [
            'id' => $a->getId(),
            'statut' => $a->getStatut(),
            'fonction' => $a->getFonction(),
            'salle' => $a->getSalle(),
            'teleconsultation' => $a->isTeleconsultation(),
            'createdAt' => $a->getCreatedAt()->format('c'),
            'updatedAt' => $a->getUpdatedAt()?->format('c'),
            'medecin' => $medecin ? [
                'id' => (string) $medecin->getId(),
                'nom' => $medecin->getNom(),
                'prenom' => $medecin->getPrenom(),
                'specialite' => $medecin->getSpecialite(),
                'telephone' => $medecin->getTelephone(),
                'email' => $medecin->getEmail(),
                'estValide' => $medecin->isEstValide(),
            ] : null,
            'etablissement' => $a->getEtablissement() ? [
                'id' => $a->getEtablissement()->getId(),
                'nom' => $a->getEtablissement()->getNom(),
                'ville' => $a->getEtablissement()->getVille(),
            ] : null,
        ];
    }
}
