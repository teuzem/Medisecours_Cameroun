<?php

declare(strict_types=1);

namespace App\Controller;

use App\Entity\Medecin;
use App\Entity\Patient;
use App\Entity\User;
use App\Service\EmailVerificationService;
use App\Service\SessionService;
use App\Service\UserSerializer;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\Routing\Annotation\Route;

class AdminUserController extends AbstractController
{
    private const PASSWORD_REGEX = '/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/';
    private const PHONE_REGEX = '/^\+237\s?[26]\d{8}$/';
    private const BLOOD_GROUP_REGEX = '/^(A|B|AB|O)[+-]$/';

    public function __construct(
        private readonly UserSerializer $userSerializer,
        private readonly EmailVerificationService $emailVerificationService,
        private readonly SessionService $sessionService,
    ) {
    }

    #[Route('/api/admin/users', name: 'api_admin_users_index', methods: ['GET'])]
    public function index(EntityManagerInterface $entityManager): JsonResponse
    {
        $this->denyAccessUnlessGranted('ROLE_ADMIN');

        $users = $entityManager->getRepository(User::class)->findBy([], ['createdAt' => 'DESC']);
        $managedUsers = array_values(array_filter(
            $users,
            static fn (User $user) => $user instanceof Patient || $user instanceof Medecin
        ));

        return new JsonResponse([
            'total' => count($managedUsers),
            'users' => array_map($this->userSerializer->serialize(...), $managedUsers),
        ]);
    }

    #[Route('/api/admin/users', name: 'api_admin_users_create', methods: ['POST'])]
    public function create(
        Request $request,
        EntityManagerInterface $entityManager,
        UserPasswordHasherInterface $passwordHasher,
    ): JsonResponse {
        $this->denyAccessUnlessGranted('ROLE_ADMIN');

        $data = $this->decodeJson($request);
        if ($data === null) {
            return $this->jsonError('Corps JSON invalide.', Response::HTTP_BAD_REQUEST);
        }

        $type = ($data['type'] ?? 'patient') === 'medecin' ? 'medecin' : 'patient';
        $email = strtolower(trim((string) ($data['email'] ?? '')));
        $password = (string) ($data['password'] ?? '');

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return $this->jsonError('Adresse email invalide.');
        }

        if (!preg_match(self::PASSWORD_REGEX, $password)) {
            return $this->jsonError('Le mot de passe doit contenir au moins 8 caracteres, une majuscule, une minuscule, un chiffre et un caractere special.');
        }

        if ($entityManager->getRepository(User::class)->findOneBy(['email' => $email])) {
            return $this->jsonError('Un compte existe deja avec cet email.', Response::HTTP_CONFLICT);
        }

        $user = $type === 'medecin' ? new Medecin() : new Patient();
        $user->setEmail($email);
        $user->setPassword($passwordHasher->hashPassword($user, $password));
        $user->setEmailVerified(true);
        $user->setActif(true);
        $user->setBanni(false);

        $validationError = $this->applyCommonFields($user, $data);
        if ($validationError !== null) {
            return $validationError;
        }

        if ($user instanceof Patient) {
            $validationError = $this->applyPatientFields($user, $data);
            if ($validationError !== null) {
                return $validationError;
            }
        }

        if ($user instanceof Medecin) {
            $validationError = $this->applyMedecinFields($user, $data);
            if ($validationError !== null) {
                return $validationError;
            }

            // Un medecin cree par un administrateur est considere valide d'emblee.
            $user->setEstValide(true);
        }

        $entityManager->persist($user);
        $entityManager->flush();

        return new JsonResponse([
            'message' => 'Utilisateur cree avec succes.',
            'user' => $this->userSerializer->serialize($user),
        ], Response::HTTP_CREATED);
    }

    #[Route('/api/admin/users/{id}', name: 'api_admin_users_update', methods: ['PATCH'])]
    public function update(string $id, Request $request, EntityManagerInterface $entityManager): JsonResponse
    {
        $this->denyAccessUnlessGranted('ROLE_ADMIN');

        $user = $this->findManagedUser($entityManager, $id);
        if (!$user) {
            return $this->jsonError('Utilisateur introuvable.', Response::HTTP_NOT_FOUND);
        }

        $data = $this->decodeJson($request);
        if ($data === null) {
            return $this->jsonError('Corps JSON invalide.', Response::HTTP_BAD_REQUEST);
        }

        $previousEmail = $user->getEmail();
        $validationError = $this->applyCommonFields($user, $data, true, $entityManager);
        if ($validationError !== null) {
            return $validationError;
        }

        if ($user instanceof Patient) {
            $validationError = $this->applyPatientFields($user, $data);
            if ($validationError !== null) {
                return $validationError;
            }
        }

        if ($user instanceof Medecin) {
            $validationError = $this->applyMedecinFields($user, $data);
            if ($validationError !== null) {
                return $validationError;
            }
        }

        if ($user->getEmail() !== $previousEmail) {
            $user->setEmailVerified(false);
            try {
                $this->emailVerificationService->sendVerificationEmail($user);
            } catch (\Throwable) {
                // La modification reste enregistrée; l'envoi pourra être relancé.
            }
            $this->sessionService->revokeUserSessions($user);
        }

        $entityManager->flush();

        return new JsonResponse([
            'message' => 'Utilisateur modifie avec succes.',
            'user' => $this->userSerializer->serialize($user),
        ]);
    }

    #[Route('/api/admin/users/{id}/status', name: 'api_admin_users_status', methods: ['PATCH'])]
    public function updateStatus(string $id, Request $request, EntityManagerInterface $entityManager): JsonResponse
    {
        $this->denyAccessUnlessGranted('ROLE_ADMIN');

        $user = $this->findManagedUser($entityManager, $id);
        if (!$user) {
            return $this->jsonError('Utilisateur introuvable.', Response::HTTP_NOT_FOUND);
        }

        $data = $this->decodeJson($request);
        if ($data === null) {
            return $this->jsonError('Corps JSON invalide.', Response::HTTP_BAD_REQUEST);
        }

        $action = (string) ($data['action'] ?? '');
        switch ($action) {
            case 'activer':
                $user->setActif(true);
                $message = 'Utilisateur active avec succes.';
                break;
            case 'desactiver':
                $user->setActif(false);
                $this->sessionService->revokeUserSessions($user);
                $message = 'Utilisateur desactive avec succes.';
                break;
            case 'bannir':
                $user->setBanni(true);
                $user->setActif(false);
                $this->sessionService->revokeUserSessions($user);
                $message = 'Utilisateur banni avec succes.';
                break;
            case 'debannir':
                $user->setBanni(false);
                $user->setActif(true);
                $message = 'Utilisateur debanni avec succes.';
                break;
            default:
                return $this->jsonError('Action invalide.', Response::HTTP_BAD_REQUEST);
        }

        $entityManager->flush();

        return new JsonResponse([
            'message' => $message,
            'user' => $this->userSerializer->serialize($user),
        ]);
    }

    private function findManagedUser(EntityManagerInterface $entityManager, string $id): Patient|Medecin|null
    {
        $user = $entityManager->getRepository(User::class)->find($id);

        if (!$user instanceof Patient && !$user instanceof Medecin) {
            return null;
        }

        return $user;
    }

    private function applyCommonFields(
        User $user,
        array $data,
        bool $isUpdate = false,
        ?EntityManagerInterface $entityManager = null,
    ): ?JsonResponse {
        if (!$isUpdate || array_key_exists('nom', $data)) {
            $nom = trim((string) ($data['nom'] ?? ''));
            if ($nom === '') {
                return $this->jsonError('Le nom est obligatoire.');
            }
            $user->setNom($nom);
        }

        if (!$isUpdate || array_key_exists('prenom', $data)) {
            $prenom = trim((string) ($data['prenom'] ?? ''));
            if ($prenom === '') {
                return $this->jsonError('Le prenom est obligatoire.');
            }
            $user->setPrenom($prenom);
        }

        if (array_key_exists('email', $data)) {
            $email = strtolower(trim((string) $data['email']));
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                return $this->jsonError('Adresse email invalide.');
            }

            if ($entityManager !== null) {
                $existingUser = $entityManager->getRepository(User::class)->findOneBy(['email' => $email]);
                if ($existingUser instanceof User && $existingUser->getId()?->toRfc4122() !== $user->getId()?->toRfc4122()) {
                    return $this->jsonError('Un compte existe deja avec cet email.', Response::HTTP_CONFLICT);
                }
            }

            $user->setEmail($email);
        }

        if (array_key_exists('telephone', $data)) {
            $telephone = trim((string) $data['telephone']);
            if ($telephone !== '' && !preg_match(self::PHONE_REGEX, $telephone)) {
                return $this->jsonError('Format camerounais attendu : +237 6XXXXXXXX ou +237 2XXXXXXXX');
            }
            $user->setTelephone($telephone !== '' ? $telephone : null);
        }

        if (array_key_exists('quartier', $data)) {
            $quartier = trim((string) $data['quartier']);
            $user->setQuartier($quartier !== '' ? $quartier : null);
        }

        return null;
    }

    private function applyPatientFields(Patient $user, array $data): ?JsonResponse
    {
        if (array_key_exists('groupeSanguin', $data)) {
            $groupeSanguin = strtoupper(trim((string) $data['groupeSanguin']));
            if ($groupeSanguin !== '' && !preg_match(self::BLOOD_GROUP_REGEX, $groupeSanguin)) {
                return $this->jsonError('Format groupe sanguin invalide. Exemples valides : A+, O-, AB+');
            }
            $user->setGroupeSanguin($groupeSanguin !== '' ? $groupeSanguin : null);
        }

        if (array_key_exists('allergies', $data)) {
            $allergies = $this->normalizeList($data['allergies']);
            $user->setAllergies($allergies !== [] ? $allergies : null);
        }

        return null;
    }

    private function applyMedecinFields(Medecin $user, array $data): ?JsonResponse
    {
        if (array_key_exists('specialite', $data)) {
            $specialite = trim((string) $data['specialite']);
            $user->setSpecialite($specialite !== '' ? $specialite : null);
        }

        if (array_key_exists('numeroOrdre', $data)) {
            $numeroOrdre = trim((string) $data['numeroOrdre']);
            $user->setNumeroOrdre($numeroOrdre !== '' ? $numeroOrdre : null);
        }

        return null;
    }

    /**
     * @return list<string>
     */
    private function normalizeList(mixed $value): array
    {
        if (is_string($value)) {
            $value = explode(',', $value);
        }

        if (!is_array($value)) {
            return [];
        }

        $normalized = [];
        foreach ($value as $item) {
            $item = trim((string) $item);
            if ($item !== '') {
                $normalized[] = $item;
            }
        }

        return array_values(array_unique($normalized));
    }

    private function decodeJson(Request $request): ?array
    {
        $data = json_decode($request->getContent(), true);

        return is_array($data) ? $data : null;
    }

    private function jsonError(string $message, int $status = Response::HTTP_UNPROCESSABLE_ENTITY): JsonResponse
    {
        return new JsonResponse(['error' => $message], $status);
    }
}
