<?php

declare(strict_types=1);

namespace App\Controller\Api;

use App\Entity\Medecin;
use App\Entity\Patient;
use App\Entity\User;
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
 * Endpoints agrégés du tableau de bord (/api/me).
 *
 * - /dashboard : indicateurs agrégés du médecin connecté (ROLE_MEDECIN).
 * - /preferences : préférences de personnalisation (médecin ou patient).
 */
#[Route('/api/me', name: 'api_me_')]
class MedecinDashboardController extends AbstractController
{
    private const PREFERENCE_LANGUAGES = ['fr', 'en'];
    private const PREFERENCE_WEEK_STARTS = ['monday', 'sunday'];
    private const PREFERENCE_NOTIFICATION_KEYS = ['consultations', 'messages', 'sos', 'avis', 'etablissements'];
    private const PREFERENCE_NOTIFICATION_KEYS_MEDECIN = ['consultations', 'messages', 'sos', 'avis'];

    public function __construct(
        private readonly MedecinDashboardService $dashboardService,
        private readonly SerializerInterface $serializer,
        private readonly UserPreferenceRepository $preferenceRepository,
        private readonly EntityManagerInterface $em,
    ) {
    }

    #[Route('/dashboard', name: 'dashboard', methods: ['GET'], priority: 10)]
    #[IsGranted('ROLE_MEDECIN')]
    public function dashboard(Request $request): JsonResponse
    {
        try {
            $user = $this->getUser();
            if (!$user instanceof Medecin) {
                throw new AccessDeniedHttpException('Réservé aux médecins.');
            }

            $period = (int) $request->query->get('period', 30);
            if (!in_array($period, MedecinDashboardService::ALLOWED_PERIODS, true)) {
                $period = 30;
            }

            $data = $this->dashboardService->buildDashboard($user, $period);

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
     * Préférences de personnalisation de l'utilisateur connecté.
     *
     * GET /api/me/preferences
     */
    #[Route('/preferences', name: 'preferences', methods: ['GET'])]
    public function mesPreferences(): JsonResponse
    {
        $user = $this->requirePreferenceUser();

        return new JsonResponse([
            'preferences' => $this->loadPreferences($user),
        ]);
    }

    /**
     * Mise à jour partielle des préférences de l'utilisateur connecté.
     *
     * PATCH /api/me/preferences
     * Body : language?, weekStart?, compact?, animations?, notifications?
     */
    #[Route('/preferences', name: 'preferences_update', methods: ['PATCH'])]
    public function modifierPreferences(Request $request): JsonResponse
    {
        $user = $this->requirePreferenceUser();

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
                $this->sanitizeNotificationPreferences($data['notifications'], $user)
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

    private function requirePreferenceUser(): User
    {
        $user = $this->getUser();
        if (!$user instanceof Medecin && !$user instanceof Patient) {
            throw new AccessDeniedHttpException('Réservé aux médecins et patients connectés.');
        }

        return $user;
    }

    /**
     * Préférences validées (défauts + valeurs stockées).
     *
     * @return array<string, mixed>
     */
    private function loadPreferences(User $user): array
    {
        $preferences = self::defaultPreferences($user);

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
     * Valide un objet de préférences de notifications selon le rôle de l'utilisateur.
     *
     * @return array<string, bool>
     */
    private function sanitizeNotificationPreferences(mixed $value, User $user): array
    {
        if (!is_array($value)) {
            throw new BadRequestHttpException('Préférences de notifications invalides.');
        }

        $allowedKeys = $user instanceof Patient
            ? self::PREFERENCE_NOTIFICATION_KEYS
            : self::PREFERENCE_NOTIFICATION_KEYS_MEDECIN;

        $sanitized = [];
        foreach ($allowedKeys as $key) {
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
     * Valeurs par défaut adaptées au rôle.
     *
     * @return array<string, mixed>
     */
    private static function defaultPreferences(User $user): array
    {
        $notifications = $user instanceof Patient
            ? [
                'consultations' => true,
                'messages' => true,
                'sos' => true,
                'avis' => true,
                'etablissements' => true,
            ]
            : [
                'consultations' => true,
                'messages' => true,
                'sos' => true,
                'avis' => true,
            ];

        return [
            'language' => 'fr',
            'weekStart' => 'monday',
            'compact' => false,
            'animations' => true,
            'notifications' => $notifications,
        ];
    }

    private function serialize(mixed $value, array $context): mixed
    {
        return json_decode(
            $this->serializer->serialize($value, 'json', $context),
            true
        );
    }
}
