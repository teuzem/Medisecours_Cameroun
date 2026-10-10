<?php

declare(strict_types=1);

namespace App\Controller\Api;

use App\Entity\Medecin;
use App\Entity\UserPreference;
use App\Repository\UserPreferenceRepository;
use App\Service\MedecinDashboardService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
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
    private const PREFERENCE_LANGUAGES = ['fr', 'en'];
    private const PREFERENCE_WEEK_STARTS = ['monday', 'sunday'];
    private const PREFERENCE_NOTIFICATION_KEYS = ['consultations', 'messages', 'sos', 'avis'];

    public function __construct(
        private readonly MedecinDashboardService $dashboardService,
        private readonly SerializerInterface $serializer,
        private readonly UserPreferenceRepository $preferenceRepository,
        private readonly EntityManagerInterface $em,
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
     * Préférences de personnalisation du médecin connecté.
     *
     * GET /api/me/preferences
     */
    #[Route('/preferences', name: 'preferences', methods: ['GET'])]
    #[IsGranted('ROLE_MEDECIN')]
    public function mesPreferences(): JsonResponse
    {
        $user = $this->getUser();
        if (!$user instanceof Medecin) {
            throw new AccessDeniedHttpException('Réservé aux médecins.');
        }

        return new JsonResponse([
            'preferences' => $this->loadPreferences($user),
        ]);
    }

    /**
     * Mise à jour partielle des préférences du médecin connecté.
     *
     * PATCH /api/me/preferences
     * Body : language?, weekStart?, compact?, animations?, notifications?
     */
    #[Route('/preferences', name: 'preferences_update', methods: ['PATCH'])]
    #[IsGranted('ROLE_MEDECIN')]
    public function modifierPreferences(Request $request): JsonResponse
    {
        $user = $this->getUser();
        if (!$user instanceof Medecin) {
            throw new AccessDeniedHttpException('Réservé aux médecins.');
        }

        $data = $request->toArray();
        $current = $this->loadPreferences($user);
        $updated = $current;

        if (array_key_exists('language', $data)) {
            if (!is_string($data['language']) || !in_array($data['language'], self::PREFERENCE_LANGUAGES, true)) {
                throw new BadRequestHttpException('Langue invalide.');
            }
            $updated['language'] = $data['language'];
        }

        if (array_key_exists('weekStart', $data)) {
            if (!is_string($data['weekStart']) || !in_array($data['weekStart'], self::PREFERENCE_WEEK_STARTS, true)) {
                throw new BadRequestHttpException('Jour de début de semaine invalide.');
            }
            $updated['weekStart'] = $data['weekStart'];
        }

        foreach (['compact', 'animations'] as $boolKey) {
            if (array_key_exists($boolKey, $data)) {
                if (!is_bool($data[$boolKey])) {
                    throw new BadRequestHttpException(sprintf('Le réglage "%s" doit être un booléen.', $boolKey));
                }
                $updated[$boolKey] = $data[$boolKey];
            }
        }

        if (array_key_exists('notifications', $data)) {
            $updated['notifications'] = array_merge(
                $current['notifications'] ?? [],
                $this->sanitizeNotificationPreferences($data['notifications'])
            );
        }

        if ($updated === $current) {
            return new JsonResponse(['preferences' => $current]);
        }

        $preference = $this->preferenceRepository->findOneByUser($user);
        if (!$preference instanceof UserPreference) {
            $preference = new UserPreference();
            $preference->setUser($user);
        }
        $preference
            ->setData($updated)
            ->setUpdatedAt(new \DateTimeImmutable());

        $this->em->persist($preference);
        $this->em->flush();

        return new JsonResponse(['preferences' => $updated]);
    }

    /**
     * Préférences validées du médecin (défauts + valeurs stockées).
     *
     * @return array<string, mixed>
     */
    private function loadPreferences(Medecin $user): array
    {
        $preferences = self::defaultPreferences();

        $preference = $this->preferenceRepository->findOneByUser($user);
        if (!$preference instanceof UserPreference) {
            return $preferences;
        }

        $stored = $preference->getData();
        if (isset($stored['language']) && is_string($stored['language']) && in_array($stored['language'], self::PREFERENCE_LANGUAGES, true)) {
            $preferences['language'] = $stored['language'];
        }
        if (isset($stored['weekStart']) && is_string($stored['weekStart']) && in_array($stored['weekStart'], self::PREFERENCE_WEEK_STARTS, true)) {
            $preferences['weekStart'] = $stored['weekStart'];
        }
        foreach (['compact', 'animations'] as $boolKey) {
            if (isset($stored[$boolKey]) && is_bool($stored[$boolKey])) {
                $preferences[$boolKey] = $stored[$boolKey];
            }
        }
        if (isset($stored['notifications']) && is_array($stored['notifications'])) {
            foreach (self::PREFERENCE_NOTIFICATION_KEYS as $notificationKey) {
                if (isset($stored['notifications'][$notificationKey]) && is_bool($stored['notifications'][$notificationKey])) {
                    $preferences['notifications'][$notificationKey] = $stored['notifications'][$notificationKey];
                }
            }
        }

        return $preferences;
    }

    /**
     * Valide un objet de préférences de notifications (clés partielles autorisées).
     *
     * @return array<string, bool>
     */
    private function sanitizeNotificationPreferences(mixed $value): array
    {
        if (!is_array($value)) {
            throw new BadRequestHttpException('Préférences de notifications invalides.');
        }

        $sanitized = [];
        foreach (self::PREFERENCE_NOTIFICATION_KEYS as $key) {
            if (!array_key_exists($key, $value)) {
                continue;
            }
            if (!is_bool($value[$key])) {
                throw new BadRequestHttpException(sprintf('Le réglage de notification "%s" doit être un booléen.', $key));
            }
            $sanitized[$key] = $value[$key];
        }

        return $sanitized;
    }

    /**
     * Valeurs par défaut (miroir de defaultPrefs() côté frontend médecin).
     *
     * @return array<string, mixed>
     */
    private static function defaultPreferences(): array
    {
        return [
            'language' => 'fr',
            'weekStart' => 'monday',
            'compact' => false,
            'animations' => true,
            'notifications' => [
                'consultations' => true,
                'messages' => true,
                'sos' => true,
                'avis' => true,
            ],
        ];
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
