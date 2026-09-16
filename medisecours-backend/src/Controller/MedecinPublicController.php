<?php

declare(strict_types=1);

namespace App\Controller;

use App\Entity\Medecin;
use App\Repository\AvisRepository;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\QueryBuilder;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

/**
 * Endpoints publics pour les profils médecins visibles par tous les utilisateurs.
 *
 * Ces endpoints n'exposent que les informations professionnelles publiques :
 * nom, spécialité, disponibilités, note moyenne, avis.
 * Email, téléphone et données personnelles sont exclus.
 */
class MedecinPublicController extends AbstractController
{
    /**
     * Liste publique des médecins validés.
     * Utilisée par la messagerie pour choisir un médecin.
     *
     * GET /api/medecins-publics
     * Paramètres optionnels : ?specialite=Cardiologie&page=1&limit=30
     */
    #[Route('/api/medecins-publics', name: 'api_medecins_publics', methods: ['GET'])]
    public function list(
        Request $request,
        EntityManagerInterface $entityManager,
        AvisRepository $avisRepository
    ): JsonResponse {
        $search = trim((string) $request->query->get('q', ''));
        $specialite = trim((string) $request->query->get('specialite', ''));
        $availableOnly = filter_var($request->query->get('disponible', false), FILTER_VALIDATE_BOOL);
        $page = max(1, (int) $request->query->get('page', 1));
        $limit = min(50, max(1, (int) $request->query->get('limit', 30)));

        $qb = $entityManager->createQueryBuilder()
            ->select('m')
            ->from(Medecin::class, 'm')
            ->where('m.estValide = true')
            ->andWhere('m.actif = true')
            ->andWhere('m.banni = false');

        if ($search !== '') {
            $qb->andWhere(
                'LOWER(m.nom) LIKE :search
                OR LOWER(m.prenom) LIKE :search
                OR LOWER(m.specialite) LIKE :search'
            )->setParameter('search', '%' . mb_strtolower(mb_substr($search, 0, 100)) . '%');
        }

        if ($specialite !== '') {
            $qb->andWhere('LOWER(m.specialite) = :specialite')
                ->setParameter('specialite', mb_strtolower($specialite));
        }

        if ($availableOnly) {
            $matchingDoctors = $qb
                ->orderBy('m.nom', 'ASC')
                ->addOrderBy('m.prenom', 'ASC')
                ->getQuery()
                ->getResult();
            $matchingDoctors = array_values(array_filter(
                $matchingDoctors,
                static fn(Medecin $medecin): bool => $medecin->isDisponibleMaintenant()
            ));
            $total = count($matchingDoctors);
            $totalPages = max(1, (int) ceil($total / $limit));
            $page = min($page, $totalPages);
            $medecins = array_slice($matchingDoctors, ($page - 1) * $limit, $limit);
        } else {
            $total = $this->countDoctors($qb);
            $totalPages = max(1, (int) ceil($total / $limit));
            $page = min($page, $totalPages);
            $medecins = $qb
                ->orderBy('m.nom', 'ASC')
                ->addOrderBy('m.prenom', 'ASC')
                ->setMaxResults($limit)
                ->setFirstResult(($page - 1) * $limit)
                ->getQuery()
                ->getResult();
        }

        $specialites = $entityManager->createQueryBuilder()
            ->select('DISTINCT m.specialite AS specialite')
            ->from(Medecin::class, 'm')
            ->where('m.estValide = true')
            ->andWhere('m.actif = true')
            ->andWhere('m.banni = false')
            ->andWhere('m.specialite IS NOT NULL')
            ->andWhere("m.specialite != ''")
            ->orderBy('m.specialite', 'ASC')
            ->getQuery()
            ->getSingleColumnResult();

        return new JsonResponse([
            'hydra:member'     => array_map(fn(Medecin $m) => $this->serializePublic($m, $avisRepository), $medecins),
            'hydra:totalItems' => $total,
            'page'             => $page,
            'limit'            => $limit,
            'totalPages'       => $totalPages,
            'specialites'      => $specialites,
        ]);
    }

    /**
     * Profil public d'un médecin spécifique avec ses avis.
     * GET /api/medecins-publics/{id}
     */
    #[Route('/api/medecins-publics/{id}', name: 'api_medecin_public_detail', methods: ['GET'])]
    public function show(
        string $id,
        EntityManagerInterface $entityManager,
        AvisRepository $avisRepository
    ): JsonResponse {
        $medecin = $entityManager->getRepository(Medecin::class)->find($id);

        if (!$medecin || !$medecin->isEstValide() || !$medecin->isActif() || $medecin->isBanni()) {
            return new JsonResponse(['error' => 'Médecin introuvable.'], 404);
        }

        $avis = $avisRepository->findByMedecin($medecin);

        $data = $this->serializePublic($medecin, $avisRepository);
        $data['avis'] = array_map(fn($a) => [
            'id'          => $a->getId(),
            'note'        => $a->getNote(),
            'commentaire' => $a->getCommentaire(),
            'createdAt'   => $a->getCreatedAt()->format('c'),
            'patient'     => [
                'prenom' => $a->getPatient()?->getPrenom(),
                'nom'    => $a->getPatient()?->getNom(),
            ],
        ], $avis);

        return new JsonResponse($data);
    }

    /**
     * Sérialise les données publiques d'un médecin (sans email ni téléphone).
     *
     * @return array<string, mixed>
     */
    private function serializePublic(Medecin $medecin, AvisRepository $avisRepository): array
    {
        return [
            'id'                    => (string) $medecin->getId(),
            'nom'                   => $medecin->getNom(),
            'prenom'                => $medecin->getPrenom(),
            'specialite'            => $medecin->getSpecialite(),
            'disponibilites'        => $medecin->getDisponibilites(),
            'disponibilitesTexte'   => $medecin->getDisponibilitesTexte(),
            'disponibilitesLabel'   => $medecin->getDisponibilitesLabel(),
            'isDisponibleMaintenant' => $medecin->isDisponibleMaintenant(),
            'photoProfil'           => $medecin->getPhotoProfil(),
            'noteMoyenne'           => $avisRepository->getNoteMoyenne($medecin),
            'totalAvis'              => $avisRepository->countPublishedByMedecin($medecin),
            'estValide'              => $medecin->isEstValide(),
            'roles'                 => $medecin->getRoles(),
        ];
    }

    private function countDoctors(QueryBuilder $queryBuilder): int
    {
        $countQueryBuilder = clone $queryBuilder;

        return (int) $countQueryBuilder
            ->resetDQLPart('orderBy')
            ->select('COUNT(m.id)')
            ->setMaxResults(null)
            ->setFirstResult(0)
            ->getQuery()
            ->getSingleScalarResult();
    }
}
