<?php

declare(strict_types=1);

namespace App\Controller;

use App\Service\AdminDashboardService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;

/**
 * Endpoints du tableau de bord administrateur.
 */
class AdminDashboardController extends AbstractController
{
    public function __construct(
        private AdminDashboardService $dashboardService,
    ) {
    }

    /**
     * Endpoint composite : stats + alertes + graphiques en un seul appel.
     *
     * GET /api/admin/dashboard?period=30d
     */
    #[Route('/api/admin/dashboard', name: 'api_admin_dashboard', methods: ['GET'])]
    public function dashboard(Request $request): JsonResponse
    {
        $this->denyAccessUnlessGranted('ROLE_ADMIN');

        $period = $request->query->get('period', '30d');
        if (!in_array($period, ['7d', '30d', '90d'], true)) {
            $period = '30d';
        }

        return new JsonResponse($this->dashboardService->buildDashboard($period));
    }

    /**
     * Journal d'audit Gedmo (si ext_log_entries existe).
     *
     * GET /api/admin/audit-log
     */
    #[Route('/api/admin/audit-log', name: 'api_admin_audit_log', methods: ['GET'])]
    public function auditLog(): JsonResponse
    {
        $this->denyAccessUnlessGranted('ROLE_ADMIN');

        $entries = $this->dashboardService->getAuditLog();

        return new JsonResponse([
            'entries' => $entries,
            'total' => count($entries),
        ]);
    }
}
