<?php

declare(strict_types=1);

namespace App\Controller\Api;

use App\Entity\Patient;
use App\Repository\ConsultationRepository;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

final class PatientConsultationStatsController extends AbstractController
{
    #[Route(
        '/api/patient/consultations/stats',
        name: 'api_patient_consultations_stats',
        methods: ['GET'],
        priority: 20,
    )]
    #[IsGranted('ROLE_PATIENT')]
    public function __invoke(ConsultationRepository $consultations): JsonResponse
    {
        $patient = $this->getUser();
        if (!$patient instanceof Patient) {
            return new JsonResponse(
                ['error' => 'Utilisateur patient non authentifie.'],
                JsonResponse::HTTP_UNAUTHORIZED,
            );
        }

        return new JsonResponse($consultations->countByStatusForPatient($patient));
    }
}
