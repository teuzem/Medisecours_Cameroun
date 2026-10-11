<?php

declare(strict_types=1);

namespace App\Controller;

use App\Entity\DossierEvenement;
use App\Entity\OrdonnancePharmacie;
use App\Entity\PersonnelSante;
use App\Repository\EtablissementEquipeRepository;
use App\Repository\OrdonnancePharmacieRepository;
use App\Service\NotificationService;
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
 * Circuit pharmacie de l'établissement.
 *
 * Pharmacie (pharmacien connecté) :
 *  - GET  /api/personnel/pharmacie/ordonnances         : file d'attente,
 *  - POST /api/personnel/pharmacie/ordonnances/{id}/facturer : monter la facture,
 *  - POST /api/personnel/pharmacie/ordonnances/{id}/payer    : confirmer le paiement (caisse),
 *  - POST /api/personnel/pharmacie/ordonnances/{id}/administrer : préparer pour l'infirmier,
 *  - POST /api/personnel/pharmacie/ordonnances/{id}/annuler  : annuler (motif).
 *
 * Patient :
 *  - GET  /api/patient/ordonnances-pharmacie                 : ses ordonnances,
 *  - POST /api/patient/ordonnances-pharmacie/{id}/demander-administration.
 *
 * Aucune transaction financière n'est traitée ici : le paiement se fait
 * en caisse physique ; le pharmacien ne fait que confirmer le statut.
 */
class PharmacieController extends AbstractController
{
    use PersonnelAccessTrait;

    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly EtablissementEquipeRepository $equipe,
        private readonly OrdonnancePharmacieRepository $ordonnances,
        private readonly NotificationService $notifications,
    ) {
    }

    protected function equipeRepository(): EtablissementEquipeRepository
    {
        return $this->equipe;
    }

    // ── Pharmacien ─────────────────────────────────────────────────────────

    /**
     * GET /api/personnel/pharmacie/ordonnances?statut=
     */
    #[Route('/api/personnel/pharmacie/ordonnances', name: 'api_personnel_pharmacie_ordonnances', methods: ['GET'])]
    public function list(Request $request): JsonResponse
    {
        $personnel = $this->requireActivePersonnel();
        $this->requirePharmacien($personnel);

        $qb = $this->ordonnances->createQueryBuilder('o')
            ->where('o.centre = :centre')
            ->setParameter('centre', $personnel->getEtablissement())
            ->orderBy('o.createdAt', 'DESC')
            ->setMaxResults(100);

        $statut = trim((string) $request->query->get('statut', ''));
        if ($statut !== '' && in_array($statut, OrdonnancePharmacie::STATUTS, true)) {
            $qb->andWhere('o.statut = :statut')->setParameter('statut', $statut);
        }

        return new JsonResponse([
            'ordonnances' => array_map(
                static fn (OrdonnancePharmacie $o): array => self::serializeOrdonnance($o),
                $qb->getQuery()->getResult()
            ),
        ]);
    }

    /**
     * POST /api/personnel/pharmacie/ordonnances/{id}/facturer
     * body: { montantTotal }
     */
    #[Route('/api/personnel/pharmacie/ordonnances/{id}/facturer', name: 'api_personnel_pharmacie_facturer', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function facturer(int $id, Request $request): JsonResponse
    {
        $personnel = $this->requireActivePersonnel();
        $this->requirePharmacien($personnel);

        $ordonnance = $this->resolveOwnOrdonnance($id, $personnel);
        if ($ordonnance->getStatut() !== OrdonnancePharmacie::STATUT_RECUE) {
            throw new BadRequestHttpException('Seule une ordonnance reçue peut être facturée.');
        }

        $montant = $request->toArray()['montantTotal'] ?? null;
        if ($montant === null || !is_numeric($montant) || (float) $montant < 0) {
            throw new BadRequestHttpException('Le montant total est obligatoire et doit être positif.');
        }

        $ordonnance
            ->setStatut(OrdonnancePharmacie::STATUT_FACTUREE)
            ->setMontantTotal(round((float) $montant, 2))
            ->setFacturePar($personnel)
            ->setFactureLe(new \DateTimeImmutable());

        $this->logPharmacie($ordonnance, $personnel, 'Ordonnance facturée', ['montantTotal' => $ordonnance->getMontantTotal()]);
        $this->em->flush();

        return new JsonResponse(['ordonnance' => self::serializeOrdonnance($ordonnance)]);
    }

    /**
     * POST /api/personnel/pharmacie/ordonnances/{id}/payer
     * Confirmation hors-ligne du paiement en caisse.
     */
    #[Route('/api/personnel/pharmacie/ordonnances/{id}/payer', name: 'api_personnel_pharmacie_payer', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function payer(int $id): JsonResponse
    {
        $personnel = $this->requireActivePersonnel();
        $this->requirePharmacien($personnel);

        $ordonnance = $this->resolveOwnOrdonnance($id, $personnel);
        if ($ordonnance->getStatut() !== OrdonnancePharmacie::STATUT_FACTUREE) {
            throw new BadRequestHttpException('Seule une ordonnance facturée peut être marquée payée.');
        }

        $ordonnance
            ->setStatut(OrdonnancePharmacie::STATUT_PAYEE)
            ->setPayePar($personnel)
            ->setPayeLe(new \DateTimeImmutable());

        $this->logPharmacie($ordonnance, $personnel, 'Paiement confirmé en caisse', [
            'montantTotal' => $ordonnance->getMontantTotal(),
        ]);

        $patient = $ordonnance->getPatient();
        if ($patient) {
            $this->notifications->create(
                $patient,
                'PHARMACIE',
                'Ordonnance payée',
                'Votre ordonnance au '.$ordonnance->getCentre()?->getNom().' est réglée. Vous pouvez demander l\'administration.',
                '/patient/prescriptions'
            );
        }
        $this->notifyManagers($ordonnance, 'Ordonnance payée', sprintf(
            'Ordonnance #%d payée (%s %s).',
            $ordonnance->getId(),
            (string) $ordonnance->getMontantTotal(),
            'FCFA'
        ));
        $this->em->flush();

        return new JsonResponse(['ordonnance' => self::serializeOrdonnance($ordonnance)]);
    }

    /**
     * POST /api/personnel/pharmacie/ordonnances/{id}/administrer
     * Passe l'ordonnance en attente d'administration par un infirmier.
     */
    #[Route('/api/personnel/pharmacie/ordonnances/{id}/administrer', name: 'api_personnel_pharmacie_administrer', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function marquerAdministrer(int $id): JsonResponse
    {
        $personnel = $this->requireActivePersonnel();
        $this->requirePharmacien($personnel);

        $ordonnance = $this->resolveOwnOrdonnance($id, $personnel);
        if ($ordonnance->getStatut() !== OrdonnancePharmacie::STATUT_PAYEE) {
            throw new BadRequestHttpException('Seule une ordonnance payée peut être préparée pour administration.');
        }

        $ordonnance->setStatut(OrdonnancePharmacie::STATUT_A_ADMINISTRER);
        $this->logPharmacie($ordonnance, $personnel, 'Ordonnance prête pour administration', null);
        $this->em->flush();

        return new JsonResponse(['ordonnance' => self::serializeOrdonnance($ordonnance)]);
    }

    /**
     * POST /api/personnel/pharmacie/ordonnances/{id}/annuler
     * body: { motif }
     */
    #[Route('/api/personnel/pharmacie/ordonnances/{id}/annuler', name: 'api_personnel_pharmacie_annuler', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function annuler(int $id, Request $request): JsonResponse
    {
        $personnel = $this->requireActivePersonnel();
        $this->requirePharmacien($personnel);

        $ordonnance = $this->resolveOwnOrdonnance($id, $personnel);
        if ($ordonnance->getStatut() === OrdonnancePharmacie::STATUT_ADMINISTREE) {
            throw new BadRequestHttpException('Une ordonnance déjà administrée ne peut pas être annulée.');
        }

        $motif = trim((string) ($request->toArray()['motif'] ?? ''));
        if ($motif === '') {
            throw new BadRequestHttpException('Le motif d\'annulation est obligatoire.');
        }

        $ordonnance
            ->setStatut(OrdonnancePharmacie::STATUT_ANNULEE)
            ->setCancelMotif($motif);

        $this->logPharmacie($ordonnance, $personnel, 'Ordonnance annulée', ['motif' => $motif]);
        $patient = $ordonnance->getPatient();
        if ($patient) {
            $this->notifications->create(
                $patient,
                'PHARMACIE',
                'Ordonnance annulée',
                'Votre ordonnance a été annulée. Motif : '.$motif,
                '/patient/prescriptions'
            );
        }
        $this->em->flush();

        return new JsonResponse(['ordonnance' => self::serializeOrdonnance($ordonnance)]);
    }

    // ── Patient ────────────────────────────────────────────────────────────

    /**
     * GET /api/patient/ordonnances-pharmacie
     */
    #[Route('/api/patient/ordonnances-pharmacie', name: 'api_patient_ordonnances_pharmacie', methods: ['GET'])]
    public function mesOrdonnances(): JsonResponse
    {
        $user = $this->requireUser();
        if (!$user instanceof \App\Entity\Patient && !$this->isAdmin($user)) {
            throw new AccessDeniedHttpException('Accès réservé aux patients.');
        }

        $rows = $this->ordonnances->createQueryBuilder('o')
            ->leftJoin('o.prescription', 'p')
            ->addSelect('p')
            ->where('o.patient = :patient')
            ->setParameter('patient', $user)
            ->orderBy('o.createdAt', 'DESC')
            ->setMaxResults(50)
            ->getQuery()
            ->getResult();

        return new JsonResponse([
            'ordonnances' => array_map(
                static fn (OrdonnancePharmacie $o): array => self::serializeOrdonnance($o),
                $rows
            ),
        ]);
    }

    /**
     * POST /api/patient/ordonnances-pharmacie/{id}/demander-administration
     */
    #[Route('/api/patient/ordonnances-pharmacie/{id}/demander-administration', name: 'api_patient_demander_administration', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function demanderAdministration(int $id): JsonResponse
    {
        $user = $this->requireUser();
        if (!$user instanceof \App\Entity\Patient) {
            throw new AccessDeniedHttpException('Accès réservé aux patients.');
        }

        $ordonnance = $this->ordonnances->find($id);
        if (!$ordonnance instanceof OrdonnancePharmacie || $ordonnance->getPatient()?->getId() !== $user->getId()) {
            throw new NotFoundHttpException('Ordonnance introuvable.');
        }
        if ($ordonnance->getStatut() !== OrdonnancePharmacie::STATUT_PAYEE) {
            throw new BadRequestHttpException(
                'Cette ordonnance n\'est pas encore prête pour l\'administration (statut : '.$ordonnance->getStatut().').'
            );
        }

        $ordonnance->setStatut(OrdonnancePharmacie::STATUT_A_ADMINISTRER);
        $this->logPharmacie($ordonnance, $user, 'Patient : demande d\'administration', null);
        $this->notifyManagers($ordonnance, 'Administration demandée', sprintf(
            'Le patient %s %s demande l\'administration de son ordonnance.',
            $user->getNom() ?? '',
            $user->getPrenom() ?? ''
        ));
        $this->em->flush();

        return new JsonResponse(['ordonnance' => self::serializeOrdonnance($ordonnance)]);
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private function requirePharmacien(PersonnelSante $personnel): void
    {
        if ($personnel->getTypePersonnel() !== PersonnelSante::TYPE_PHARMACIEN) {
            throw new AccessDeniedHttpException(
                'Accès réservé aux pharmaciens de l\'établissement.'
            );
        }
    }

    private function resolveOwnOrdonnance(int $id, PersonnelSante $personnel): OrdonnancePharmacie
    {
        $ordonnance = $this->ordonnances->find($id);
        if (!$ordonnance instanceof OrdonnancePharmacie
            || $ordonnance->getCentre()?->getId() !== $personnel->getEtablissement()->getId()) {
            throw new NotFoundHttpException('Ordonnance introuvable dans votre établissement.');
        }

        return $ordonnance;
    }

    private function logPharmacie(OrdonnancePharmacie $o, \App\Entity\User $auteur, string $titre, ?array $details): void
    {
        $dossier = null;
        if ($o->getPatient() && $o->getCentre()) {
            $dossier = $this->em->getRepository(\App\Entity\DossierMedical::class)
                ->findOneByCentrePatient($o->getCentre(), $o->getPatient());
        }

        $this->em->persist((new DossierEvenement())
            ->setDossier($dossier)
            ->setPatient($o->getPatient())
            ->setCentre($o->getCentre())
            ->setType(DossierEvenement::TYPE_PHARMACIE)
            ->setTitre($titre)
            ->setDetails(array_merge($details ?? [], ['statut' => $o->getStatut(), 'ordonnanceId' => $o->getId()]))
            ->setAuteur($auteur));
    }

    private function notifyManagers(OrdonnancePharmacie $o, string $title, string $body): void
    {
        $centre = $o->getCentre();
        if (!$centre) {
            return;
        }

        $managers = $this->equipe->createQueryBuilder('e')
            ->join('e.user', 'u')
            ->addSelect('u')
            ->where('e.etablissement = :centre')
            ->setParameter('centre', $centre)
            ->andWhere('e.statut = :statut')
            ->setParameter('statut', 'ACTIF')
            ->andWhere('e.role IN (:roles)')
            ->setParameter('roles', ['DIRECTEUR', 'GESTIONNAIRE'])
            ->setMaxResults(20)
            ->getQuery()
            ->getResult();

        foreach ($managers as $membership) {
            $manager = $membership->getUser();
            if ($manager) {
                $this->notifications->create($manager, 'PHARMACIE', $title, $body, '/espace-etablissement');
            }
        }
    }

    /** @return array<string, mixed> */
    private static function serializeOrdonnance(OrdonnancePharmacie $o): array
    {
        $prescription = $o->getPrescription();
        $patient = $o->getPatient();

        return [
            'id' => $o->getId(),
            'statut' => $o->getStatut(),
            'montantTotal' => $o->getMontantTotal(),
            'cancelMotif' => $o->getCancelMotif(),
            'prescription' => $prescription ? [
                'id' => $prescription->getId(),
                'diagnostic' => $prescription->getDiagnostic(),
                'recommandations' => $prescription->getRecommandations(),
                'medecin' => $prescription->getMedecin() ? [
                    'nom' => $prescription->getMedecin()->getNom(),
                    'prenom' => $prescription->getMedecin()->getPrenom(),
                    'specialite' => $prescription->getMedecin()->getSpecialite(),
                ] : null,
            ] : null,
            'patient' => $patient ? [
                'id' => (string) $patient->getId(),
                'nom' => $patient->getNom(),
                'prenom' => $patient->getPrenom(),
                'telephone' => $patient->getTelephone(),
            ] : null,
            'factureLe' => $o->getFactureLe()?->format('c'),
            'payeLe' => $o->getPayeLe()?->format('c'),
            'createdAt' => $o->getCreatedAt()->format('c'),
            'updatedAt' => $o->getUpdatedAt()->format('c'),
        ];
    }
}
