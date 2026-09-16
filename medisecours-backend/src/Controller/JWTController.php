<?php

declare(strict_types=1);

namespace App\Controller;

use App\Entity\Medecin;
use App\Entity\Patient;
use App\Entity\User;
use App\Service\UserSerializer;
use App\Service\EmailVerificationService;
use App\Service\IdentityDocumentStorage;
use App\Service\SessionService;
use Doctrine\ORM\EntityManagerInterface;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\RateLimiter\RateLimiterFactory;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

/**
 * Endpoints d'authentification JWT pour MediSecours+.
 * Route principale : /api/auth/*
 *
 * Rate limiting activé pour résister aux attaques brute force
 * (dimensionné pour 200 000+ utilisateurs camerounais).
 */
class JWTController extends AbstractController
{
    public function __construct(
        private readonly UserSerializer $userSerializer
    ) {
    }

    /**
     * Connexion email + mot de passe.
     * Rate limit : 10 tentatives / minute / IP.
     */
    #[Route('/api/auth/login', name: 'api_auth_login', methods: ['POST'])]
    public function login(
        Request $request,
        UserPasswordHasherInterface $passwordHasher,
        JWTTokenManagerInterface $jwtManager,
        EntityManagerInterface $entityManager,
        SessionService $sessionService,
        #[Autowire(service: 'limiter.auth_login')] RateLimiterFactory $loginLimiter
    ): JsonResponse {
        // Appliquer le rate limit par IP
        $limiter = $loginLimiter->create($request->getClientIp());
        if (!$limiter->consume(1)->isAccepted()) {
            return new JsonResponse(
                ['error' => 'Trop de tentatives de connexion. Réessayez dans une minute.'],
                Response::HTTP_TOO_MANY_REQUESTS
            );
        }

        $data = json_decode($request->getContent(), true);

        if (!is_array($data) || !isset($data['email'], $data['password'])) {
            return new JsonResponse(['error' => 'Email et mot de passe obligatoires.'], Response::HTTP_BAD_REQUEST);
        }

        $user = $entityManager->getRepository(User::class)->findOneBy(['email' => strtolower(trim($data['email']))]);

        if (!$user || !$passwordHasher->isPasswordValid($user, (string) $data['password'])) {
            // Message volontairement générique — ne pas indiquer lequel des deux est invalide
            return new JsonResponse(['error' => 'Identifiants invalides.'], Response::HTTP_UNAUTHORIZED);
        }

        if ($user->isBanni()) {
            return new JsonResponse(['error' => 'Votre compte a été banni.'], Response::HTTP_FORBIDDEN);
        }

        if (!$user->isActif()) {
            return new JsonResponse(['error' => 'Votre compte est désactivé.'], Response::HTTP_FORBIDDEN);
        }

        if (!$user->isEmailVerified()) {
            return new JsonResponse([
                'error' => 'Confirmez votre adresse email avant de vous connecter.',
            ], Response::HTTP_FORBIDDEN);
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

    #[Route('/api/auth/refresh', name: 'api_auth_refresh', methods: ['POST'])]
    public function refresh(Request $request, JWTTokenManagerInterface $jwtManager, EntityManagerInterface $entityManager, SessionService $sessionService): JsonResponse
    {
        $plainRefreshToken = $request->cookies->get('medisecours_refresh');
        if (!is_string($plainRefreshToken) || trim($plainRefreshToken) === '') {
            $response = new JsonResponse(null, Response::HTTP_NO_CONTENT);
            foreach ($sessionService->clearCookies() as $cookie) {
                $response->headers->setCookie($cookie);
            }

            return $response;
        }

        $current = $sessionService->findRefreshToken($plainRefreshToken);
        if ($current?->getRevokedAt()) {
            $sessionService->revokeFamily($current->getFamily());
            $entityManager->flush();
            $response = new JsonResponse(['error' => 'Session compromise détectée.'], Response::HTTP_UNAUTHORIZED);
            foreach ($sessionService->clearCookies() as $cookie) {
                $response->headers->setCookie($cookie);
            }
            return $response;
        }

        $user = $current?->getUser();
        if (
            !$current?->isUsable()
            || !$user
            || $user->isBanni()
            || !$user->isActif()
            || !$user->isEmailVerified()
            || ($user instanceof Medecin && !$user->isEstValide())
        ) {
            $response = new JsonResponse(['error' => 'Session expirée.'], Response::HTTP_UNAUTHORIZED);
            foreach ($sessionService->clearCookies() as $cookie) {
                $response->headers->setCookie($cookie);
            }
            return $response;
        }

        $current->revoke();
        $refresh = $sessionService->createRefreshSession($user, $current->getFamily());
        $jwt = $jwtManager->create($user);
        $entityManager->flush();

        $response = new JsonResponse(['token' => $jwt, 'user' => $this->userSerializer->serialize($user)]);
        $response->headers->setCookie($sessionService->accessCookie($jwt));
        $response->headers->setCookie($refresh['cookie']);
        return $response;
    }

    #[Route('/api/auth/logout', name: 'api_auth_logout', methods: ['POST'])]
    public function logout(Request $request, EntityManagerInterface $entityManager, SessionService $sessionService): JsonResponse
    {
        $current = $sessionService->findRefreshToken($request->cookies->get('medisecours_refresh'));
        if ($current) {
            $sessionService->revokeFamily($current->getFamily());
            $entityManager->flush();
        }

        $response = new JsonResponse(['message' => 'Session fermée.']);
        foreach ($sessionService->clearCookies() as $cookie) {
            $response->headers->setCookie($cookie);
        }
        return $response;
    }

    /**
     * Inscription patient ou médecin.
     * Rate limit : 5 créations / heure / IP.
     */
    #[Route('/api/auth/register', name: 'api_auth_register', methods: ['POST'])]
    public function register(

        Request $request,
        UserPasswordHasherInterface $passwordHasher,
        EntityManagerInterface $entityManager,
        EmailVerificationService $emailVerificationService,
        IdentityDocumentStorage $identityDocumentStorage,
        #[Autowire(service: 'limiter.auth_register')] RateLimiterFactory $registerLimiter
    ): JsonResponse {
        $limiter = $registerLimiter->create($request->getClientIp());
        if (!$limiter->consume(1)->isAccepted()) {
            return new JsonResponse(
                ['error' => 'Trop de créations de compte. Réessayez dans une heure.'],
                Response::HTTP_TOO_MANY_REQUESTS
            );
        }

        $data = str_starts_with((string) $request->headers->get('Content-Type'), 'multipart/form-data')
            ? $request->request->all()
            : json_decode($request->getContent(), true);

        if (!is_array($data) || !isset($data['email'], $data['password'])) {
            return new JsonResponse(['error' => 'Email et mot de passe obligatoires.'], Response::HTTP_BAD_REQUEST);
        }

        // Validation de l'email
        $email = strtolower(trim($data['email']));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return new JsonResponse(['error' => 'Adresse email invalide.'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        // Validation de la force du mot de passe (majuscule, minuscule, chiffre, caractère spécial, 8+ chars)
        $password = (string) $data['password'];
        if (!preg_match('/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/', $password)) {
            return new JsonResponse([
                'error' => 'Le mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $existingUser = $entityManager->getRepository(User::class)->findOneBy(['email' => $email]);
        if ($existingUser) {
            return new JsonResponse(['error' => 'Un compte existe déjà avec cet email.'], Response::HTTP_CONFLICT);
        }

        $type = $data['type'] ?? 'patient';
        $user = $type === 'medecin' ? new Medecin() : new Patient();

        $user->setEmail($email);
        $user->setPassword($passwordHasher->hashPassword($user, $password));

        if (isset($data['nom'])) {
            $user->setNom((string) $data['nom']);
        }
        if (isset($data['prenom'])) {
            $user->setPrenom((string) $data['prenom']);
        }
        if (isset($data['telephone'])) {
            $user->setTelephone((string) $data['telephone']);
        }
        if (isset($data['quartier'])) {
            $user->setQuartier((string) $data['quartier']);
        }

        if ($user instanceof Patient) {
            if (isset($data['groupeSanguin'])) {
                $user->setGroupeSanguin((string) $data['groupeSanguin']);
            }
            if (isset($data['allergies'])) {
                // allergies est JSON array — accepte string (legacy) ou array
                $allergies = $data['allergies'];
                if (is_string($allergies) && $allergies !== '') {
                    $allergies = array_map('trim', explode(',', $allergies));
                }
                $user->setAllergies(is_array($allergies) ? $allergies : []);
            }
            if (isset($data['contactsUrgence'])) {
                // contactsUrgence est JSON array — accepte string (legacy) ou array
                $contacts = $data['contactsUrgence'];
                if (is_string($contacts) && $contacts !== '') {
                    $contacts = [['nom' => $contacts, 'telephone' => '', 'lien' => '']];
                }
                $user->setContactsUrgence(is_array($contacts) ? $contacts : []);
            }
        }

        if ($user instanceof Medecin) {
            $specialite = trim((string) ($data['specialite'] ?? ''));
            $numeroOrdre = trim((string) ($data['numeroOrdre'] ?? ''));
            $typePieceIdentite = strtoupper(trim((string) ($data['typePieceIdentite'] ?? '')));
            $pieceIdentite = $request->files->get('pieceIdentite');
            $pieceIdentiteVerso = $request->files->get('pieceIdentiteVerso');
            $photoVerification = $request->files->get('photoVerification');

            if ($specialite === '' || $numeroOrdre === '') {
                return new JsonResponse([
                    'error' => 'La spécialité et le numéro d’ordre sont obligatoires pour un médecin.',
                ], Response::HTTP_UNPROCESSABLE_ENTITY);
            }
            if (!in_array($typePieceIdentite, ['CNI', 'PASSPORT'], true)) {
                return new JsonResponse([
                    'error' => 'Choisissez une pièce d’identité valide : CNI ou passeport.',
                ], Response::HTTP_UNPROCESSABLE_ENTITY);
            }
            if (!$pieceIdentite instanceof UploadedFile || !$photoVerification instanceof UploadedFile) {
                return new JsonResponse([
                    'error' => 'La pièce d’identité et la photo récente du médecin sont obligatoires.',
                ], Response::HTTP_UNPROCESSABLE_ENTITY);
            }
            if ($typePieceIdentite === 'CNI' && !$pieceIdentiteVerso instanceof UploadedFile) {
                return new JsonResponse([
                    'error' => 'Les photos recto et verso de la CNI sont obligatoires.',
                ], Response::HTTP_UNPROCESSABLE_ENTITY);
            }

            $user
                ->setSpecialite($specialite)
                ->setNumeroOrdre($numeroOrdre)
                ->setTypePieceIdentite($typePieceIdentite);

            try {
                $user
                    ->setPieceIdentite($identityDocumentStorage->createIdentityDocument($pieceIdentite, $user))
                    ->setPhotoVerificationIdentite($identityDocumentStorage->createVerificationPhoto($photoVerification, $user));
                if ($pieceIdentiteVerso instanceof UploadedFile) {
                    $user->setPieceIdentiteVerso(
                        $identityDocumentStorage->createIdentityDocument($pieceIdentiteVerso, $user)
                    );
                }
            } catch (UnprocessableEntityHttpException $exception) {
                return new JsonResponse(
                    ['error' => $exception->getMessage()],
                    Response::HTTP_UNPROCESSABLE_ENTITY
                );
            }
        }

        $entityManager->persist($user);
        $entityManager->flush();

        // Envoyer l'email de vérification (non bloquant si le mailer est indisponible)
        try {
            $emailVerificationService->sendVerificationEmail($user);
        } catch (\Throwable) {
            // L'email ne bloque pas l'inscription — sera renvoyé sur demande
        }
        $entityManager->flush();

        return new JsonResponse([
            'message'       => 'Compte créé avec succès. Un email de confirmation vous a été envoyé.',
            'user'          => $this->userSerializer->serialize($user),
            'emailVerified' => false,
        ], Response::HTTP_CREATED);
    }

    /**
     * Vérification de l'email via le token reçu par email.
     * GET /api/auth/verify-email?token=xxxxx
     */
    
    #[Route('/api/auth/verify-email', name: 'api_auth_verify_email', methods: ['GET'])]
    public function verifyEmail(
        Request $request,
        EntityManagerInterface $entityManager,
        JWTTokenManagerInterface $jwtManager
    ): JsonResponse {
        $token = $request->query->get('token');

        if (!$token || !is_string($token)) {
            return new JsonResponse(['error' => 'Token manquant.'], Response::HTTP_BAD_REQUEST);
        }

        $user = $entityManager->getRepository(User::class)->findOneBy([
            'emailVerificationToken' => hash('sha256', $token),
        ]);

        if (
            !$user
            || !$user->getEmailVerificationTokenExpiresAt()
            || $user->getEmailVerificationTokenExpiresAt() <= new \DateTimeImmutable()
        ) {
            return new JsonResponse(['error' => 'Token invalide ou expiré.'], Response::HTTP_NOT_FOUND);
        }

        $user->setEmailVerified(true);
        $user->setEmailVerificationToken(null);
        $user->setEmailVerificationTokenExpiresAt(null);
        $entityManager->flush();

        return new JsonResponse([
            'message' => 'Email vérifié avec succès.',
            'user'    => $this->userSerializer->serialize($user),
        ]);
    }

    /**
     * Demande de réinitialisation du mot de passe.
     * POST /api/auth/forgot-password
     * Body: { "email": "..." }
     * Rate limit : 3 demandes / heure / IP.
     */
    #[Route('/api/auth/forgot-password', name: 'api_auth_forgot_password', methods: ['POST'])]
    public function forgotPassword(
        Request $request,
        EntityManagerInterface $entityManager,
        EmailVerificationService $emailVerificationService,
        #[Autowire(service: 'limiter.password_reset')] RateLimiterFactory $resetLimiter
    ): JsonResponse {
        $limiter = $resetLimiter->create($request->getClientIp());
        if (!$limiter->consume(1)->isAccepted()) {
            return new JsonResponse(
                ['error' => 'Trop de demandes. Réessayez dans une heure.'],
                Response::HTTP_TOO_MANY_REQUESTS
            );
        }

        $data = json_decode($request->getContent(), true);

        if (!is_array($data) || !isset($data['email'])) {
            return new JsonResponse(['error' => 'Email obligatoire.'], Response::HTTP_BAD_REQUEST);
        }

        $user = $entityManager->getRepository(User::class)->findOneBy([
            'email' => strtolower(trim($data['email'])),
        ]);

        // Réponse identique que l'email existe ou non (anti-énumération)
        if ($user) {
            try {
                $emailVerificationService->sendPasswordResetEmail($user);
                $entityManager->flush();
            } catch (\Throwable) {
                // Silencieux — log géré dans le service
            }
        }

        return new JsonResponse([
            'message' => 'Si cet email existe, un lien de réinitialisation vous a été envoyé.',
        ]);
    }

    #[Route('/api/auth/resend-verification', name: 'api_auth_resend_verification', methods: ['POST'])]
    public function resendVerification(
        Request $request,
        EntityManagerInterface $entityManager,
        EmailVerificationService $emailVerificationService,
        #[Autowire(service: 'limiter.password_reset')] RateLimiterFactory $resetLimiter
    ): JsonResponse {
        if (!$resetLimiter->create($request->getClientIp())->consume(1)->isAccepted()) {
            return new JsonResponse(
                ['error' => 'Trop de demandes. Réessayez dans une heure.'],
                Response::HTTP_TOO_MANY_REQUESTS
            );
        }

        $data = json_decode($request->getContent(), true);
        $email = is_array($data) ? strtolower(trim((string) ($data['email'] ?? ''))) : '';
        if ($email !== '') {
            $user = $entityManager->getRepository(User::class)->findOneBy(['email' => $email]);
            if ($user instanceof User && !$user->isEmailVerified()) {
                try {
                    $emailVerificationService->sendVerificationEmail($user);
                    $entityManager->flush();
                } catch (\Throwable) {
                    // Réponse volontairement identique afin de ne pas révéler l'existence du compte.
                }
            }
        }

        return new JsonResponse([
            'message' => 'Si ce compte existe et nécessite une confirmation, un nouvel email a été envoyé.',
        ]);
    }

    /**
     * Réinitialisation effective du mot de passe via token.
     * POST /api/auth/reset-password
     * Body: { "token": "...", "password": "..." }
     */
    #[Route('/api/auth/reset-password', name: 'api_auth_reset_password', methods: ['POST'])]
    public function resetPassword(
        Request $request,
        EntityManagerInterface $entityManager,
        UserPasswordHasherInterface $passwordHasher,
        SessionService $sessionService
    ): JsonResponse {
        $data = json_decode($request->getContent(), true);

        if (!is_array($data) || !isset($data['token'], $data['password'])) {
            return new JsonResponse(['error' => 'Token et nouveau mot de passe obligatoires.'], Response::HTTP_BAD_REQUEST);
        }

        $user = $entityManager->getRepository(User::class)->findOneBy([
            'passwordResetToken' => hash('sha256', (string) $data['token']),
        ]);

        if (!$user) {
            return new JsonResponse(['error' => 'Token invalide.'], Response::HTTP_NOT_FOUND);
        }

        // Vérifier l'expiration (1h)
        if (
            !$user->getPasswordResetTokenExpiresAt()
            || $user->getPasswordResetTokenExpiresAt() < new \DateTimeImmutable()
        ) {
            return new JsonResponse(['error' => 'Ce lien de réinitialisation a expiré. Faites une nouvelle demande.'], Response::HTTP_GONE);
        }

        $newPassword = (string) $data['password'];
        if (!preg_match('/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/', $newPassword)) {
            return new JsonResponse([
                'error' => 'Le mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $user->setPassword($passwordHasher->hashPassword($user, $newPassword));
        $user->setPasswordResetToken(null);
        $user->setPasswordResetTokenExpiresAt(null);
        $sessionService->revokeUserSessions($user);
        $entityManager->flush();

        return new JsonResponse(['message' => 'Mot de passe réinitialisé avec succès.']);
    }

    #[Route('/api/auth/change-password', name: 'api_auth_change_password', methods: ['POST'])]
    public function changePassword(
        Request $request,
        EntityManagerInterface $entityManager,
        UserPasswordHasherInterface $passwordHasher,
        SessionService $sessionService,
        #[Autowire(service: 'limiter.account_sensitive')] RateLimiterFactory $sensitiveLimiter
    ): JsonResponse {
        if (!$sensitiveLimiter->create($request->getClientIp())->consume(1)->isAccepted()) {
            return new JsonResponse(['error' => 'Trop de tentatives. Réessayez plus tard.'], Response::HTTP_TOO_MANY_REQUESTS);
        }

        $user = $this->getUser();
        if (!$user instanceof User) {
            return new JsonResponse(['error' => 'Authentification requise.'], Response::HTTP_UNAUTHORIZED);
        }

        $data = json_decode($request->getContent(), true);
        if (!is_array($data) || !isset($data['currentPassword'], $data['newPassword'])) {
            return new JsonResponse([
                'error' => 'Mot de passe actuel et nouveau mot de passe obligatoires.',
            ], Response::HTTP_BAD_REQUEST);
        }
        if (!$passwordHasher->isPasswordValid($user, (string) $data['currentPassword'])) {
            return new JsonResponse(['error' => 'Mot de passe actuel incorrect.'], Response::HTTP_UNAUTHORIZED);
        }

        $newPassword = (string) $data['newPassword'];
        if (!preg_match('/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/', $newPassword)) {
            return new JsonResponse([
                'error' => 'Le nouveau mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }
        if ($passwordHasher->isPasswordValid($user, $newPassword)) {
            return new JsonResponse([
                'error' => 'Le nouveau mot de passe doit être différent du mot de passe actuel.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $user->setPassword($passwordHasher->hashPassword($user, $newPassword));
        $sessionService->revokeUserSessions($user);
        $entityManager->flush();

        $response = new JsonResponse(['message' => 'Mot de passe modifié. Reconnectez-vous.']);
        foreach ($sessionService->clearCookies() as $cookie) {
            $response->headers->setCookie($cookie);
        }

        return $response;
    }

    #[Route('/api/auth/change-email', name: 'api_auth_change_email', methods: ['POST'])]
    public function changeEmail(
        Request $request,
        EntityManagerInterface $entityManager,
        UserPasswordHasherInterface $passwordHasher,
        EmailVerificationService $emailVerificationService,
        SessionService $sessionService,
        #[Autowire(service: 'limiter.account_sensitive')] RateLimiterFactory $sensitiveLimiter
    ): JsonResponse {
        if (!$sensitiveLimiter->create($request->getClientIp())->consume(1)->isAccepted()) {
            return new JsonResponse(['error' => 'Trop de tentatives. Réessayez plus tard.'], Response::HTTP_TOO_MANY_REQUESTS);
        }

        $user = $this->getUser();
        if (!$user instanceof User) {
            return new JsonResponse(['error' => 'Authentification requise.'], Response::HTTP_UNAUTHORIZED);
        }

        $data = json_decode($request->getContent(), true);
        if (!is_array($data) || !isset($data['currentPassword'], $data['email'])) {
            return new JsonResponse([
                'error' => 'Mot de passe actuel et nouvelle adresse email obligatoires.',
            ], Response::HTTP_BAD_REQUEST);
        }
        if (!$passwordHasher->isPasswordValid($user, (string) $data['currentPassword'])) {
            return new JsonResponse(['error' => 'Mot de passe actuel incorrect.'], Response::HTTP_UNAUTHORIZED);
        }

        $email = strtolower(trim((string) $data['email']));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return new JsonResponse(['error' => 'Adresse email invalide.'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }
        $existing = $entityManager->getRepository(User::class)->findOneBy(['email' => $email]);
        if ($existing && $existing !== $user) {
            return new JsonResponse(['error' => 'Cette adresse email est déjà utilisée.'], Response::HTTP_CONFLICT);
        }
        if ($email === $user->getEmail()) {
            return new JsonResponse(['error' => 'Cette adresse est déjà celle de votre compte.'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $user->setEmail($email);
        $user->setEmailVerified(false);
        try {
            $emailVerificationService->sendVerificationEmail($user);
        } catch (\Throwable) {
            // Le jeton reste enregistré afin qu'un renvoi puisse être effectué.
        }
        $sessionService->revokeUserSessions($user);
        $entityManager->flush();

        $response = new JsonResponse([
            'message' => 'Adresse email modifiée. Confirmez la nouvelle adresse avant de vous reconnecter.',
        ]);
        foreach ($sessionService->clearCookies() as $cookie) {
            $response->headers->setCookie($cookie);
        }

        return $response;
    }
}
