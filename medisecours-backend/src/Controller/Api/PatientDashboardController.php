<?php

declare(strict_types=1);

namespace App\Controller\Api;

use App\Entity\Patient;
use App\Service\PatientDashboardService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

/**
 * Statistiques agrégées du patient connecté (graphiques du tableau de bord).
 *
 * GET /api/patient/dashboard?period=7|30|90|365
 */
#[Route('/api/patient', name: 'api_patient_dashboard_')]
class PatientDashboardController extends AbstractController
{
    public function __construct(
        private readonly PatientDashboardService $dashboardService,
    ) {
    }

    #[Route('/dashboard', name: 'show', methods: ['GET'])]
    #[IsGranted('ROLE_PATIENT')]
    public function dashboard(Request $request): JsonResponse
    {
        $user = $this->getUser();
        if (!$user instanceof Patient) {
            throw new AccessDeniedHttpException('Réservé aux patients.');
        }

        $period = (int) $request->query->get('period', 30);
        if (!in_array($period, PatientDashboardService::ALLOWED_PERIODS, true)) {
            $period = 30;
        }

        return new JsonResponse($this->dashboardService->buildDashboard($user, $period));
    }
}
