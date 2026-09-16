<?php

namespace App\Controller\Api;

use App\Entity\MediaObject;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\RateLimiter\RateLimiterFactory;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

#[Route('/api/messages')]
class UploadMessageMediaController extends AbstractController
{
    #[Route('/media/upload', name: 'api_message_media_upload', methods: ['POST'])]
    #[IsGranted('ROLE_USER')]
    public function upload(
        Request $request,
        EntityManagerInterface $em,
        #[Autowire(service: 'limiter.media_upload')] RateLimiterFactory $mediaLimiter
    ): JsonResponse
    {
        $user = $this->getUser();
        $limit = $mediaLimiter->create((string) $user?->getUserIdentifier())->consume(1);
        if (!$limit->isAccepted()) {
            return $this->json([
                'error' => 'Trop de fichiers envoyés. Réessayez dans quelques instants.',
            ], Response::HTTP_TOO_MANY_REQUESTS);
        }

        $file = $request->files->get('file');

        if (!$file instanceof UploadedFile) {
            return $this->json(['error' => 'Aucun fichier fourni.'], Response::HTTP_BAD_REQUEST);
        }

        $maxSize = 25 * 1024 * 1024;
        if ($file->getSize() > $maxSize) {
            return $this->json(['error' => 'Fichier trop volumineux (maximum 25 Mo).'], Response::HTTP_BAD_REQUEST);
        }

        $allowedMimeTypes = [
            'image/jpeg',
            'image/png',
            'image/webp',
            'application/pdf',
            'audio/mpeg',
            'audio/ogg',
            'audio/webm',
            'video/mp4',
            'video/webm',
            'video/ogg',
            'video/quicktime',
        ];
        $mime = $file->getMimeType();
        if (!in_array($mime, $allowedMimeTypes, true)) {
            return $this->json(['error' => 'Type de fichier non autorisé.'], Response::HTTP_BAD_REQUEST);
        }

        if (str_starts_with((string) $mime, 'image/')) {
            $imageInfo = @getimagesize($file->getPathname());
            if ($imageInfo === false || ($imageInfo[0] * $imageInfo[1]) > 40_000_000) {
                return $this->json([
                    'error' => 'Image invalide ou dimensions excessives.',
                ], Response::HTTP_BAD_REQUEST);
            }
        }

        $dailyBytes = (int) $em->getRepository(MediaObject::class)->createQueryBuilder('media')
            ->select('COALESCE(SUM(media.size), 0)')
            ->where('media.uploadedBy = :user')
            ->andWhere('media.createdAt >= :start')
            ->setParameter('user', $user)
            ->setParameter('start', new \DateTimeImmutable('today'))
            ->getQuery()
            ->getSingleScalarResult();
        if ($dailyBytes + (int) $file->getSize() > 100 * 1024 * 1024) {
            return $this->json([
                'error' => 'Quota quotidien de médias atteint (100 Mo).',
            ], Response::HTTP_TOO_MANY_REQUESTS);
        }

        $media = new MediaObject();
        $media->setFile($file);
        $media->setUploadedBy($user);
        $media->setIsPublic(false);

        $em->persist($media);
        $em->flush();

        return $this->json([
            '@id' => '/api/media_objects/' . $media->getId(),
            'id' => $media->getId(),
            'contentUrl' => '/api/media_objects/' . $media->getId() . '/download',
            'originalName' => $media->getOriginalName(),
            'mimeType' => $media->getMimeType(),
            'size' => $media->getSize(),
        ]);
    }
}
