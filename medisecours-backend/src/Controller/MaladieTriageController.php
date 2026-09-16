<?php

declare(strict_types=1);

namespace App\Controller;

use App\Service\ContentLocalizer;
use App\Service\SymptomTriageService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\RateLimiter\RateLimiterFactory;

final class MaladieTriageController extends AbstractController
{
    public function __construct(
        private readonly SymptomTriageService $triageService,
        private readonly ContentLocalizer $localizer,
        #[Autowire(service: 'limiter.api_public')] private readonly RateLimiterFactory $publicApiLimiter,
    ) {
    }

    #[Route('/api/maladies/triage', name: 'api_maladies_triage', methods: ['POST'])]
    #[Route('/api/orientation/symptomes', name: 'api_patient_symptom_orientation', methods: ['POST'])]
    public function __invoke(Request $request): JsonResponse
    {
        $payload = json_decode($request->getContent(), true);
        if (!is_array($payload)) {
            $msg = $this->localizer->isEnglish() ? 'Invalid JSON payload.' : 'Payload JSON invalide.';
            return $this->json(['message' => $msg], 400);
        }

        $limiter = $this->publicApiLimiter->create((string) $request->getClientIp());
        if (!$limiter->consume()->isAccepted()) {
            $msg = $this->localizer->isEnglish()
                ? 'Too many requests. Please try again in a few moments.'
                : 'Trop de demandes. Réessayez dans quelques instants.';
            return $this->json(['message' => $msg], 429);
        }

        $symptoms = $payload['symptomes'] ?? [];
        $freeText = (string) ($payload['texteLibre'] ?? $payload['query'] ?? '');
        $contexts = $payload['contextes'] ?? [];
        if (!is_array($symptoms) || count($symptoms) > 12 || !is_array($contexts) || count($contexts) > 6 || mb_strlen($freeText) > 500) {
            $msg = $this->localizer->isEnglish()
                ? 'The entered information exceeds the allowed limits.'
                : 'Les informations saisies dépassent les limites autorisées.';
            return $this->json(['message' => $msg], 422);
        }

        return $this->json([
            ...$this->triageService->triage($payload),
            'decisionSupport' => [
                'type' => 'orientation_et_premiers_secours',
                'diagnostic' => false,
                'prescription' => false,
                'homeTreatmentPlan' => false,
                'clinicalReviewRequired' => true,
            ],
        ]);
    }
}
