<?php

declare(strict_types=1);

namespace App\Controller\Api;

use App\Entity\Medecin;
use App\Service\MedecinDashboardService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;
use Symfony\Component\Serializer\SerializerInterface;

/**
 * Endpoint agrégé du tableau de bord médecin.
 *
 * Renvoie en UN seul appel tous les indicateurs du médecin connecté,
 * calculés via des requêtes d'agrégat SQL (cf. MedecinDashboardService)
 * et scopés sur le médecin. La sérialisation des sous-ensembles (widgets)
 * réutilise les groups de lecture existants pour rester cohérent côté frontend.
 */
#[Route('/api/me', name: 'api_me_')]
class MedecinDashboardController extends AbstractController
{
    public function __construct(
        private readonly MedecinDashboardService $dashboardService,
        private readonly SerializerInterface $serializer,
    ) {
    }

    #[Route('/dashboard', name: 'dashboard', methods: ['GET'], priority: 10)]
    #[IsGranted('ROLE_MEDECIN')]
    public function dashboard(): JsonResponse
    {
        try {
            $user = $this->getUser();
            if (!$user instanceof Medecin) {
                throw new AccessDeniedHttpException('Réservé aux médecins.');
            }

            $data = $this->dashboardService->buildDashboard($user);

            // Les compteurs sont déjà des scalaires. Les widgets listes
            // (consultations / patients) sont sérialisés via les groups de lecture.
            $consultationCtx = ['groups' => ['consultation:read', 'user:search']];
            $patientCtx = ['groups' => ['user:search']];

            $data['activeConsultations'] = $this->serialize($data['activeConsultations'], $consultationCtx);
            $data['riskConsultations'] = $this->serialize($data['riskConsultations'], $consultationCtx);
            $data['upcomingAppointments'] = $this->serialize($data['upcomingAppointments'], $consultationCtx);
            $data['recentPatients'] = $this->serialize($data['recentPatients'], $patientCtx);

            return new JsonResponse($data);
        } catch (AccessDeniedHttpException $e) {
            throw $e;
        } catch (\Throwable $e) {
            return new JsonResponse([
                'error' => 'Erreur interne du tableau de bord.',
                'detail' => $this->getParameter('kernel.debug') ? $e->getMessage() : null,
            ], JsonResponse::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Sérialise une valeur et la renvoie sous forme de tableau (array|null).
     */
    private function serialize(mixed $value, array $context): mixed
    {
        return json_decode(
            $this->serializer->serialize($value, 'json', $context),
            true
        );
    }
}
