<?php

declare(strict_types=1);

namespace App\Controller;

use App\Entity\AffiliationMedecin;
use App\Entity\CentreDeSante;
use App\Entity\DemandeSos;
use App\Entity\EtablissementEquipe;
use App\Entity\Medecin;
use App\Entity\PersonnelSante;
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
 *  - GET  /api/sos/stats?centre=        : analytique SOS temps réel d'un
 *                                         établissement (volumes par statut,
 *                                         délais moyens, taux preuves/fraudes).
 *  - GET  /api/medecin/sos              : alertes ouvertes + mes prises (médecin).
 *  - GET  /api/ambulancier/sos          : cas LÉGERS vérifiés du centre + mes
 *                                         prises (ambulanciers en service).
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
     * POST /api/sos/{id}/verifier   body: {"decision": "REEL"|"FAUX", "commentaire"?: string, "gravite"?: "LEGERE"|"URGENTE"|"CRITIQUE"}
     *
     * Le manager confirme le niveau de gravité du triage (défaut : gravité
     * calculée à la création). CRITIQUE n'est attribuable qu'ici.
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
        $gravite = strtoupper(trim((string) ($data['gravite'] ?? '')));
        if ($gravite !== '' && !in_array($gravite, DemandeSos::GRAVITES, true)) {
            throw new BadRequestHttpException('Gravité invalide (LEGERE, URGENTE ou CRITIQUE).');
        }

        $sos->setVerifiePar($user)
            ->setVerifieAt(new \DateTimeImmutable())
            ->setVerificationComment($commentaire);

        if ($decision === 'REEL') {
            $sos->setStatut('VERIFIEE')
                ->setSireneActive(true);
            if ($gravite !== '') {
                $sos->setGravite($gravite);
            }
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
                ->setDetails(['decision' => $decision, 'commentaire' => $commentaire, 'gravite' => $sos->getGravite()])
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
            'gravite' => $sos->getGravite(),
            'verifiePar' => $this->displayName($user),
            'verifieAt' => $sos->getVerifieAt()?->format('c'),
        ]);

        return new JsonResponse(['sos' => $this->serializeSos($sos, true)]);
    }

    // ── Prise en charge : habilitation vérifiée en temps réel ──────────────

    /**
     * POST /api/sos/{id}/prise-en-charge
     *
     * Médecins (cas URGENTS/CRITIQUES) et ambulanciers en service (cas
     * LÉGERS de leur établissement, transport sans risque). Le premier
     * répondant éteint la sirène partout (anti-chevauchement).
     */
    #[Route('/api/sos/{id}/prise-en-charge', name: 'api_sos_prise_en_charge', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function priseEnCharge(int $id): JsonResponse
    {
        $user = $this->requireUser();
        $estAmbulancier = $user instanceof PersonnelSante
            && $user->getTypePersonnel() === PersonnelSante::TYPE_AMBULANCIER;
        if ($estAmbulancier) {
            if (!$user->estValide()) {
                throw new AccessDeniedHttpException('Votre compte ambulancier n\'est pas encore validé.');
            }
            if (!$user->isEnService()) {
                throw new AccessDeniedHttpException('Passez en service pour prendre une alerte.');
            }
        } else {
            if (!in_array('ROLE_MEDECIN', $user->getRoles(), true) && !$this->isAdmin($user)) {
                throw new AccessDeniedHttpException('Seuls un médecin ou un ambulancier (cas légers) peuvent prendre une alerte SOS en charge.');
            }
            if ($user instanceof Medecin && !$user->isEstValide()) {
                throw new AccessDeniedHttpException('Votre compte médecin n\'est pas encore validé.');
            }
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
        if ($estAmbulancier) {
            if ($sos->getGravite() !== DemandeSos::GRAVITE_LEGERE) {
                throw new AccessDeniedHttpException('Les ambulanciers ne prennent que les cas légers ; un médecin doit se déplacer.');
            }
            $centrePersonnel = $user->getEtablissement();
            $centreSos = $sos->getEtablissement();
            if (!$centrePersonnel || !$centreSos || $centrePersonnel->getId() !== $centreSos->getId()) {
                throw new AccessDeniedHttpException('Cette alerte ne relève pas de votre établissement.');
            }
        }

        // ── Habilitation temps réel (affiliation / équipe / ouverte) ────────
        $habilitation = $estAmbulancier
            ? ['autorise' => true, 'type' => 'ambulancier', 'motif' => null]
            : $this->evaluerHabilitation($user, $sos->getEtablissement());
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

        // Priorité d'abord (cas graves + anciens), puis les clôturées récentes.
        $ouverts = array_values(array_filter(
            $sos,
            static fn (DemandeSos $s): bool => in_array($s->getStatut(), ['EN_COURS', 'VERIFIEE', 'EN_PRISE_EN_CHARGE'], true)
        ));
        $fermes = array_values(array_filter(
            $sos,
            static fn (DemandeSos $s): bool => !in_array($s->getStatut(), ['EN_COURS', 'VERIFIEE', 'EN_PRISE_EN_CHARGE'], true)
        ));
        $sos = [...self::trierParPriorite($ouverts), ...$fermes];

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

    // ── Analytique SOS temps réel d'un établissement (managers) ─────────────

    /**
     * GET /api/sos/stats?centre=
     *
     * Lecture seule : agrège les alertes de l'établissement (volumes par
     * statut, sirènes actives, taux de preuves photo et de frauduleuses,
     * délais moyens vérification / prise en charge / résolution en secondes).
     * Aucune migration : ne lit que les colonnes existantes de demande_sos.
     */
    #[Route('/api/sos/stats', name: 'api_sos_stats', methods: ['GET'])]
    public function stats(Request $request): JsonResponse
    {
        $user = $this->requireUser();
        $centre = $this->resolveManagedCentre($user, $request);
        $this->assertCanManage($user, $centre);

        /** @var list<DemandeSos> $rows */
        $rows = $this->em->createQueryBuilder()
            ->select('d')
            ->from(DemandeSos::class, 'd')
            ->where('d.etablissement = :centre')
            ->setParameter('centre', $centre->getId())
            ->orderBy('d.createdAt', 'DESC')
            ->setMaxResults(500)
            ->getQuery()
            ->getResult();

        $parStatut = [];
        $avecPreuve = 0;
        $sirenesActives = 0;
        $delaisVerification = [];
        $delaisPriseEnCharge = [];
        $delaisResolution = [];
        foreach ($rows as $sos) {
            $statut = $sos->getStatut();
            $parStatut[$statut] = ($parStatut[$statut] ?? 0) + 1;
            if ($sos->getPreuvePhoto()) {
                $avecPreuve++;
            }
            if ($sos->isSireneActive()) {
                $sirenesActives++;
            }
            if ($sos->getVerifieAt()) {
                $delaisVerification[] = $sos->getVerifieAt()->getTimestamp() - $sos->getCreatedAt()->getTimestamp();
            }
            if ($sos->getPrisEnChargeAt() && $sos->getVerifieAt()) {
                $delaisPriseEnCharge[] = $sos->getPrisEnChargeAt()->getTimestamp() - $sos->getVerifieAt()->getTimestamp();
            }
            if ($sos->getResoluAt()) {
                $delaisResolution[] = $sos->getResoluAt()->getTimestamp() - $sos->getCreatedAt()->getTimestamp();
            }
        }
        $moyenne = static fn (array $valeurs): ?int => $valeurs === [] ? null : (int) round(array_sum($valeurs) / count($valeurs));

        $total = count($rows);

        return new JsonResponse([
            'centreId' => $centre->getId(),
            'total' => $total,
            'ouvertes' => ($parStatut['EN_COURS'] ?? 0) + ($parStatut['VERIFIEE'] ?? 0) + ($parStatut['EN_PRISE_EN_CHARGE'] ?? 0),
            'parStatut' => $parStatut,
            'sirenesActives' => $sirenesActives,
            'tauxPreuvePhoto' => $total > 0 ? round($avecPreuve / $total, 3) : null,
            'tauxFrauduleuses' => $total > 0 ? round(($parStatut['FRAUDULEUSE'] ?? 0) / $total, 3) : null,
            'delaiMoyenVerificationSec' => $moyenne($delaisVerification),
            'delaiMoyenPriseEnChargeSec' => $moyenne($delaisPriseEnCharge),
            'delaiMoyenResolutionSec' => $moyenne($delaisResolution),
        ]);
    }

    // ── Vue médecin : alertes ouvertes + mes prises ────────────────────────

    /**
     * GET /api/medecin/sos
     *
     * Triage à la lecture : seuls les cas URGENTS/CRITIQUES vérifiés et non
     * pris sont proposés — et uniquement si le médecin a activé le
     * commutateur « Me signaler les incidents SOS ». Les cas LÉGERS sont
     * routés vers les ambulanciers (GET /api/ambulancier/sos).
     */
    #[Route('/api/medecin/sos', name: 'api_medecin_sos', methods: ['GET'])]
    public function filMedecin(): JsonResponse
    {
        $user = $this->requireUser();
        if (!in_array('ROLE_MEDECIN', $user->getRoles(), true) && !$this->isAdmin($user)) {
            throw new AccessDeniedHttpException('Accès réservé aux médecins.');
        }

        $ouvertes = [];
        if ($user->isSosAlertesActive()) {
            $ouvertes = $this->em->createQueryBuilder()
                ->select('d')
                ->from(DemandeSos::class, 'd')
                ->where('d.statut = :statut')
                ->setParameter('statut', 'VERIFIEE')
                ->andWhere('d.prisEnChargePar IS NULL')
                ->andWhere('d.gravite IN (:gravites)')
                ->setParameter('gravites', [DemandeSos::GRAVITE_URGENTE, DemandeSos::GRAVITE_CRITIQUE])
                ->orderBy('d.createdAt', 'ASC')
                ->setMaxResults(30)
                ->getQuery()
                ->getResult();

            $ouvertes = self::trierParPriorite($ouvertes);
        }

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

    // ── Vue ambulancier : cas LÉGERS du centre + mes prises ────────────────

    /**
     * GET /api/ambulancier/sos
     *
     * Les ambulanciers (en service, validés) prennent les cas LÉGERS vérifiés
     * de leur établissement — transport sans risque. Les cas URGENTS et
     * CRITIQUES restent réservés aux médecins (GET /api/medecin/sos).
     */
    #[Route('/api/ambulancier/sos', name: 'api_ambulancier_sos', methods: ['GET'])]
    public function filAmbulancier(): JsonResponse
    {
        $user = $this->requireUser();
        if (!$user instanceof PersonnelSante || $user->getTypePersonnel() !== PersonnelSante::TYPE_AMBULANCIER) {
            throw new AccessDeniedHttpException('Accès réservé aux ambulanciers.');
        }
        if (!$user->estValide()) {
            throw new AccessDeniedHttpException('Votre compte ambulancier n\'est pas encore validé.');
        }
        $centre = $user->getEtablissement();
        if (!$centre) {
            throw new AccessDeniedHttpException('Aucun établissement de rattachement.');
        }

        $ouvertes = [];
        if ($user->isEnService()) {
            $ouvertes = $this->em->createQueryBuilder()
                ->select('d')
                ->from(DemandeSos::class, 'd')
                ->where('d.statut = :statut')
                ->setParameter('statut', 'VERIFIEE')
                ->andWhere('d.prisEnChargePar IS NULL')
                ->andWhere('d.gravite = :gravite')
                ->setParameter('gravite', DemandeSos::GRAVITE_LEGERE)
            ->andWhere('d.etablissement = :centre')
            ->setParameter('centre', $centre->getId())
            ->orderBy('d.createdAt', 'ASC')
            ->setMaxResults(30)
            ->getQuery()
            ->getResult();
        }

        $ouvertes = self::trierParPriorite($ouvertes);

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

        $serializer = function (DemandeSos $item): array {
            return $this->serializeSos($item, false);
        };

        return new JsonResponse([
            'ouvertes' => array_map($serializer, $ouvertes),
            'mesPrises' => array_map($serializer, $mesPrises),
        ]);
    }

    // ── Relais vers l'établissement le plus proche ─────────────────────────

    /**
     * POST /api/sos/{id}/relayer   body: {"etablissementId"?: int}
     *
     * Le manager rebascule une alerte non prise vers l'établissement le plus
     * proche suivant (aucun médecin disponible sur place) ou vers un centre
     * explicitement choisi. L'ancienne équipe est notifiée du départ, la
     * nouvelle reçoit l'alerte comme une création.
     */
    #[Route('/api/sos/{id}/relayer', name: 'api_sos_relayer', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function relayer(int $id, Request $request): JsonResponse
    {
        $user = $this->requireUser();
        $sos = $this->findSos($id);
        if (!in_array($sos->getStatut(), ['EN_COURS', 'VERIFIEE'], true) || $sos->getPrisEnChargePar()) {
            throw new BadRequestHttpException('Seule une alerte en attente et non prise peut être relayée.');
        }

        $ancienCentre = $sos->getEtablissement();
        if ($ancienCentre) {
            $this->assertCanManage($user, $ancienCentre);
        } elseif (!$this->isAdmin($user)) {
            throw new AccessDeniedHttpException('Accès réservé aux managers de l\'établissement ciblé.');
        }

        $data = $request->toArray();
        $cible = null;
        $cibleId = (int) ($data['etablissementId'] ?? 0);
        if ($cibleId > 0) {
            $cible = $this->em->getRepository(CentreDeSante::class)->find($cibleId);
            if (!$cible) {
                throw new BadRequestHttpException('Établissement cible introuvable.');
            }
        } else {
            foreach ($sos->getProches() ?? [] as $proche) {
                if ((int) ($proche['id'] ?? 0) > 0 && (!$ancienCentre || (int) $proche['id'] !== $ancienCentre->getId())) {
                    $cible = $this->em->getRepository(CentreDeSante::class)->find((int) $proche['id']);
                    if ($cible) {
                        break;
                    }
                }
            }
            if (!$cible) {
                throw new BadRequestHttpException('Aucun établissement proche disponible pour le relais.');
            }
        }
        if ($ancienCentre && $cible->getId() === $ancienCentre->getId()) {
            throw new BadRequestHttpException('L\'alerte est déjà ciblée sur cet établissement.');
        }

        $sos->setEtablissement($cible);
        $this->em->persist(
            (new SosTrace())
                ->setSos($sos)
                ->setAction(SosTrace::ACTION_RELAYE)
                ->setAuteur($user)
                ->setDetails([
                    'ancienEtablissementId' => $ancienCentre?->getId(),
                    'nouvelEtablissementId' => $cible->getId(),
                ])
        );
        $this->em->flush();

        $this->publish($sos, 'sos_relayee', [
            'id' => $sos->getId(),
            'statut' => $sos->getStatut(),
            'gravite' => $sos->getGravite(),
            'ancienEtablissementId' => $ancienCentre?->getId(),
            'etablissement' => ['id' => $cible->getId(), 'nom' => $cible->getNom()],
        ]);

        return new JsonResponse(['sos' => $this->serializeSos($sos, true)]);
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

    /**
     * Tri de triage : CRITIQUE → URGENTE → LEGERE, puis ancienneté (les plus
     * anciennes d'abord : l'attente fait monter la pression). Appliqué à la
     * lecture pour que médecins, ambulanciers et managers voient toujours le
     * cas le plus grave en tête, sans tâche planifiée.
     *
     * @param list<DemandeSos> $rows
     * @return list<DemandeSos>
     */
    private static function trierParPriorite(array $rows): array
    {
        $rang = [
            DemandeSos::GRAVITE_CRITIQUE => 0,
            DemandeSos::GRAVITE_URGENTE => 1,
            DemandeSos::GRAVITE_LEGERE => 2,
        ];
        usort($rows, static function (DemandeSos $a, DemandeSos $b) use ($rang): int {
            $diff = ($rang[$a->getGravite()] ?? 9) <=> ($rang[$b->getGravite()] ?? 9);
            if ($diff !== 0) {
                return $diff;
            }

            return $a->getCreatedAt() <=> $b->getCreatedAt();
        });

        return $rows;
    }

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
            'gravite' => $sos->getGravite(),
            'agePatient' => $sos->getAgePatient(),
            'enceinte' => $sos->isEnceinte(),
            'urgenceVitale' => $sos->isUrgenceVitale(),
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
            'gravite' => $sos->getGravite(),
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
