<?php

declare(strict_types=1);

namespace App\Controller\Admin;

use App\Entity\SignalementMedecin;
use App\Repository\SignalementMedecinRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/admin/signalements')]
#[IsGranted('ROLE_ADMIN')]
final class AdminSignalementController extends AbstractController
{
    #[Route('/stats', name: 'api_admin_signalements_stats', methods: ['GET'])]
    public function stats(SignalementMedecinRepository $signalements): JsonResponse
    {
        $repository = $signalements->createQueryBuilder('signalement');
        $rows = $repository
            ->select('signalement.statut AS statut, COUNT(signalement.id) AS total')
            ->groupBy('signalement.statut')
            ->getQuery()
            ->getArrayResult();

        $counts = array_fill_keys(SignalementMedecin::STATUTS, 0);
        foreach ($rows as $row) {
            $counts[$row['statut']] = (int) $row['total'];
        }

        return $this->json([
            'total' => array_sum($counts),
            'nouveaux' => $counts[SignalementMedecin::STATUT_NOUVEAU],
            'enCours' => $counts[SignalementMedecin::STATUT_EN_COURS],
            'traites' => $counts[SignalementMedecin::STATUT_TRAITE],
            'rejetes' => $counts[SignalementMedecin::STATUT_REJETE],
        ]);
    }

    #[Route('', name: 'api_admin_signalements_list', methods: ['GET'])]
    public function list(Request $request, SignalementMedecinRepository $signalements): JsonResponse
    {
        $search = trim((string) $request->query->get('search', ''));
        $statut = strtoupper(trim((string) $request->query->get('statut', '')));
        $page = max(1, (int) $request->query->get('page', 1));
        $limit = min(50, max(10, (int) $request->query->get('limit', 20)));

        $qb = $signalements->createQueryBuilder('signalement')
            ->leftJoin('signalement.patient', 'patient')
            ->leftJoin('signalement.medecin', 'medecin');

        if ($search !== '') {
            $qb->andWhere(
                'LOWER(patient.nom) LIKE :search
                OR LOWER(patient.prenom) LIKE :search
                OR LOWER(patient.email) LIKE :search
                OR LOWER(medecin.nom) LIKE :search
                OR LOWER(medecin.prenom) LIKE :search
                OR LOWER(medecin.email) LIKE :search
                OR LOWER(signalement.description) LIKE :search'
            )->setParameter('search', '%' . mb_strtolower($search) . '%');
        }

        if (in_array($statut, SignalementMedecin::STATUTS, true)) {
            $qb->andWhere('signalement.statut = :statut')
                ->setParameter('statut', $statut);
        }

        $countQuery = clone $qb;
        $total = (int) $countQuery
            ->select('COUNT(signalement.id)')
            ->getQuery()
            ->getSingleScalarResult();

        $items = $qb
            ->select('signalement', 'patient', 'medecin')
            ->orderBy('signalement.createdAt', 'DESC')
            ->setFirstResult(($page - 1) * $limit)
            ->setMaxResults($limit)
            ->getQuery()
            ->getResult();

        return $this->json([
            'items' => array_map([$this, 'serialize'], $items),
            'total' => $total,
            'page' => $page,
            'limit' => $limit,
            'pages' => (int) ceil($total / $limit),
        ]);
    }

    #[Route('/{id}', name: 'api_admin_signalements_update', methods: ['PATCH'])]
    public function update(
        SignalementMedecin $signalement,
        Request $request,
        EntityManagerInterface $entityManager,
    ): JsonResponse {
        $payload = json_decode((string) $request->getContent(), true);
        if (!is_array($payload)) {
            return $this->json(['error' => 'Contenu invalide.'], 400);
        }

        $statut = strtoupper(trim((string) ($payload['statut'] ?? $signalement->getStatut())));
        if (!in_array($statut, SignalementMedecin::STATUTS, true)) {
            return $this->json(['error' => 'Statut invalide.'], 422);
        }

        $noteAdmin = array_key_exists('noteAdmin', $payload)
            ? trim((string) $payload['noteAdmin'])
            : $signalement->getNoteAdmin();
        if ($noteAdmin !== null && mb_strlen($noteAdmin) > 2000) {
            return $this->json(['error' => 'La note administrative est trop longue.'], 422);
        }

        $now = new \DateTimeImmutable();
        $signalement
            ->setStatut($statut)
            ->setNoteAdmin($noteAdmin === '' ? null : $noteAdmin)
            ->setUpdatedAt($now)
            ->setTraiteAt(
                in_array($statut, [
                    SignalementMedecin::STATUT_TRAITE,
                    SignalementMedecin::STATUT_REJETE,
                ], true) ? $now : null
            );

        $entityManager->flush();

        return $this->json($this->serialize($signalement));
    }

    #[Route('/{id}', name: 'api_admin_signalements_delete', methods: ['DELETE'])]
    public function delete(
        SignalementMedecin $signalement,
        EntityManagerInterface $entityManager,
    ): JsonResponse {
        $entityManager->remove($signalement);
        $entityManager->flush();

        return new JsonResponse(null, 204);
    }

    private function serialize(SignalementMedecin $signalement): array
    {
        $patient = $signalement->getPatient();
        $medecin = $signalement->getMedecin();

        return [
            'id' => $signalement->getId(),
            'motif' => $signalement->getMotif(),
            'description' => $signalement->getDescription(),
            'statut' => $signalement->getStatut(),
            'noteAdmin' => $signalement->getNoteAdmin(),
            'createdAt' => $signalement->getCreatedAt()->format(\DateTimeInterface::ATOM),
            'updatedAt' => $signalement->getUpdatedAt()->format(\DateTimeInterface::ATOM),
            'traiteAt' => $signalement->getTraiteAt()?->format(\DateTimeInterface::ATOM),
            'patient' => $patient ? [
                'id' => (string) $patient->getId(),
                'nom' => $patient->getNom(),
                'prenom' => $patient->getPrenom(),
                'email' => $patient->getEmail(),
                'telephone' => $patient->getTelephone(),
            ] : null,
            'medecin' => $medecin ? [
                'id' => (string) $medecin->getId(),
                'nom' => $medecin->getNom(),
                'prenom' => $medecin->getPrenom(),
                'email' => $medecin->getEmail(),
                'specialite' => $medecin->getSpecialite(),
                'numeroOrdre' => $medecin->getNumeroOrdre(),
                'estValide' => $medecin->isEstValide(),
            ] : null,
        ];
    }
}
