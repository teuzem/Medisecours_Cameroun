<?php

declare(strict_types=1);

namespace App\Controller\Api;

use App\Entity\SignatureNumerique;
use App\Entity\User;
use App\Repository\SignatureNumeriqueRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

/**
 * Signature numérique de l'utilisateur connecté (médecin ou dirigeant).
 *
 * - GET  /api/me/signature : signature active (data URI, empreinte, date).
 * - POST /api/me/signature : enregistre une nouvelle signature (body JSON).
 */
#[Route('/api/me', name: 'api_me_signature_')]
#[IsGranted('ROLE_USER')]
class SignatureController extends AbstractController
{
    private const MAX_IMAGE_BYTES = 2_000_000;
    private const DATA_URI_PATTERN = '#^data:image/(png|webp|jpeg);base64,[A-Za-z0-9+/]+={0,2}$#';

    public function __construct(
        private readonly SignatureNumeriqueRepository $signatureRepository,
        private readonly EntityManagerInterface $em,
    ) {
    }

    #[Route('/signature', name: 'show', methods: ['GET'])]
    public function show(): JsonResponse
    {
        $user = $this->requireUser();
        $signature = $this->signatureRepository->findOneActiveByUser($user);

        return new JsonResponse($signature ? $this->serializeSignature($signature, $user) : null);
    }

    /**
     * Body JSON : { imageData: "data:image/png;base64,...", grade?: string|null }
     *
     * Chaque nouvel enregistrement désactive la signature précédente
     * (historique conservé pour la piste d'audit / non-répudiation).
     */
    #[Route('/signature', name: 'save', methods: ['POST'])]
    public function save(): JsonResponse
    {
        $user = $this->requireUser();
        $data = $this->getRequestJson();

        $imageData = $data['imageData'] ?? null;
        if (!is_string($imageData) || !preg_match(self::DATA_URI_PATTERN, $imageData)) {
            throw new BadRequestHttpException('Signature invalide : un data URI PNG/JPEG/WebP est attendu.');
        }
        if (strlen($imageData) > self::MAX_IMAGE_BYTES) {
            throw new BadRequestHttpException('Signature trop volumineuse (2 Mo max).');
        }

        $grade = null;
        if (array_key_exists('grade', $data) && $data['grade'] !== null) {
            $grade = trim((string) $data['grade']);
            if ($grade !== '' && mb_strlen($grade) > 120) {
                throw new BadRequestHttpException('Grade trop long (120 caractères max).');
            }
            $grade = $grade === '' ? null : $grade;
        }

        $this->signatureRepository->deactivateAllForUser($user);

        $signature = new SignatureNumerique();
        $signature
            ->setUtilisateur($user)
            ->setImageData($imageData)
            ->setHashSha256(hash('sha256', $imageData))
            ->setGrade($grade)
            ->setSignedAt(new \DateTimeImmutable())
            ->setEstActive(true);

        $this->em->persist($signature);
        $this->em->flush();

        return new JsonResponse($this->serializeSignature($signature, $user), 201);
    }

    private function requireUser(): User
    {
        $user = $this->getUser();
        if (!$user instanceof User) {
            throw new AccessDeniedHttpException('Authentification requise.');
        }

        return $user;
    }

    /**
     * @return array<string, mixed>
     */
    private function getRequestJson(): array
    {
        try {
            $data = json_decode($this->getRequest()->getContent() ?: '[]', true);
        } catch (\JsonException) {
            $data = null;
        }
        if (!is_array($data)) {
            throw new BadRequestHttpException('Corps JSON invalide.');
        }

        return $data;
    }

    private function getRequest(): \Symfony\Component\HttpFoundation\Request
    {
        return $this->container->get('request_stack')->getCurrentRequest();
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeSignature(SignatureNumerique $signature, User $user): array
    {
        return [
            'id' => $signature->getId(),
            'imageData' => $signature->getImageData(),
            'hash' => $signature->getHashSha256(),
            'hashShort' => substr((string) $signature->getHashSha256(), 0, 12),
            'grade' => $signature->getGrade(),
            'signedAt' => $signature->getSignedAt()->format(\DateTimeInterface::RFC3339),
            'prenom' => $user->getPrenom(),
            'nom' => $user->getNom(),
        ];
    }
}
