<?php

declare(strict_types=1);

namespace App\Controller;

use App\Entity\Medecin;
use App\Entity\Patient;
use App\Entity\User;
use App\Service\UserSerializer;
use App\Service\SessionService;
use Composer\CaBundle\CaBundle;
use Doctrine\ORM\EntityManagerInterface;
use Google_Client;
use GuzzleHttp\Client as GuzzleClient;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\RateLimiter\RateLimiterFactory;
use Symfony\Component\Routing\Annotation\Route;
use Throwable;

/**
 * Authentification via Google OAuth2.
 * Crée automatiquement un compte Patient si l'email n'existe pas encore.
 * Rate limit : 20 requêtes / minute / IP.
 */
class GoogleAuthController extends AbstractController
{
    public function __construct(
        private readonly UserSerializer $userSerializer
    ) {
    }

    #[Route('/api/auth/google', name: 'api_auth_google', methods: ['POST'])]
    public function __invoke(
        Request $request,
        EntityManagerInterface $entityManager,
        JWTTokenManagerInterface $jwtManager,
        SessionService $sessionService,
        UserPasswordHasherInterface $passwordHasher,
        LoggerInterface $logger,
        #[Autowire(env: 'APP_ENV')] string $appEnv,
        #[Autowire(env: 'GOOGLE_CLIENT_ID')] string $clientId,
        #[Autowire(service: 'limiter.auth_google')] RateLimiterFactory $googleLimiter
    ): JsonResponse {
        // Rate limiting
        $limiter = $googleLimiter->create($request->getClientIp());
        if (!$limiter->consume(1)->isAccepted()) {
            return new JsonResponse(
                ['error' => 'Trop de tentatives. Réessayez dans une minute.'],
                Response::HTTP_TOO_MANY_REQUESTS
            );
        }

        $data = json_decode($request->getContent(), true);

        if (!is_array($data) || !isset($data['googleIdToken']) || !is_string($data['googleIdToken'])) {
            return new JsonResponse(['error' => 'googleIdToken manquant.'], Response::HTTP_BAD_REQUEST);
        }

        if ($clientId === '') {
            return new JsonResponse(['error' => 'Configuration Google OAuth manquante.'], Response::HTTP_INTERNAL_SERVER_ERROR);
        }

        try {
            $client = new Google_Client(['client_id' => $clientId]);
            $client->setHttpClient(new GuzzleClient([
                'verify' => CaBundle::getBundledCaBundlePath(),
            ]));
            $payload = $client->verifyIdToken($data['googleIdToken']);
        } catch (Throwable $exception) {
            $logger->error('Google token verification failed.', [
                'exception' => $exception::class,
                'message'   => $exception->getMessage(),
            ]);

            $response = ['error' => 'Vérification Google temporairement indisponible.'];
            if ($appEnv === 'dev') {
                $response['details'] = $exception->getMessage();
            }

            return new JsonResponse($response, Response::HTTP_SERVICE_UNAVAILABLE);
        }

        if (!$payload) {
            return new JsonResponse(['error' => 'Token Google invalide.'], Response::HTTP_UNAUTHORIZED);
        }

        if (($payload['email_verified'] ?? false) !== true) {
            return new JsonResponse(['error' => 'Email Google non vérifié.'], Response::HTTP_UNAUTHORIZED);
        }

        $email = $payload['email'] ?? null;
        if (!is_string($email) || $email === '') {
            return new JsonResponse(['error' => 'Email Google absent du token.'], Response::HTTP_BAD_REQUEST);
        }

        $email  = strtolower($email);
        $nom    = $payload['family_name'] ?? 'Inconnu';
        $prenom = $payload['given_name'] ?? 'Inconnu';
        $photo  = $payload['picture'] ?? null;

        $user = $entityManager->getRepository(User::class)->findOneBy(['email' => $email]);

        if (!$user) {
            // Création automatique d'un Patient
            $user = new Patient();
            $user->setEmail($email);
            $user->setNom($nom);
            $user->setPrenom($prenom);
            $user->setRoles(['ROLE_PATIENT']);
            // Email Google déjà vérifié par Google — on marque emailVerified = true
            $user->setEmailVerified(true);

            if (is_string($photo)) {
                $user->setPhotoProfil($photo);
            }

            // Mot de passe aléatoire inutilisable (l'utilisateur ne peut se connecter que via Google)
            $randomPassword = bin2hex(random_bytes(32));
            $user->setPassword($passwordHasher->hashPassword($user, $randomPassword));

            $entityManager->persist($user);
            $entityManager->flush();
        } else {
            // Mise à jour des informations manquantes
            $needsFlush = false;

            if ($user->getNom() === null) {
                $user->setNom($nom);
                $needsFlush = true;
            }
            if ($user->getPrenom() === null) {
                $user->setPrenom($prenom);
                $needsFlush = true;
            }
            if ($user->getPhotoProfil() === null && is_string($photo)) {
                $user->setPhotoProfil($photo);
                $needsFlush = true;
            }
            // Marquer l'email comme vérifié si ce n'est pas déjà le cas (connexion Google = email vérifié)
            if (!$user->isEmailVerified()) {
                $user->setEmailVerified(true);
                $needsFlush = true;
            }

            if ($needsFlush) {
                $entityManager->flush();
            }
        }

        // ── Vérification du statut du compte ────────────────────────────────
        if ($user->isBanni()) {
            return new JsonResponse(
                ['error' => 'Votre compte a été suspendu. Contactez le support.'],
                Response::HTTP_FORBIDDEN
            );
        }

        if (!$user->isActif()) {
            return new JsonResponse(
                ['error' => 'Votre compte est désactivé. Contactez le support.'],
                Response::HTTP_FORBIDDEN
            );
        }

        // Le profil professionnel doit être vérifié avant l'ouverture de l'accès médecin.
        if ($user instanceof Medecin && !$user->isEstValide()) {
            return new JsonResponse([
                'error' => 'Votre compte médecin est en attente de vérification. Vous recevrez un email dès que votre accès sera activé.',
            ], Response::HTTP_FORBIDDEN);
        }

        $jwt = $jwtManager->create($user);
        $refresh = $sessionService->createRefreshSession($user);
        $entityManager->flush();

        $response = new JsonResponse([
            'token' => $jwt,
            'user'  => $this->userSerializer->serialize($user),
        ]);
        $response->headers->setCookie($sessionService->accessCookie($jwt));
        $response->headers->setCookie($refresh['cookie']);

        return $response;
    }
}
