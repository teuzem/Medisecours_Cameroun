<?php

declare(strict_types=1);

namespace App\Controller;

use App\Entity\CentreDeSante;
use App\Entity\DossierEvenement;
use App\Entity\DocumentValidation;
use App\Entity\EtablissementEquipe;
use App\Entity\PersonnelSante;
use App\Repository\CentreDeSanteRepository;
use App\Repository\EtablissementEquipeRepository;
use App\Service\NotificationService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\Routing\Annotation\Route;

/**
 * Validation du personnel par les managers de l'établissement.
 *
 *  - GET  /api/etablissement/personnel?centre=            : candidats + pièces,
 *  - GET  /api/etablissement/personnel/{id}/documents     : pièces (data-URI),
 *  - POST /api/etablissement/personnel/{id}/decision      : VALIDE / REJETE.
 *
 * La validation VALIDE active l'adhésion équipe (ACTIF) et débloque
 * l'accès opérationnel (double verrou : statutValidation + membership).
 */
class PersonnelValidationController extends AbstractController
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly EtablissementEquipeRepository $equipe,
        private readonly CentreDeSanteRepository $centres,
        private readonly NotificationService $notifications,
    ) {
    }

    /**
     * GET /api/etablissement/personnel?centre=
     */
    #[Route('/api/etablissement/personnel', name: 'api_etablissement_personnel', methods: ['GET'])]
    public function list(Request $request): JsonResponse
    {
        $user = $this->requireUser();
        $centre = $this->resolveManagedCentre($user, $request);
        $this->assertCanManage($user, $centre);

        $personnels = $this->em->getRepository(PersonnelSante::class)->createQueryBuilder('p')
            ->where('p.etablissement = :centre')
            ->setParameter('centre', $centre)
            ->orderBy('p.createdAt', 'DESC')
            ->setMaxResults(200)
            ->getQuery()
            ->getResult();

        $comptes = ['EN_ATTENTE' => 0, 'VALIDE' => 0, 'REJETE' => 0];
        $items = array_map(function (PersonnelSante $p) use (&$comptes): array {
            $comptes[$p->getStatutValidation()] = ($comptes[$p->getStatutValidation()] ?? 0) + 1;

            return self::serializePersonnel($p, $this->em->getRepository(DocumentValidation::class));
        }, $personnels);

        return new JsonResponse([
            'centreId' => $centre->getId(),
            'comptes' => $comptes,
            'personnel' => $items,
        ]);
    }

    /**
     * GET /api/etablissement/personnel/{id}/documents
     */
    #[Route('/api/etablissement/personnel/{id}/documents', name: 'api_etablissement_personnel_documents', methods: ['GET'], requirements: ['id' => '\d+'])]
    public function documents(int $id, Request $request): JsonResponse
    {
        $user = $this->requireUser();
        $centre = $this->resolveManagedCentre($user, $request);
        $this->assertCanManage($user, $centre);

        $personnel = $this->em->getRepository(PersonnelSante::class)->find($id);
        if (!$personnel instanceof PersonnelSante || $personnel->getEtablissement()?->getId() !== $centre->getId()) {
            throw new NotFoundHttpException('Membre du personnel introuvable dans votre établissement.');
        }

        $documents = $this->em->getRepository(DocumentValidation::class)
            ->findBy(['personnel' => $personnel], ['createdAt' => 'DESC']);

        return new JsonResponse([
            'documents' => array_map(static function (DocumentValidation $d): array {
                return array_merge(self::serializeDocument($d), ['fichierData' => $d->getFichierData()]);
            }, $documents),
        ]);
    }

    /**
     * POST /api/etablissement/personnel/{id}/decision
     * body: { decision: "VALIDE"|"REJETE", motif? }
     */
    #[Route('/api/etablissement/personnel/{id}/decision', name: 'api_etablissement_personnel_decision', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function decision(int $id, Request $request): JsonResponse
    {
        $user = $this->requireUser();
        $centre = $this->resolveManagedCentre($user, $request);
        $this->assertCanManage($user, $centre);

        $personnel = $this->em->getRepository(PersonnelSante::class)->find($id);
        if (!$personnel instanceof PersonnelSante || $personnel->getEtablissement()?->getId() !== $centre->getId()) {
            throw new NotFoundHttpException('Membre du personnel introuvable dans votre établissement.');
        }

        $data = $request->toArray();
        $decision = strtoupper(trim((string) ($data['decision'] ?? '')));
        if (!in_array($decision, [PersonnelSante::VALIDATION_VALIDE, PersonnelSante::VALIDATION_REJETE], true)) {
            throw new BadRequestHttpException('Décision invalide (VALIDE ou REJETE).');
        }

        $documents = $this->em->getRepository(DocumentValidation::class)
            ->findBy(['personnel' => $personnel]);
        if ($documents === []) {
            throw new BadRequestHttpException('Ce membre n\'a déposé aucune pièce à valider.');
        }
        if ($decision === PersonnelSante::VALIDATION_VALIDE) {
            foreach ($documents as $document) {
                if ($document->getStatut() === DocumentValidation::STATUT_EN_ATTENTE) {
                    $document
                        ->setStatut(DocumentValidation::STATUT_VALIDE)
                        ->setValidatedBy($user)
                        ->setValidatedAt(new \DateTimeImmutable());
                }
            }
        }

        $motif = isset($data['motif']) ? trim((string) $data['motif']) : null;
        if ($decision === PersonnelSante::VALIDATION_REJETE && $motif === null) {
            throw new BadRequestHttpException('Un motif est obligatoire pour un rejet.');
        }

        $personnel
            ->setStatutValidation($decision)
            ->setValidationMotif($motif)
            ->setValidatedBy($user)
            ->setValidatedAt(new \DateTimeImmutable());

        $membership = $this->equipe->createQueryBuilder('e')
            ->where('e.user = :user')
            ->setParameter('user', $personnel)
            ->andWhere('e.etablissement = :centre')
            ->setParameter('centre', $centre)
            ->andWhere('e.role = :role')
            ->setParameter('role', PersonnelSante::ROLE_EQUIPE_MAP[$personnel->getTypePersonnel()])
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();

        if ($decision === PersonnelSante::VALIDATION_VALIDE) {
            if (!$membership instanceof EtablissementEquipe) {
                $membership = (new EtablissementEquipe())
                    ->setEtablissement($centre)
                    ->setUser($personnel)
                    ->setRole(PersonnelSante::ROLE_EQUIPE_MAP[$personnel->getTypePersonnel()])
                    ->setInvitePar($user);
                $this->em->persist($membership);
            }
            $membership
                ->setStatut('ACTIF')
                ->setUpdatedAt(new \DateTimeImmutable());
        } elseif ($membership instanceof EtablissementEquipe) {
            $membership
                ->setStatut('REVOQUE')
                ->setUpdatedAt(new \DateTimeImmutable());
        }

        $this->notifications->create(
            $personnel,
            'PERSONNEL',
            $decision === PersonnelSante::VALIDATION_VALIDE ? 'Compte validé' : 'Compte rejeté',
            $decision === PersonnelSante::VALIDATION_VALIDE
                ? 'Votre compte est validé. Vous pouvez accéder à vos outils de travail.'
                : 'Votre demande a été rejetée. Motif : '.$motif,
            '/personnel'
        );
        $this->em->flush();

        return new JsonResponse([
            'personnel' => self::serializePersonnel($personnel, $this->em->getRepository(DocumentValidation::class)),
        ]);
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private function requireUser(): \App\Entity\User
    {
        $user = $this->getUser();
        if (!$user instanceof \App\Entity\User) {
            throw new AccessDeniedHttpException('Authentification requise.');
        }

        return $user;
    }

    private function resolveManagedCentre(\App\Entity\User $user, Request $request): CentreDeSante
    {
        if (in_array('ROLE_ADMIN', $user->getRoles(), true)) {
            $centreId = $request->query->get('centre');
            if ($centreId) {
                $centre = $this->centres->find((int) $centreId);
                if ($centre) {
                    return $centre;
                }
            }
        }

        $centre = $this->equipe->findManagedCentre($user);
        if (!$centre) {
            throw new AccessDeniedHttpException(
                'Vous devez avoir un rôle managérial (DIRECTEUR / GESTIONNAIRE) sur un établissement.'
            );
        }

        return $centre;
    }

    private function assertCanManage(\App\Entity\User $user, CentreDeSante $centre): void
    {
        if (in_array('ROLE_ADMIN', $user->getRoles(), true) || $this->equipe->canManage($user, $centre)) {
            return;
        }

        throw new AccessDeniedHttpException('Accès réservé aux managers de cet établissement.');
    }

    /** @return array<string, mixed> */
    private static function serializePersonnel(PersonnelSante $p, object $documentRepository): array
    {
        $documents = $documentRepository->findBy(['personnel' => $p], ['createdAt' => 'DESC']);

        return [
            'id' => $p->getId(),
            'nom' => $p->getNom(),
            'prenom' => $p->getPrenom(),
            'email' => $p->getEmail(),
            'telephone' => $p->getTelephone(),
            'typePersonnel' => $p->getTypePersonnel(),
            'fonction' => $p->getFonction(),
            'numeroOrdre' => $p->getNumeroOrdre(),
            'statutValidation' => $p->getStatutValidation(),
            'validationMotif' => $p->getValidationMotif(),
            'validatedAt' => $p->getValidatedAt()?->format('c'),
            'createdAt' => $p->getCreatedAt()->format('c'),
            'documents' => array_map(
                static fn (DocumentValidation $d): array => self::serializeDocument($d),
                $documents
            ),
        ];
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
}
