<?php

declare(strict_types=1);

namespace App\Controller\Api;

use App\Entity\MediaObject;
use App\Entity\User;
use App\Service\WebSocketNotifier;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\RateLimiter\RateLimiterFactory;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

final class UploadProfilePhotoController extends AbstractController
{
    private const MAX_FILE_SIZE = 5 * 1024 * 1024;
    private const MAX_DIMENSION = 6000;
    private const MAX_PIXELS = 24_000_000;
    private const ALLOWED_MIME_TYPES = [
        'image/jpeg',
        'image/png',
        'image/webp',
    ];

    #[Route('/api/profile/photo', name: 'api_profile_photo_upload', methods: ['POST'])]
    #[IsGranted('ROLE_USER')]
    public function __invoke(
        Request $request,
        EntityManagerInterface $entityManager,
        WebSocketNotifier $wsNotifier,
        #[Autowire(service: 'limiter.media_upload')] RateLimiterFactory $mediaLimiter,
    ): JsonResponse {
        $user = $this->getUser();
        if (!$user instanceof User) {
            return $this->json(['error' => 'Authentification requise.'], Response::HTTP_UNAUTHORIZED);
        }

        $limit = $mediaLimiter->create('profile-photo-'.$user->getUserIdentifier())->consume(1);
        if (!$limit->isAccepted()) {
            return $this->json(
                ['error' => 'Trop de tentatives. Reessayez dans quelques instants.'],
                Response::HTTP_TOO_MANY_REQUESTS
            );
        }

        $file = $request->files->get('file');
        if (!$file instanceof UploadedFile || !$file->isValid()) {
            return $this->json(['error' => 'Aucune image valide fournie.'], Response::HTTP_BAD_REQUEST);
        }

        if ((int) $file->getSize() > self::MAX_FILE_SIZE) {
            return $this->json(
                ['error' => 'La photo depasse la taille maximale de 5 Mo.'],
                Response::HTTP_UNPROCESSABLE_ENTITY
            );
        }

        $mimeType = $file->getMimeType();
        if (!in_array($mimeType, self::ALLOWED_MIME_TYPES, true)) {
            return $this->json(
                ['error' => 'Format non autorise. Utilisez une image JPEG, PNG ou WebP.'],
                Response::HTTP_UNPROCESSABLE_ENTITY
            );
        }

        $imageInfo = @getimagesize($file->getPathname());
        if ($imageInfo === false) {
            return $this->json(
                ['error' => 'Le fichier ne contient pas une image valide.'],
                Response::HTTP_UNPROCESSABLE_ENTITY
            );
        }

        [$width, $height] = $imageInfo;
        if (
            $width < 1
            || $height < 1
            || $width > self::MAX_DIMENSION
            || $height > self::MAX_DIMENSION
            || ($width * $height) > self::MAX_PIXELS
        ) {
            return $this->json(
                ['error' => 'Dimensions excessives. La photo doit rester sous 6000 px et 24 megapixels.'],
                Response::HTTP_UNPROCESSABLE_ENTITY
            );
        }

        $detectedMimeType = image_type_to_mime_type((int) $imageInfo[2]);
        if ($detectedMimeType !== $mimeType || !in_array($detectedMimeType, self::ALLOWED_MIME_TYPES, true)) {
            return $this->json(
                ['error' => 'Le contenu de la photo ne correspond pas a son format.'],
                Response::HTTP_UNPROCESSABLE_ENTITY
            );
        }

        $contents = @file_get_contents($file->getPathname());
        if ($contents === false || $contents === '') {
            return $this->json(
                ['error' => 'La photo ne peut pas etre lue. Reessayez avec un autre fichier.'],
                Response::HTTP_UNPROCESSABLE_ENTITY
            );
        }

        $extension = match ($detectedMimeType) {
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp',
            default => throw new \LogicException('Type d image valide non pris en charge.'),
        };
        $storedFileName = bin2hex(random_bytes(20)).'.'.$extension;
        $originalName = basename(trim($file->getClientOriginalName()));
        if ($originalName === '' || $originalName === '.' || $originalName === '..') {
            $originalName = 'photo-profil.'.$extension;
        }

        $connection = $entityManager->getConnection();
        $connection->beginTransaction();

        try {
            $media = (new MediaObject())
                ->setFilePath($storedFileName)
                ->setOriginalName($originalName)
                ->setMimeType($detectedMimeType)
                ->setSize(strlen($contents))
                ->setData($contents)
                ->setUploadedBy($user)
                ->setIsPublic(true);

            $entityManager->persist($media);
            $entityManager->flush();

            $contentUrl = $media->getContentUrl();
            if ($contentUrl === null) {
                throw new \RuntimeException('La photo televersee ne peut pas etre resolue.');
            }

            $user->setPhotoProfil($contentUrl);
            $entityManager->flush();
            $connection->commit();
        } catch (\Throwable $exception) {
            if ($connection->isTransactionActive()) {
                $connection->rollBack();
            }

            throw $exception;
        }

        $wsNotifier->broadcast([
            'event' => 'profile_photo_changed',
            'payload' => [
                'userId' => (string) $user->getId(),
                'photoProfil' => $contentUrl,
            ],
        ]);

        return $this->json([
            'id' => $media->getId(),
            'contentUrl' => $contentUrl,
            'photoProfil' => $contentUrl,
            'mimeType' => $media->getMimeType(),
            'size' => $media->getSize(),
            'width' => $width,
            'height' => $height,
        ], Response::HTTP_CREATED);
    }
}
