<?php

declare(strict_types=1);

namespace App\Controller\Admin;

use App\Entity\Avis;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/admin/avis')]
#[IsGranted('ROLE_ADMIN')]
class AdminAvisController extends AbstractController
{
    public function __construct(
        private readonly EntityManagerInterface $entityManager
    ) {}

    #[Route('/stats', name: 'admin_avis_stats', methods: ['GET'])]
    public function getStats(): JsonResponse
    {
        $conn = $this->entityManager->getConnection();

        $total = (int) $conn->fetchOne('SELECT COUNT(*) FROM avis');
        $signales = (int) $conn->fetchOne('SELECT COUNT(*) FROM avis WHERE signale = true');
        $nonSignales = $total - $signales;
        $noteMoyenne = $conn->fetchOne('SELECT ROUND(AVG(note)::numeric, 2) FROM avis');
        $noteMoyenne = $noteMoyenne !== false ? (float) $noteMoyenne : 0.0;

        $distribution = $conn->fetchAllAssociative(
            'SELECT note, COUNT(*) AS count FROM avis GROUP BY note ORDER BY note ASC'
        );

        $recentActivity = $conn->fetchAllAssociative(
            'SELECT a.id, a.note, a.signale, a.created_at, u.prenom AS patient_prenom, u.nom AS patient_nom
             FROM avis a
             LEFT JOIN "user" u ON u.id = a.patient_id
             ORDER BY a.created_at DESC LIMIT 10'
        );

        return $this->json([
            'total' => $total,
            'signales' => $signales,
            'nonSignales' => $nonSignales,
            'noteMoyenne' => $noteMoyenne,
            'tauxSignalement' => $total > 0 ? round(($signales / $total) * 100, 1) : 0.0,
            'distribution' => array_map(static fn (array $r) => [
                'note' => (int) $r['note'],
                'count' => (int) $r['count'],
            ], $distribution),
            'recentActivity' => array_map(static fn (array $r) => [
                'id' => (int) $r['id'],
                'note' => (int) $r['note'],
                'signale' => (bool) $r['signale'],
                'patientPrenom' => $r['patient_prenom'],
                'patientNom' => $r['patient_nom'],
                'createdAt' => (new \DateTimeImmutable($r['created_at']))->format(\DateTimeInterface::ATOM),
            ], $recentActivity),
        ]);
    }

    #[Route('/search', name: 'admin_avis_search', methods: ['GET'])]
    public function search(Request $request): JsonResponse
    {
        $search = $request->query->get('search', '');
        $note = $request->query->get('note');
        $signale = $request->query->get('signale');
        $page = max(1, (int) $request->query->get('page', '1'));
        $limit = min(50, max(10, (int) $request->query->get('limit', '20')));
        $offset = ($page - 1) * $limit;
        $sort = $request->query->get('sort', 'createdAt');
        $order = strtoupper($request->query->get('order', 'DESC'));

        if (!in_array($order, ['ASC', 'DESC'])) {
            $order = 'DESC';
        }

        $allowedSorts = ['createdAt', 'note'];
        if (!in_array($sort, $allowedSorts)) {
            $sort = 'createdAt';
        }

        $qb = $this->entityManager->getRepository(Avis::class)->createQueryBuilder('a')
            ->leftJoin('a.patient', 'p')
            ->leftJoin('a.medecin', 'm');

        if ($search !== '') {
            $qb->andWhere(
                $qb->expr()->orX(
                    'LOWER(p.nom) LIKE LOWER(:search)',
                    'LOWER(p.prenom) LIKE LOWER(:search)',
                    'LOWER(m.nom) LIKE LOWER(:search)',
                    'LOWER(m.prenom) LIKE LOWER(:search)',
                    'LOWER(a.commentaire) LIKE LOWER(:search)'
                )
            )->setParameter('search', '%' . $search . '%');
        }

        if ($note !== null && $note !== '') {
            $qb->andWhere('a.note = :note')
                ->setParameter('note', (int) $note);
        }

        if ($signale !== null && $signale !== '') {
            $signaleBool = filter_var($signale, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            if ($signaleBool !== null) {
                $qb->andWhere('a.signale = :signale')
                    ->setParameter('signale', $signaleBool);
            }
        }

        $countQb = clone $qb;
        $total = (int) $countQb->select('COUNT(a.id)')
            ->resetDQLPart('orderBy')
            ->getQuery()
            ->getSingleScalarResult();

        $qb->select('a', 'p', 'm')
            ->setFirstResult($offset)
            ->setMaxResults($limit);

        $sortField = match ($sort) {
            'note' => 'a.note',
            default => 'a.createdAt',
        };
        $qb->orderBy($sortField, $order);

        $results = $qb->getQuery()->getResult();

        $items = array_map(function (Avis $avis) {
            $patient = $avis->getPatient();
            $medecin = $avis->getMedecin();

            return [
                'id' => $avis->getId(),
                'note' => $avis->getNote(),
                'commentaire' => $avis->getCommentaire(),
                'signale' => $avis->isSignale(),
                'raisonSignalement' => $avis->getRaisonSignalement(),
                'createdAt' => $avis->getCreatedAt()->format(\DateTimeInterface::ATOM),
                'updatedAt' => $avis->getUpdatedAt()?->format(\DateTimeInterface::ATOM),
                'patient' => $patient ? [
                    '@id' => '/api/patients/' . $patient->getId(),
                    'id' => $patient->getId(),
                    'nom' => $patient->getNom(),
                    'prenom' => $patient->getPrenom(),
                    'telephone' => $patient->getTelephone(),
                    'email' => $patient->getEmail(),
                ] : null,
                'medecin' => $medecin ? [
                    '@id' => '/api/medecins/' . $medecin->getId(),
                    'id' => $medecin->getId(),
                    'nom' => $medecin->getNom(),
                    'prenom' => $medecin->getPrenom(),
                    'specialite' => $medecin->getSpecialite(),
                    'estValide' => $medecin->isEstValide(),
                ] : null,
            ];
        }, $results);

        return $this->json([
            'items' => $items,
            'total' => $total,
            'page' => $page,
            'limit' => $limit,
            'pages' => (int) ceil($total / $limit),
        ]);
    }
}
