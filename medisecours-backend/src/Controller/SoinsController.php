<?php

declare(strict_types=1);

namespace App\Controller;

use App\Entity\DossierEvenement;
use App\Entity\DossierMedical;
use App\Entity\OrdonnancePharmacie;
use App\Entity\SoinAdministre;
use App\Repository\DossierMedicalRepository;
use App\Repository\EtablissementEquipeRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\Routing\Annotation\Route;

/**
 * Soins infirmiers (IDE) / aide-soignants (AS).
 *
 *  - GET  /api/personnel/soins                 : liste (filtres statut / patient),
 *  - POST /api/personnel/soins                 : planifier un soin,
 *  - POST /api/personnel/soins/{id}/realiser   : réaliser (signature obligatoire),
 *  - POST /api/personnel/soins/{id}/annuler    : annuler.
 *
 * La réalisation exige une signature manuscrite (data-URI) ; le hash
 * SHA-256 est horodaté dans le dossier du patient (non-répudiable).
 */
class SoinsController extends AbstractController
{
    use PersonnelAccessTrait;

    private const SIGNATURE_MAX_BYTES = 1_572_864; // 1,5 Mo

    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly EtablissementEquipeRepository $equipe,
        private readonly DossierMedicalRepository $dossiers,
    ) {
    }

    protected function equipeRepository(): EtablissementEquipeRepository
    {
        return $this->equipe;
    }

    /**
     * GET /api/personnel/soins?statut=&dossierId=
     */
    #[Route('/api/personnel/soins', name: 'api_personnel_soins', methods: ['GET'])]
    public function list(Request $request): JsonResponse
    {
        $personnel = $this->requireActivePersonnel();
        $this->requirePersonnelTypes($personnel, [
            \App\Entity\PersonnelSante::TYPE_INFIRMIER,
            \App\Entity\PersonnelSante::TYPE_AIDE_SOIGNANT,
        ], 'Accès réservé aux infirmiers et aide-soignants.');

        $qb = $this->em->getRepository(SoinAdministre::class)->createQueryBuilder('s')
            ->join('s.dossier', 'd')
            ->addSelect('d')
            ->where('d.centre = :centre')
            ->setParameter('centre', $personnel->getEtablissement())
            ->orderBy('s.createdAt', 'DESC')
            ->setMaxResults(100);

        $statut = trim((string) $request->query->get('statut', ''));
        if ($statut !== '' && in_array($statut, [SoinAdministre::STATUT_PLANIFIE, SoinAdministre::STATUT_EN_COURS, SoinAdministre::STATUT_REALISE, SoinAdministre::STATUT_ANNULE], true)) {
            $qb->andWhere('s.statut = :statut')->setParameter('statut', $statut);
        }

        $dossierId = filter_var($request->query->get('dossierId'), FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        if ($dossierId !== false && $dossierId !== null) {
            $qb->andWhere('d.id = :dossierId')->setParameter('dossierId', $dossierId);
        }

        $soins = $qb->getQuery()->getResult();

        return new JsonResponse([
            'soins' => array_map(static fn (SoinAdministre $s): array => self::serializeSoin($s), $soins),
        ]);
    }

    /**
     * POST /api/personnel/soins
     * body: { libelle, details?, dossierId, consultationId?, ordonnanceId? }
     */
    #[Route('/api/personnel/soins', name: 'api_personnel_soins_create', methods: ['POST'])]
    public function create(Request $request): JsonResponse
    {
        $personnel = $this->requireActivePersonnel();
        $this->requirePersonnelTypes($personnel, [
            \App\Entity\PersonnelSante::TYPE_INFIRMIER,
            \App\Entity\PersonnelSante::TYPE_AIDE_SOIGNANT,
        ], 'Création de soin réservée aux infirmiers et aide-soignants.');

        $data = $request->toArray();
        $libelle = trim((string) ($data['libelle'] ?? ''));
        if ($libelle === '') {
            throw new BadRequestHttpException('Le libellé du soin est obligatoire.');
        }

        $dossier = $this->resolveOwnDossier((int) ($data['dossierId'] ?? 0), $personnel->getEtablissement()->getId());

        $soin = (new SoinAdministre())
            ->setDossier($dossier)
            ->setPatient($dossier->getPatient())
            ->setLibelle($libelle)
            ->setDetails(isset($data['details']) ? trim((string) $data['details']) : null)
            ->setStatut(SoinAdministre::STATUT_PLANIFIE);

        $consultationId = filter_var($data['consultationId'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        if ($consultationId !== false && $consultationId !== null) {
            $consultation = $this->em->getRepository(\App\Entity\Consultation::class)->find($consultationId);
            if ($consultation) {
                $soin->setConsultation($consultation);
            }
        }

        $ordonnanceId = filter_var($data['ordonnanceId'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        if ($ordonnanceId !== false && $ordonnanceId !== null) {
            $ordonnance = $this->em->getRepository(OrdonnancePharmacie::class)->find($ordonnanceId);
            if ($ordonnance) {
                $soin->setOrdonnance($ordonnance);
            }
        }

        $this->em->persist($soin);
        $this->em->persist((new DossierEvenement())
            ->setDossier($dossier)
            ->setPatient($dossier->getPatient())
            ->setCentre($personnel->getEtablissement())
            ->setType(DossierEvenement::TYPE_SOIN)
            ->setTitre('Soin planifié : '.$libelle)
            ->setDetails(['statut' => SoinAdministre::STATUT_PLANIFIE, 'details' => $soin->getDetails()])
            ->setAuteur($personnel));
        $this->em->flush();

        return new JsonResponse(['soin' => self::serializeSoin($soin)], Response::HTTP_CREATED);
    }

    /**
     * POST /api/personnel/soins/{id}/realiser
     * body: { signatureImage (data-URI), observations? }
     */
    #[Route('/api/personnel/soins/{id}/realiser', name: 'api_personnel_soins_realiser', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function realiser(int $id, Request $request): JsonResponse
    {
        $personnel = $this->requireActivePersonnel();
        $this->requirePersonnelTypes($personnel, [
            \App\Entity\PersonnelSante::TYPE_INFIRMIER,
            \App\Entity\PersonnelSante::TYPE_AIDE_SOIGNANT,
        ], 'Réalisation de soin réservée aux infirmiers et aide-soignants.');

        $soin = $this->em->getRepository(SoinAdministre::class)->find($id);
        if (!$soin instanceof SoinAdministre || $soin->getDossier()?->getCentre()?->getId() !== $personnel->getEtablissement()->getId()) {
            throw new NotFoundHttpException('Soin introuvable dans votre établissement.');
        }
        if ($soin->getStatut() !== SoinAdministre::STATUT_PLANIFIE && $soin->getStatut() !== SoinAdministre::STATUT_EN_COURS) {
            throw new BadRequestHttpException('Ce soin ne peut plus être réalisé (statut : '.$soin->getStatut().').');
        }

        $data = $request->toArray();
        $signature = trim((string) ($data['signatureImage'] ?? ''));
        if ($signature === '' || !str_starts_with($signature, 'data:image/')) {
            throw new BadRequestHttpException('La signature manuscrite (image) est obligatoire pour réaliser un soin.');
        }
        if (strlen($signature) > self::SIGNATURE_MAX_BYTES) {
            throw new BadRequestHttpException('La signature dépasse la taille maximale de 1,5 Mo.');
        }

        $signatureHash = hash('sha256', $signature.'|'.$soin->getId().'|'.$personnel->getId().'|'.(new \DateTimeImmutable())->format('c'));

        $soin
            ->setStatut(SoinAdministre::STATUT_REALISE)
            ->setInfirmier($personnel)
            ->setSignatureImage($signature)
            ->setSignatureHash($signatureHash)
            ->setRealisedAt(new \DateTimeImmutable());

        $observations = isset($data['observations']) ? trim((string) $data['observations']) : null;
        $this->em->persist((new DossierEvenement())
            ->setDossier($soin->getDossier())
            ->setPatient($soin->getPatient())
            ->setCentre($personnel->getEtablissement())
            ->setType(DossierEvenement::TYPE_SOIN)
            ->setTitre('Soin réalisé : '.$soin->getLibelle())
            ->setDetails([
                'statut' => SoinAdministre::STATUT_REALISE,
                'observations' => $observations,
                'details' => $soin->getDetails(),
            ])
            ->setAuteur($personnel)
            ->setSignatureHash($signatureHash));

        if ($soin->getOrdonnance() instanceof OrdonnancePharmacie
            && $soin->getOrdonnance()->getStatut() === OrdonnancePharmacie::STATUT_A_ADMINISTRER) {
            $soin->getOrdonnance()->setStatut(OrdonnancePharmacie::STATUT_ADMINISTREE);
            $this->em->persist((new DossierEvenement())
                ->setDossier($soin->getDossier())
                ->setPatient($soin->getPatient())
                ->setCentre($personnel->getEtablissement())
                ->setType(DossierEvenement::TYPE_PHARMACIE)
                ->setTitre('Ordonnance administrée')
                ->setDetails(['statut' => OrdonnancePharmacie::STATUT_ADMINISTREE, 'soinId' => $soin->getId()])
                ->setAuteur($personnel)
                ->setSignatureHash($signatureHash));
        }

        $this->em->flush();

        return new JsonResponse(['soin' => self::serializeSoin($soin)]);
    }

    /**
     * POST /api/personnel/soins/{id}/annuler
     * body: { motif? }
     */
    #[Route('/api/personnel/soins/{id}/annuler', name: 'api_personnel_soins_annuler', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function annuler(int $id, Request $request): JsonResponse
    {
        $personnel = $this->requireActivePersonnel();
        $this->requirePersonnelTypes($personnel, [
            \App\Entity\PersonnelSante::TYPE_INFIRMIER,
            \App\Entity\PersonnelSante::TYPE_AIDE_SOIGNANT,
        ], 'Annulation de soin réservée aux infirmiers et aide-soignants.');

        $soin = $this->em->getRepository(SoinAdministre::class)->find($id);
        if (!$soin instanceof SoinAdministre || $soin->getDossier()?->getCentre()?->getId() !== $personnel->getEtablissement()->getId()) {
            throw new NotFoundHttpException('Soin introuvable dans votre établissement.');
        }
        if ($soin->getStatut() === SoinAdministre::STATUT_REALISE) {
            throw new BadRequestHttpException('Un soin déjà réalisé ne peut pas être annulé.');
        }

        $motif = isset($request->toArray()['motif']) ? trim((string) $request->toArray()['motif']) : null;
        $soin->setStatut(SoinAdministre::STATUT_ANNULE);

        $this->em->persist((new DossierEvenement())
            ->setDossier($soin->getDossier())
            ->setPatient($soin->getPatient())
            ->setCentre($personnel->getEtablissement())
            ->setType(DossierEvenement::TYPE_SOIN)
            ->setTitre('Soin annulé : '.$soin->getLibelle())
            ->setDetails(['motif' => $motif])
            ->setAuteur($personnel));
        $this->em->flush();

        return new JsonResponse(['soin' => self::serializeSoin($soin)]);
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private function resolveOwnDossier(int $dossierId, int $centreId): DossierMedical
    {
        $dossier = $dossierId > 0 ? $this->dossiers->find($dossierId) : null;
        if (!$dossier instanceof DossierMedical || $dossier->getCentre()?->getId() !== $centreId) {
            throw new NotFoundHttpException('Dossier patient introuvable dans votre établissement.');
        }

        return $dossier;
    }

    /** @return array<string, mixed> */
    private static function serializeSoin(SoinAdministre $s): array
    {
        $dossier = $s->getDossier();
        $patient = $s->getPatient();

        return [
            'id' => $s->getId(),
            'libelle' => $s->getLibelle(),
            'details' => $s->getDetails(),
            'statut' => $s->getStatut(),
            'dossierId' => $dossier?->getId(),
            'dossierNumero' => $dossier?->getNumero(),
            'patient' => $patient ? [
                'id' => (string) $patient->getId(),
                'nom' => $patient->getNom(),
                'prenom' => $patient->getPrenom(),
            ] : null,
            'infirmier' => $s->getInfirmier() ? [
                'nom' => $s->getInfirmier()->getNom(),
                'prenom' => $s->getInfirmier()->getPrenom(),
                'type' => $s->getInfirmier()->getTypePersonnel(),
            ] : null,
            'signatureHash' => $s->getSignatureHash(),
            'createdAt' => $s->getCreatedAt()->format('c'),
            'realisedAt' => $s->getRealisedAt()?->format('c'),
            'ordonnanceId' => $s->getOrdonnance()?->getId(),
        ];
    }
}
