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

    // ── Avis des établissements (modération centrale) ─────────────────────

    #[Route('/etablissements/stats', name: 'admin_avis_etablissements_stats', methods: ['GET'])]
    public function getEtablissementsStats(): JsonResponse
    {
        $conn = $this->entityManager->getConnection();

        $total = (int) $conn->fetchOne('SELECT COUNT(*) FROM avis_etablissement');
        $signales = (int) $conn->fetchOne('SELECT COUNT(*) FROM avis_etablissement WHERE signale = true');
        $publies = (int) $conn->fetchOne("SELECT COUNT(*) FROM avis_etablissement WHERE statut = 'PUBLIE'");
        $enAttente = (int) $conn->fetchOne("SELECT COUNT(*) FROM avis_etablissement WHERE statut = 'EN_ATTENTE'");
        $noteMoyenne = $conn->fetchOne('SELECT ROUND(AVG(note)::numeric, 2) FROM avis_etablissement');
        $noteMoyenne = $noteMoyenne !== false ? (float) $noteMoyenne : 0.0;

        $distribution = $conn->fetchAllAssociative(
            'SELECT note, COUNT(*) AS count FROM avis_etablissement GROUP BY note ORDER BY note ASC'
        );

        return $this->json([
            'total' => $total,
            'signales' => $signales,
            'publies' => $publies,
            'enAttente' => $enAttente,
            'noteMoyenne' => $noteMoyenne,
            'tauxSignalement' => $total > 0 ? round(($signales / $total) * 100, 1) : 0.0,
            'distribution' => array_map(static fn (array $r) => [
                'note' => (int) $r['note'],
                'count' => (int) $r['count'],
            ], $distribution),
        ]);
    }

    #[Route('/etablissements/search', name: 'admin_avis_etablissements_search', methods: ['GET'])]
    public function searchEtablissements(Request $request): JsonResponse
    {
        $conn = $this->entityManager->getConnection();
        $search = trim((string) $request->query->get('search', ''));
        $statut = strtoupper(trim((string) $request->query->get('statut', '')));
        $signale = $request->query->get('signale');
        $page = max(1, (int) $request->query->get('page', '1'));
        $limit = min(50, max(10, (int) $request->query->get('limit', '20')));
        $offset = ($page - 1) * $limit;

        $conditions = [];
        $params = [];
        if ($search !== '') {
            $conditions[] = '(a.commentaire ILIKE :q OR c.nom LIKE :q OR u.prenom LIKE :q OR u.nom LIKE :q)';
            $params['q'] = '%' . $search . '%';
        }
        if (in_array($statut, ['PUBLIE', 'REJETE', 'EN_ATTENTE'], true)) {
            $conditions[] = 'a.statut = :statut';
            $params['statut'] = $statut;
        }
        if ($signale === '1' || $signale === '0') {
            $conditions[] = 'a.signale = :signale';
            $params['signale'] = $signale === '1';
        }
        $where = $conditions !== [] ? 'WHERE ' . implode(' AND ', $conditions) : '';

        $total = (int) $conn->fetchOne(
            "SELECT COUNT(*) FROM avis_etablissement a LEFT JOIN centre_de_sante c ON c.id = a.etablissement_id LEFT JOIN \"user\" u ON u.id = a.user_id {$where}",
            $params
        );
        $rows = $conn->fetchAllAssociative(
            "SELECT a.id, a.note, a.commentaire, a.statut, a.signale, a.raison_signalement, a.created_at,
                    c.id AS centre_id, c.nom AS centre_nom, u.prenom AS auteur_prenom, u.nom AS auteur_nom
             FROM avis_etablissement a
             LEFT JOIN centre_de_sante c ON c.id = a.etablissement_id
             LEFT JOIN \"user\" u ON u.id = a.user_id
             {$where} ORDER BY a.created_at DESC LIMIT {$limit} OFFSET {$offset}",
            $params
        );

        return $this->json([
            'items' => array_map(static fn (array $r) => [
                'id' => (int) $r['id'],
                'note' => (int) $r['note'],
                'commentaire' => $r['commentaire'],
                'statut' => $r['statut'],
                'signale' => (bool) $r['signale'],
                'raisonSignalement' => $r['raison_signalement'],
                'createdAt' => (new \DateTimeImmutable($r['created_at']))->format(\DateTimeInterface::ATOM),
                'centre' => $r['centre_id'] !== null ? ['id' => (int) $r['centre_id'], 'nom' => $r['centre_nom']] : null,
                'auteurNom' => trim((string) ($r['auteur_prenom'] ?? '') . ' ' . ($r['auteur_nom'] ?? '')) ?: null,
            ], $rows),
            'total' => $total,
            'page' => $page,
            'limit' => $limit,
            'pages' => (int) ceil($total / $limit),
        ]);
    }
}
