<?php

declare(strict_types=1);

namespace App\Controller;

use App\Entity\ProtocolePremiersGestes;
use App\Repository\ProtocolePremiersGestesRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/admin/protocoles')]
#[IsGranted('ROLE_ADMIN')]
final class AdminProtocolController extends AbstractController
{
    public function __construct(
        private readonly ProtocolePremiersGestesRepository $protocolRepository,
    ) {
    }

    #[Route('', methods: ['GET'])]
    public function list(Request $request, EntityManagerInterface $entityManager): JsonResponse
    {
        $page = max(1, $request->query->getInt('page', 1));
        $itemsPerPage = min(50, max(6, $request->query->getInt('itemsPerPage', 12)));
        $query = mb_strtolower(trim((string) $request->query->get('q', '')));
        $status = strtoupper(trim((string) $request->query->get('status', '')));

        $builder = $entityManager->getRepository(ProtocolePremiersGestes::class)
            ->createQueryBuilder('p')
            ->orderBy('p.titre', 'ASC')
            ->addOrderBy('p.version', 'DESC');

        if ($query !== '') {
            $builder
                ->andWhere('LOWER(p.titre) LIKE :query OR LOWER(p.slug) LIKE :query')
                ->setParameter('query', '%' . $query . '%');
        }

        if (in_array($status, [
            ProtocolePremiersGestes::STATUT_BROUILLON,
            ProtocolePremiersGestes::STATUT_EN_REVUE,
            ProtocolePremiersGestes::STATUT_PUBLIE,
            ProtocolePremiersGestes::STATUT_RETIRE,
        ], true)) {
            $builder
                ->andWhere('p.statut = :status')
                ->setParameter('status', $status);
        }

        $countBuilder = clone $builder;
        $total = (int) $countBuilder
            ->resetDQLPart('orderBy')
            ->select('COUNT(p.id)')
            ->getQuery()
            ->getSingleScalarResult();
        $totalPages = max(1, (int) ceil($total / $itemsPerPage));
        $page = min($page, $totalPages);
        $items = $builder
            ->setFirstResult(($page - 1) * $itemsPerPage)
            ->setMaxResults($itemsPerPage)
            ->getQuery()
            ->getResult();

        $statusRows = $entityManager->getRepository(ProtocolePremiersGestes::class)
            ->createQueryBuilder('counts')
            ->select('counts.statut AS status, COUNT(counts.id) AS total')
            ->groupBy('counts.statut')
            ->getQuery()
            ->getArrayResult();
        $counts = ['total' => 0, 'visible' => 0, 'draft' => 0, 'retired' => 0];
        foreach ($statusRows as $row) {
            $value = (int) $row['total'];
            $counts['total'] += $value;
            if ($row['status'] === ProtocolePremiersGestes::STATUT_RETIRE) {
                $counts['retired'] += $value;
            } else {
                $counts['visible'] += $value;
            }
            if (in_array($row['status'], [
                ProtocolePremiersGestes::STATUT_BROUILLON,
                ProtocolePremiersGestes::STATUT_EN_REVUE,
            ], true)) {
                $counts['draft'] += $value;
            }
        }

        return $this->json([
            'items' => $items,
            'pagination' => [
                'page' => $page,
                'itemsPerPage' => $itemsPerPage,
                'total' => $total,
                'totalPages' => $totalPages,
            ],
            'counts' => $counts,
        ], Response::HTTP_OK, [], ['groups' => ['protocole:read', 'protocole:admin']]);
    }

    #[Route('/versions/by-slug/{slug}', methods: ['GET'])]
    public function versions(string $slug): JsonResponse
    {
        return $this->json(
            $this->protocolRepository->findVersionsBySlug($slug),
            Response::HTTP_OK,
            [],
            ['groups' => ['protocole:read', 'protocole:admin']]
        );
    }

    #[Route('/observabilite', methods: ['GET'])]
    public function observability(EntityManagerInterface $entityManager): JsonResponse
    {
        $consultations = $entityManager->createQuery(
            'SELECT c.slug AS slug, c.version AS version, COUNT(c.id) AS vues, MAX(c.consultedAt) AS dernier'
            . ' FROM App\\Entity\\ProtocoleConsultation c GROUP BY c.slug, c.version ORDER BY vues DESC'
        )->setMaxResults(50)->getResult();

        $searchStats = $entityManager->createQuery(
            'SELECT s.statDate AS jour, s.totalCount AS total, s.withResultCount AS avecResultat, s.withoutResultCount AS sansResultat'
            . ' FROM App\\Entity\\ProtocoleRechercheStat s ORDER BY s.statDate DESC'
        )->setMaxResults(30)->getResult();

        return $this->json([
            'consultations' => $consultations,
            'recherches' => $searchStats,
        ]);
    }

    #[Route('/{id}/versions', methods: ['POST'])]
    public function createNextVersion(
        ProtocolePremiersGestes $protocole,
        EntityManagerInterface $entityManager
    ): JsonResponse {
        $next = $protocole->duplicateAsNewVersion();
        $entityManager->persist($next);
        $entityManager->flush();

        return $this->json(
            $next,
            Response::HTTP_CREATED,
            [],
            ['groups' => ['protocole:read', 'protocole:admin']]
        );
    }

    #[Route('/{id}/statut', methods: ['PATCH'])]
    public function updateStatus(
        ProtocolePremiersGestes $protocole,
        Request $request,
        EntityManagerInterface $entityManager
    ): JsonResponse {
        $payload = json_decode($request->getContent(), true);
        if (!is_array($payload)) {
            return $this->json(['error' => 'Payload JSON invalide.'], Response::HTTP_BAD_REQUEST);
        }

        $status = strtoupper(trim((string) ($payload['statut'] ?? '')));
        if (!in_array($status, [
            ProtocolePremiersGestes::STATUT_BROUILLON,
            ProtocolePremiersGestes::STATUT_EN_REVUE,
            ProtocolePremiersGestes::STATUT_PUBLIE,
            ProtocolePremiersGestes::STATUT_RETIRE,
        ], true)) {
            return $this->json(['error' => 'Statut invalide.'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        if (array_key_exists('sourceClinique', $payload)) {
            $source = trim((string) $payload['sourceClinique']);
            $protocole->setSourceClinique($source !== '' ? $source : null);
        }

        $protocole->setStatut($status);
        $entityManager->flush();

        return $this->json(
            $protocole,
            Response::HTTP_OK,
            [],
            ['groups' => ['protocole:read', 'protocole:admin']]
        );
    }
}
