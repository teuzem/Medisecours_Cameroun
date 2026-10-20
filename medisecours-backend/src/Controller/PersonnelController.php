<?php

declare(strict_types=1);

namespace App\Controller;

use App\Entity\CentreDeSante;
use App\Entity\DossierEvenement;
use App\Entity\DossierMedical;
use App\Entity\DocumentValidation;
use App\Entity\EtablissementEquipe;
use App\Entity\Patient;
use App\Entity\PersonnelSante;
use App\Entity\SigneVitaux;
use App\Entity\User;
use App\Repository\CentreDeSanteRepository;
use App\Repository\DossierMedicalRepository;
use App\Repository\EtablissementEquipeRepository;
use App\Repository\UserRepository;
use App\Service\NotificationService;
use App\Service\UserSerializer;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\RateLimiter\RateLimiterFactory;
use Symfony\Component\Routing\Annotation\Route;

/**
 * Circuit « personnels d'établissement » (hors médecins).
 *
 *  - POST /api/personnel/register             : inscription (pièces + établissement),
 *  - GET  /api/personnel/moi                  : profil + statut de validation,
 *  - POST /api/personnel/documents            : dépôt (ou dépôt) d'une pièce,
 *  - GET  /api/personnel/dashboard            : indicateurs du poste,
 *  - GET  /api/personnel/patients             : recherche patient (réception),
 *  - POST /api/personnel/dossiers             : admission (dossier + signes vitaux),
 *  - GET  /api/personnel/dossiers             : liste des dossiers,
 *  - GET  /api/personnel/dossiers/{id}        : dossier + herodates.
 */
class PersonnelController extends AbstractController
{
    use PersonnelAccessTrait;

    public const TYPES_DOCUMENTS = DocumentValidation::TYPES;

    private const DOCUMENT_MAX_BYTES = 3_145_728; // 3 Mo

    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly EtablissementEquipeRepository $equipe,
        private readonly UserRepository $users,
        private readonly CentreDeSanteRepository $centres,
        private readonly DossierMedicalRepository $dossiers,
        private readonly NotificationService $notifications,
        private readonly UserSerializer $userSerializer,
        #[Autowire(service: 'limiter.auth_register')]
        private readonly RateLimiterFactory $registerLimiter,
    ) {
    }

    protected function equipeRepository(): EtablissementEquipeRepository
    {
        return $this->equipe;
    }

    // ── Inscription ────────────────────────────────────────────────────────

    /**
     * POST /api/personnel/register
     *
     * body: { email, password, nom, prenom, telephone, typePersonnel,
     *         etablissementId, fonction?, numeroOrdre?,
     *         documents: [{ typeDocument, titre?, fichierData }] }
     */
    #[Route('/api/personnel/register', name: 'api_personnel_register', methods: ['POST'])]
    public function register(Request $request, UserPasswordHasherInterface $passwordHasher): JsonResponse
    {
        $limiter = $this->registerLimiter->create($request->getClientIp());
        if (!$limiter->consume(1)->isAccepted()) {
            return new JsonResponse(
                ['error' => 'Trop de créations de compte. Réessayez dans une heure.'],
                Response::HTTP_TOO_MANY_REQUESTS
            );
        }

        $data = $request->toArray();

        $email = strtolower(trim((string) ($data['email'] ?? '')));
        $password = (string) ($data['password'] ?? '');
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return new JsonResponse(['error' => 'Adresse email invalide.'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }
        if (!preg_match('/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/', $password)) {
            return new JsonResponse([
                'error' => 'Le mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }
        if ($this->users->findOneBy(['email' => $email])) {
            return new JsonResponse(['error' => 'Un compte existe déjà avec cet email.'], Response::HTTP_CONFLICT);
        }

        $typePersonnel = strtoupper(trim((string) ($data['typePersonnel'] ?? '')));
        if (!in_array($typePersonnel, PersonnelSante::TYPES, true)) {
            return new JsonResponse(['error' => 'Type de personnel invalide.'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $etablissementId = filter_var($data['etablissementId'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        if ($etablissementId === false || $etablissementId === null) {
            return new JsonResponse(['error' => 'L\'établissement de rattachement est obligatoire.'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }
        $centre = $this->centres->find($etablissementId);
        if (!$centre instanceof CentreDeSante) {
            return new JsonResponse(['error' => 'Établissement introuvable.'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $documents = $data['documents'] ?? [];
        if (!is_array($documents) || $documents === []) {
            return new JsonResponse(['error' => 'Au moins une pièce justificative est requise.'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $user = (new PersonnelSante())
            ->setTypePersonnel($typePersonnel)
            ->setEtablissement($centre)
            ->setStatutValidation(PersonnelSante::VALIDATION_EN_ATTENTE);
        $user->setEmail($email);
        $user->setPassword($passwordHasher->hashPassword($user, $password));
        if (isset($data['nom'])) {
            $user->setNom((string) $data['nom']);
        }
        if (isset($data['prenom'])) {
            $user->setPrenom((string) $data['prenom']);
        }
        if (isset($data['telephone'])) {
            $user->setTelephone((string) $data['telephone']);
        }
        if (isset($data['fonction'])) {
            $user->setFonction(trim((string) $data['fonction']));
        }
        if (isset($data['numeroOrdre'])) {
            $user->setNumeroOrdre(trim((string) $data['numeroOrdre']));
        }

        $documentEntities = [];
        foreach ($documents as $raw) {
            if (!is_array($raw)) {
                continue;
            }
            $typeDocument = strtoupper(trim((string) ($raw['typeDocument'] ?? '')));
            if (!in_array($typeDocument, self::TYPES_DOCUMENTS, true)) {
                return new JsonResponse(['error' => 'Type de document invalide : '.$typeDocument], Response::HTTP_UNPROCESSABLE_ENTITY);
            }
            $fichierData = trim((string) ($raw['fichierData'] ?? ''));
            if ($fichierData === '' || !str_starts_with($fichierData, 'data:image/')) {
                return new JsonResponse(['error' => 'Chaque pièce doit être une image encodée en base64.'], Response::HTTP_UNPROCESSABLE_ENTITY);
            }
            if (strlen($fichierData) > self::DOCUMENT_MAX_BYTES) {
                return new JsonResponse(['error' => 'La pièce « '.$typeDocument.' » dépasse la taille maximale de 3 Mo.'], Response::HTTP_UNPROCESSABLE_ENTITY);
            }
            $documentEntities[] = (new DocumentValidation())
                ->setPersonnel($user)
                ->setTypeDocument($typeDocument)
                ->setTitre(isset($raw['titre']) ? trim((string) $raw['titre']) : null)
                ->setOriginalName($typeDocument)
                ->setFichierData($fichierData)
                ->setStatut(DocumentValidation::STATUT_EN_ATTENTE);
        }
        if ($documentEntities === []) {
            return new JsonResponse(['error' => 'Aucune pièce valide reçue.'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $membership = (new EtablissementEquipe())
            ->setEtablissement($centre)
            ->setUser($user)
            ->setRole(PersonnelSante::ROLE_EQUIPE_MAP[$typePersonnel])
            ->setStatut('INVITE')
            ->setInvitePar($user)
            ->setUpdatedAt(new \DateTimeImmutable());

        $connection = $this->em->getConnection();
        $connection->beginTransaction();
        try {
            $this->em->persist($user);
            foreach ($documentEntities as $document) {
                $this->em->persist($document);
            }
            $this->em->persist($membership);
            $this->em->flush();
            $connection->commit();
        } catch (\Throwable) {
            if ($connection->isTransactionActive()) {
                $connection->rollBack();
            }

            return new JsonResponse(['error' => 'Impossible de finaliser l\'inscription pour le moment.'], Response::HTTP_SERVICE_UNAVAILABLE);
        }

        $this->notifyManagersOfCentre($centre, 'Nouvelle demande de personnel', sprintf(
            '%s %s (%s) demande à rejoindre l\'établissement.',
            $user->getNom() ?? '',
            $user->getPrenom() ?? '',
            $typePersonnel
        ), '/espace-etablissement');

        return new JsonResponse([
            'message' => 'Demande enregistrée. Elle sera examinée par un manager de l\'établissement.',
            'user' => $this->userSerializer->serialize($user),
            'statutValidation' => $user->getStatutValidation(),
        ], Response::HTTP_CREATED);
    }

    // ── Profil ─────────────────────────────────────────────────────────────

    /**
     * GET /api/personnel/moi
     */
    #[Route('/api/personnel/moi', name: 'api_personnel_moi', methods: ['GET'])]
    public function moi(): JsonResponse
    {
        $user = $this->requireUser();
        if (!$user instanceof PersonnelSante) {
            throw new AccessDeniedHttpException('Accès réservé au personnel d\'établissement.');
        }

        $membership = $user->getEtablissement()
            ? $this->equipe->findActiveMember($user, $user->getEtablissement())
            : null;

        return new JsonResponse([
            'user' => $this->userSerializer->serialize($user),
            'typePersonnel' => $user->getTypePersonnel(),
            'fonction' => $user->getFonction(),
            'numeroOrdre' => $user->getNumeroOrdre(),
            'statutValidation' => $user->getStatutValidation(),
            'validationMotif' => $user->getValidationMotif(),
            'etablissement' => $user->getEtablissement() ? [
                'id' => $user->getEtablissement()->getId(),
                'nom' => $user->getEtablissement()->getNom(),
                'ville' => $user->getEtablissement()->getVille(),
            ] : null,
            'equipeStatut' => $membership?->getStatut(),
            'documents' => array_map(
                fn (DocumentValidation $d): array => self::serializeDocument($d),
                $this->em->getRepository(DocumentValidation::class)->findBy(['personnel' => $user], ['createdAt' => 'DESC'])
            ),
        ]);
    }

    // ── Dépôt de pièce ─────────────────────────────────────────────────────

    /**
     * POST /api/personnel/documents
     * body: { typeDocument, titre?, fichierData }
     */
    #[Route('/api/personnel/documents', name: 'api_personnel_documents', methods: ['POST'])]
    public function addDocument(Request $request): JsonResponse
    {
        $user = $this->requireUser();
        if (!$user instanceof PersonnelSante) {
            throw new AccessDeniedHttpException('Accès réservé au personnel d\'établissement.');
        }
        if ($user->getStatutValidation() === PersonnelSante::VALIDATION_VALIDE) {
            throw new BadRequestHttpException('Vos pièces sont déjà validées.');
        }

        $data = $request->toArray();
        $typeDocument = strtoupper(trim((string) ($data['typeDocument'] ?? '')));
        $fichierData = trim((string) ($data['fichierData'] ?? ''));
        if (!in_array($typeDocument, self::TYPES_DOCUMENTS, true)) {
            throw new BadRequestHttpException('Type de document invalide.');
        }
        if ($fichierData === '' || !str_starts_with($fichierData, 'data:image/')) {
            throw new BadRequestHttpException('La pièce doit être une image encodée en base64.');
        }
        if (strlen($fichierData) > self::DOCUMENT_MAX_BYTES) {
            throw new BadRequestHttpException('La pièce dépasse la taille maximale de 3 Mo.');
        }

        if ($user->getStatutValidation() === PersonnelSante::VALIDATION_REJETE) {
            $user->setStatutValidation(PersonnelSante::VALIDATION_EN_ATTENTE)->setValidationMotif(null);
        }

        $document = (new DocumentValidation())
            ->setPersonnel($user)
            ->setTypeDocument($typeDocument)
            ->setTitre(isset($data['titre']) ? trim((string) $data['titre']) : null)
            ->setOriginalName($typeDocument)
            ->setFichierData($fichierData)
            ->setStatut(DocumentValidation::STATUT_EN_ATTENTE);
        $this->em->persist($document);
        $this->em->flush();

        if ($user->getEtablissement()) {
            $this->notifyManagersOfCentre(
                $user->getEtablissement(),
                'Nouvelle pièce de personnel',
                sprintf('%s %s a déposé une pièce (%s).', $user->getNom() ?? '', $user->getPrenom() ?? '', $typeDocument),
                '/espace-etablissement'
            );
        }

        return new JsonResponse(['document' => self::serializeDocument($document)], Response::HTTP_CREATED);
    }

    // ── Tableau de bord poste ──────────────────────────────────────────────

    /**
     * GET /api/personnel/dashboard
     */
    #[Route('/api/personnel/dashboard', name: 'api_personnel_dashboard', methods: ['GET'])]
    public function dashboard(): JsonResponse
    {
        $personnel = $this->requireActivePersonnel();
        $centre = $personnel->getEtablissement();

        $today = new \DateTimeImmutable('today');
        $stats = match ($personnel->getTypePersonnel()) {
            PersonnelSante::TYPE_RECEPTIONNISTE => $this->receptionDashboard($centre, $today),
            PersonnelSante::TYPE_INFIRMIER, PersonnelSante::TYPE_AIDE_SOIGNANT => $this->careDashboard($centre, $today),
            PersonnelSante::TYPE_PHARMACIEN => $this->pharmacyDashboard($centre, $today),
            PersonnelSante::TYPE_AMBULANCIER => $this->ambulanceDashboard($centre, $today),
            default => [],
        };

        return new JsonResponse([
            'typePersonnel' => $personnel->getTypePersonnel(),
            'etablissement' => ['id' => $centre->getId(), 'nom' => $centre->getNom()],
            'stats' => $stats,
            // Séries et répartitions pour les graphiques du tableau de bord.
            'activite' => $this->activiteDashboard($centre),
            'dossiers' => $this->dossiersDashboard($centre),
            'notation' => [
                'noteMoyenne' => $personnel->getNoteMoyenne(),
                'totalAvis' => $personnel->getTotalAvis(),
                'distribution' => $this->em->getRepository(\App\Entity\AvisPersonnel::class)
                    ->getNoteDistribution($personnel),
            ],
            'identite' => [
                'photoProfil' => $personnel->getPhotoProfil(),
                'photoCouverture' => $personnel->getPhotoCouverture(),
                'fonction' => $personnel->getFonction(),
                'numeroOrdre' => $personnel->getNumeroOrdre(),
                'nom' => $personnel->getNom(),
                'prenom' => $personnel->getPrenom(),
            ],
        ]);
    }

    /**
     * Activité des 14 derniers jours : admissions, soins, consultations et
     * actes de pharmacie, par jour. Alimente les graphiques du tableau de bord.
     */
    private function activiteDashboard(CentreDeSante $centre): array
    {
        $debut = new \DateTimeImmutable('-13 days');
        $series = [];
        for ($i = 0; $i < 14; ++$i) {
            $jour = $debut->modify('+'.$i.' days');
            $series[$jour->format('Y-m-d')] = [
                'date' => $jour->format('Y-m-d'),
                'admissions' => 0,
                'soins' => 0,
                'consultations' => 0,
                'pharmacie' => 0,
            ];
        }

        $compter = static function (array $series, iterable $dates, string $cle): void {
            foreach ($dates as $date) {
                $jour = $date?->format('Y-m-d');
                if ($jour !== null && isset($series[$jour])) {
                    ++$series[$jour][$cle];
                }
            }
        };

        $admissions = $this->em->getRepository(DossierMedical::class)->createQueryBuilder('d')
            ->select('d.createdAt')
            ->where('d.centre = :centre')
            ->setParameter('centre', $centre)
            ->andWhere('d.createdAt >= :debut')
            ->setParameter('debut', $debut)
            ->getQuery()
            ->getScalarResult();
        $compter($series, $admissions, 'admissions');

        $soins = $this->em->getRepository(\App\Entity\SoinAdministre::class)->createQueryBuilder('s')
            ->select('s.createdAt', 's.realisedAt')
            ->join('s.dossier', 'd')
            ->where('d.centre = :centre')
            ->setParameter('centre', $centre)
            ->getQuery()
            ->getArrayResult();
        $compter($series, array_column($soins, 'realisedAt'), 'soins');
        $compter($series, array_column($soins, 'createdAt'), 'soins');

        $consultations = $this->em->getRepository(\App\Entity\Consultation::class)->createQueryBuilder('c')
            ->select('c.createdAt')
            ->where('c.etablissement = :centre')
            ->setParameter('centre', $centre)
            ->andWhere('c.createdAt >= :debut')
            ->setParameter('debut', $debut)
            ->getQuery()
            ->getScalarResult();
        $compter($series, $consultations, 'consultations');

        $pharmacie = $this->em->getRepository(\App\Entity\OrdonnancePharmacie::class)->createQueryBuilder('o')
            ->select('o.createdAt')
            ->where('o.centre = :centre')
            ->setParameter('centre', $centre)
            ->andWhere('o.createdAt >= :debut')
            ->setParameter('debut', $debut)
            ->getQuery()
            ->getScalarResult();
        $compter($series, $pharmacie, 'pharmacie');

        return array_values($series);
    }

    /**
     * Répartition des dossiers de l'établissement : statut et nombre de visites.
     */
    private function dossiersDashboard(CentreDeSante $centre): array
    {
        $dossiers = $this->dossiers->searchByCentre($centre, null, 2000);

        $statuts = [DossierMedical::STATUT_OUVERT => 0, DossierMedical::STATUT_CLOS => 0];
        $visites = 0;
        foreach ($dossiers as $row) {
            $dossier = $row['dossier'];
            $statuts[$dossier->getStatut()] = ($statuts[$dossier->getStatut()] ?? 0) + 1;
            $visites += $dossier->getNombreVisites();
        }

        return [
            'statuts' => $statuts,
            'total' => count($dossiers),
            'visites' => $visites,
        ];
    }

    /**
     * Tableau de bord de l'ambulancier : prises en charge SOS et Interventions.
     */
    private function ambulanceDashboard(CentreDeSante $centre, \DateTimeImmutable $today): array
    {
        $demandes = $this->em->getRepository(\App\Entity\DemandeSos::class)->createQueryBuilder('d')
            ->where('d.etablissement = :centre')
            ->setParameter('centre', $centre)
            ->getQuery()
            ->getResult();

        $statuts = [];
        $jour = 0;
        foreach ($demandes as $demande) {
            $statut = $demande->getStatut();
            $statuts[$statut] = ($statuts[$statut] ?? 0) + 1;
            if ($demande->getCreatedAt()?->format('Y-m-d') === $today->format('Y-m-d')) {
                ++$jour;
            }
        }

        return ['sos' => $statuts, 'interventionsJour' => $jour];
    }

    // ── Patients (recherche accueil) ───────────────────────────────────────

    /**
     * GET /api/personnel/patients?q=
     */
    #[Route('/api/personnel/patients', name: 'api_personnel_patients', methods: ['GET'])]
    public function searchPatients(Request $request): JsonResponse
    {
        $personnel = $this->requireActivePersonnel();
        $this->requirePersonnelTypes($personnel, [
            PersonnelSante::TYPE_RECEPTIONNISTE,
            PersonnelSante::TYPE_INFIRMIER,
            PersonnelSante::TYPE_AIDE_SOIGNANT,
        ], 'Recherche patient réservée à l\'accueil et aux soignants.');

        $query = trim((string) $request->query->get('q', ''));
        if ($query === '') {
            return new JsonResponse(['patients' => []]);
        }

        $patients = $this->users->createQueryBuilder('u')
            ->where('u INSTANCE OF App\Entity\Patient')
            ->andWhere('u.nom LIKE :q OR u.prenom LIKE :q OR u.email LIKE :q OR u.telephone LIKE :q')
            ->setParameter('q', '%'.$query.'%')
            ->setMaxResults(20)
            ->getQuery()
            ->getResult();

        return new JsonResponse([
            'patients' => array_map(static function (Patient $p) {
                return [
                    'id' => (string) $p->getId(),
                    'nom' => $p->getNom(),
                    'prenom' => $p->getPrenom(),
                    'email' => $p->getEmail(),
                    'telephone' => $p->getTelephone(),
                ];
            }, $patients),
        ]);
    }

    // ── Dossiers (accueil) ─────────────────────────────────────────────────

    /**
     * GET /api/personnel/dossiers?q=&page=1
     */
    #[Route('/api/personnel/dossiers', name: 'api_personnel_dossiers', methods: ['GET'])]
    public function listDossiers(Request $request): JsonResponse
    {
        $personnel = $this->requireActivePersonnel();
        $centre = $personnel->getEtablissement();
        $query = trim((string) $request->query->get('q', ''));
        $page = max(1, (int) $request->query->get('page', 1));
        $perPage = 20;

        $rows = $this->dossiers->searchByCentre($centre, $query !== '' ? $query : null, 200);
        $slice = array_slice($rows, ($page - 1) * $perPage, $perPage);

        return new JsonResponse([
            'total' => count($rows),
            'page' => $page,
            'perPage' => $perPage,
            'dossiers' => array_map(
                static fn (array $row): array => self::serializeDossier($row['dossier'], $row['patient']),
                $slice
            ),
        ]);
    }

    /**
     * POST /api/personnel/dossiers
     *
     * Admission : ouvre (ou réutilise) le dossier du patient pour l'établissement,
     * enregistre les constantes vitales et écrit les événements ACCUEIL +
     * SIGNE_VITAUX dans l'herodates.
     *
     * body: { patientId, motifs?, signesVitaux: { ... } }
     */
    #[Route('/api/personnel/dossiers', name: 'api_personnel_dossier_admission', methods: ['POST'])]
    public function admitPatient(Request $request): JsonResponse
    {
        $personnel = $this->requireActivePersonnel();
        $this->requirePersonnelTypes($personnel, [
            PersonnelSante::TYPE_RECEPTIONNISTE,
            PersonnelSante::TYPE_INFIRMIER,
            PersonnelSante::TYPE_AIDE_SOIGNANT,
        ], 'Admission réservée à l\'accueil et aux soignants.');

        $centre = $personnel->getEtablissement();
        $data = $request->toArray();

        $patientId = (string) ($data['patientId'] ?? '');
        $patient = $this->em->getRepository(Patient::class)->find($patientId);
        if (!$patient instanceof Patient) {
            throw new NotFoundHttpException('Patient introuvable.');
        }

        $connection = $this->em->getConnection();
        $connection->beginTransaction();
        try {
            $dossier = $this->dossiers->findOneByCentrePatient($centre, $patient);
            $isNew = $dossier === null;
            if ($isNew) {
                $dossier = (new DossierMedical())
                    ->setCentre($centre)
                    ->setPatient($patient)
                    ->setOpenedBy($personnel);
                $this->em->persist($dossier);
                $this->em->flush();
            }

            $this->em->persist((new DossierEvenement())
                ->setDossier($dossier)
                ->setPatient($patient)
                ->setCentre($centre)
                ->setType(DossierEvenement::TYPE_ACCUEIL)
                ->setTitre($isNew ? 'Ouverture du dossier — admission' : 'Passage à l\'accueil')
                ->setDetails(['motifs' => $data['motifs'] ?? null, 'nouveau' => $isNew])
                ->setAuteur($personnel));

            $signesRaw = is_array($data['signesVitaux'] ?? null) ? $data['signesVitaux'] : [];
            $signes = null;
            if ($signesRaw !== []) {
                $signes = (new SigneVitaux())
                    ->setDossier($dossier)
                    ->setPatient($patient)
                    ->setCentre($centre)
                    ->setSaisiPar($personnel)
                    ->setAgeAns(self::toIntOrNull($signesRaw['ageAns'] ?? null))
                    ->setPoidsKg(self::toFloatOrNull($signesRaw['poidsKg'] ?? null))
                    ->setTailleCm(self::toFloatOrNull($signesRaw['tailleCm'] ?? null))
                    ->setTemperatureC(self::toFloatOrNull($signesRaw['temperatureC'] ?? null))
                    ->setTensionArterialeGauche(isset($signesRaw['tensionArterialeGauche']) ? trim((string) $signesRaw['tensionArterialeGauche']) : null)
                    ->setTensionArterialeDroite(isset($signesRaw['tensionArterialeDroite']) ? trim((string) $signesRaw['tensionArterialeDroite']) : null)
                    ->setPoulsParMin(self::toIntOrNull($signesRaw['poulsParMin'] ?? null))
                    ->setSpo2(self::toIntOrNull($signesRaw['spo2'] ?? null))
                    ->setGlycemieMmol(self::toFloatOrNull($signesRaw['glycemieMmol'] ?? null))
                    ->setNotes(isset($signesRaw['notes']) ? trim((string) $signesRaw['notes']) : null);
                $this->em->persist($signes);

                $this->em->persist((new DossierEvenement())
                    ->setDossier($dossier)
                    ->setPatient($patient)
                    ->setCentre($centre)
                    ->setType(DossierEvenement::TYPE_SIGNE_VITAUX)
                    ->setTitre('Constantes vitales enregistrées')
                    ->setDetails($signes->toSummaryArray())
                    ->setAuteur($personnel));
            }

            $this->em->flush();
            $connection->commit();
        } catch (\Throwable) {
            if ($connection->isTransactionActive()) {
                $connection->rollBack();
            }

            throw new BadRequestHttpException('Impossible d\'enregistrer l\'admission pour le moment.');
        }

        return new JsonResponse([
            'dossier' => self::serializeDossier($dossier, $patient),
            'signesVitaux' => $signes?->toSummaryArray(),
            'ouvert' => $isNew,
        ], Response::HTTP_CREATED);
    }

    /**
     * GET /api/personnel/dossiers/{id}
     */
    #[Route('/api/personnel/dossiers/{id}', name: 'api_personnel_dossier_show', methods: ['GET'], requirements: ['id' => '\d+'])]
    public function showDossier(int $id): JsonResponse
    {
        $personnel = $this->requireActivePersonnel();
        $centre = $personnel->getEtablissement();

        $dossier = $this->dossiers->find($id);
        if (!$dossier instanceof DossierMedical || $dossier->getCentre()?->getId() !== $centre->getId()) {
            throw new NotFoundHttpException('Dossier introuvable dans votre établissement.');
        }

        $evenements = $this->em->getRepository(DossierEvenement::class)->createQueryBuilder('e')
            ->where('e.dossier = :dossier')
            ->setParameter('dossier', $dossier)
            ->orderBy('e.createdAt', 'DESC')
            ->setMaxResults(200)
            ->getQuery()
            ->getResult();

        return new JsonResponse([
            'dossier' => self::serializeDossier($dossier, $dossier->getPatient()),
            'evenements' => array_map(static fn (DossierEvenement $e): array => [
                'id' => $e->getId(),
                'type' => $e->getType(),
                'titre' => $e->getTitre(),
                'details' => $e->getDetails(),
                'auteur' => $e->getAuteur() instanceof User
                    ? trim(($e->getAuteur()->getNom() ?? '').' '.($e->getAuteur()->getPrenom() ?? ''))
                    : null,
                'signatureHash' => $e->getSignatureHash(),
                // Cachet de l'etablissement appose sur l'acte.
                'cachetUrl' => $e->getCachetUrl(),
                'createdAt' => $e->getCreatedAt()->format('c'),
            ], $evenements),
            'cachet' => $centre->getCachetUrl(),
        ]);
    }

    /**
     * Clôture signée du dossier médical.
     *
     * POST /api/personnel/dossiers/{id}/cloture
     *
     * La clôture porte la signature du personnel (empreinte SHA-256) et le
     * cachet de l'établissement : elle est donc non répudiable. L'acte de
     * clôture est lui-même inscrit dans la chronologie du dossier.
     */
    #[Route('/api/personnel/dossiers/{id}/cloture', name: 'api_personnel_dossier_cloture', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function closeDossier(int $id, Request $request): JsonResponse
    {
        $personnel = $this->requireActivePersonnel();
        $centre = $personnel->getEtablissement();

        $dossier = $this->dossiers->find($id);
        if (!$dossier instanceof DossierMedical || $dossier->getCentre()?->getId() !== $centre->getId()) {
            throw new NotFoundHttpException('Dossier introuvable dans votre établissement.');
        }
        if ($dossier->getStatut() === DossierMedical::STATUT_CLOS) {
            throw new BadRequestHttpException('Ce dossier est déjà clôturé.');
        }

        $data = $request->toArray();
        $signature = trim((string) ($data['signature'] ?? ''));
        $motif = trim((string) ($data['motif'] ?? ''));

        if ($signature === '') {
            throw new BadRequestHttpException('La signature du personnel est obligatoire pour clôturer un dossier.');
        }
        if (mb_strlen($signature) > 2_000_000) {
            throw new BadRequestHttpException('La signature fournie est trop volumineuse.');
        }

        $maintenant = new \DateTimeImmutable();
        $empreinte = hash('sha256', implode('|', [
            $signature,
            (string) $dossier->getId(),
            (string) $dossier->getNumero(),
            (string) $personnel->getId(),
            $maintenant->format('c'),
        ]));

        $dossier
            ->setStatut(DossierMedical::STATUT_CLOS)
            ->setClosedAt($maintenant)
            ->setClotureSignatureHash($empreinte)
            ->setClotureCachet($centre->getCachetUrl());

        $this->em->persist((new DossierEvenement())
            ->setDossier($dossier)
            ->setPatient($dossier->getPatient())
            ->setCentre($centre)
            ->setType(DossierEvenement::TYPE_NOTE)
            ->setTitre('Clôture du dossier')
            ->setDetails([
                'motif' => $motif !== '' ? $motif : null,
                'nombreVisites' => $dossier->getNombreVisites(),
                'signatureHash' => $empreinte,
            ])
            ->setAuteur($personnel)
            ->setSignatureHash($empreinte)
            ->setCachetUrl($centre->getCachetUrl()));

        $this->em->flush();

        return new JsonResponse([
            'dossier' => self::serializeDossier($dossier, $dossier->getPatient()),
            'signatureHash' => $empreinte,
            'cachetUrl' => $centre->getCachetUrl(),
        ]);
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private function receptionDashboard(CentreDeSante $centre, \DateTimeImmutable $today): array
    {
        $dossiers = $this->dossiers->searchByCentre($centre, null, 1000);
        $todayCount = count(array_filter(
            $dossiers,
            static fn (array $row): bool => $row['dossier']->getCreatedAt() >= $today
        ));

        return [
            'dossiersOuverts' => count($dossiers),
            'admissionsJour' => $todayCount,
        ];
    }

    private function careDashboard(CentreDeSante $centre, \DateTimeImmutable $today): array
    {
        $soins = $this->em->getRepository(\App\Entity\SoinAdministre::class)->createQueryBuilder('s')
            ->join('s.dossier', 'd')
            ->where('d.centre = :centre')
            ->setParameter('centre', $centre)
            ->getQuery()
            ->getResult();

        $statuts = ['PLANIFIE' => 0, 'EN_COURS' => 0, 'REALISE' => 0, 'ANNULE' => 0];
        $todayCount = 0;
        foreach ($soins as $soin) {
            $statuts[$soin->getStatut()] = ($statuts[$soin->getStatut()] ?? 0) + 1;
            if ($soin->getRealisedAt()?->format('Y-m-d') === $today->format('Y-m-d')) {
                ++$todayCount;
            }
        }

        return ['soins' => $statuts, 'realisesJour' => $todayCount];
    }

    private function pharmacyDashboard(CentreDeSante $centre, \DateTimeImmutable $today): array
    {
        $ordonnances = $this->em->getRepository(\App\Entity\OrdonnancePharmacie::class)->createQueryBuilder('o')
            ->where('o.centre = :centre')
            ->setParameter('centre', $centre)
            ->getQuery()
            ->getResult();

        $statuts = array_fill_keys(\App\Entity\OrdonnancePharmacie::STATUTS, 0);
        foreach ($ordonnances as $o) {
            $statuts[$o->getStatut()] = ($statuts[$o->getStatut()] ?? 0) + 1;
        }

        return ['ordonnances' => $statuts];
    }

    private function notifyManagersOfCentre(CentreDeSante $centre, string $title, string $body, string $link): void
    {
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
            if ($manager instanceof User) {
                $this->notifications->create($manager, 'PERSONNEL', $title, $body, $link);
            }
        }
        $this->em->flush();
    }

    /** @return array<string, mixed> */
    private static function serializeDocument(DocumentValidation $d): array
    {
        return [
            'id' => $d->getId(),
            'typeDocument' => $d->getTypeDocument(),
            'titre' => $d->getTitre(),
            'statut' => $d->getStatut(),
            'motif' => $d->getMotif(),
            'createdAt' => $d->getCreatedAt()->format('c'),
            'validatedAt' => $d->getValidatedAt()?->format('c'),
        ];
    }

    /** @return array<string, mixed> */
    private static function serializeDossier(DossierMedical $d, ?Patient $patient): array
    {
        return [
            'id' => $d->getId(),
            'numero' => $d->getNumero(),
            'statut' => $d->getStatut(),
            'createdAt' => $d->getCreatedAt()->format('c'),
            'closedAt' => $d->getClosedAt()?->format('c'),
            // Suivi du patient : combien de visites, quand.
            'nombreVisites' => $d->getNombreVisites(),
            'derniereVisiteAt' => $d->getDerniereVisiteAt()?->format('c'),
            // Non-répudiation : la clôture porte l'empreinte de la signature
            // et le cachet apposé.
            'clotureSignatureHash' => $d->getClotureSignatureHash(),
            'clotureCachet' => $d->getClotureCachet(),
            'patient' => $patient ? [
                'id' => (string) $patient->getId(),
                'nom' => $patient->getNom(),
                'prenom' => $patient->getPrenom(),
                'telephone' => $patient->getTelephone(),
                'email' => $patient->getEmail(),
            ] : null,
        ];
    }

    private static function toIntOrNull(mixed $value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }

        return is_numeric($value) ? (int) $value : null;
    }

    private static function toFloatOrNull(mixed $value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }

        return is_numeric($value) ? (float) $value : null;
    }
}
