<?php

declare(strict_types=1);

namespace App\Controller\Api;

use App\Entity\MediaObject;
use App\Entity\Message;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\ResponseHeaderBag;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\Routing\Annotation\Route;

final class MediaDownloadController extends AbstractController
{
    #[Route('/api/media_objects/{id}/download', name: 'api_media_download', methods: ['GET'])]
    public function __invoke(MediaObject $media, EntityManagerInterface $entityManager): Response
    {
        $user = $this->getUser();
        if (!$media->isPublic() && !$this->canReadPrivateMedia($media, $entityManager, $user instanceof User ? $user : null)) {
            throw $this->createAccessDeniedException('Vous ne pouvez pas accéder à ce fichier.');
        }

        $fileName = $media->getFilePath();
        if (!$fileName || basename($fileName) !== $fileName) {
            throw new NotFoundHttpException('Fichier introuvable.');
        }

        $data = $media->getData();
        if ($data !== null && $data !== '') {
            return $this->binaryResponse($data, $media);
        }

        $path = dirname(__DIR__, 3) . '/var/uploads/media/' . $fileName;
        if (!is_file($path)) {
            throw new NotFoundHttpException('Fichier introuvable.');
        }

        return new BinaryFileResponse($path);
    }

    private function binaryResponse(string $data, MediaObject $media): Response
    {
        $response = new Response($data);
        $response->headers->set('Content-Type', $media->getMimeType() ?? 'application/octet-stream');
        $response->headers->set('Content-Length', (string) strlen($data));
        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('Content-Security-Policy', "default-src 'none'; sandbox");
        $response->headers->set(
            'Cache-Control',
            $media->isPublic() ? 'public, max-age=86400, immutable' : 'private, no-store'
        );
        $disposition = $media->getMimeType() === 'application/pdf'
            ? ResponseHeaderBag::DISPOSITION_ATTACHMENT
            : ResponseHeaderBag::DISPOSITION_INLINE;
        $originalName = $media->getOriginalName() ?? 'document';
        $fallback = preg_replace('/[^A-Za-z0-9._-]+/', '_', $originalName);
        $fallback = trim($fallback, '_');
        if ($fallback === '') {
            $fallback = 'document';
        }
        $response->headers->set('Content-Disposition', $response->headers->makeDisposition($disposition, $originalName, $fallback));

        return $response;
    }

    private function canReadPrivateMedia(MediaObject $media, EntityManagerInterface $entityManager, ?User $user): bool
    {
        if (!$user) {
            return false;
        }
        if ($this->isGranted('ROLE_ADMIN')) {
            return true;
        }
        if ($media->isIdentityVerificationMedia()) {
            return false;
        }
        if ($media->getUploadedBy() === $user) {
            return true;
        }

        $message = $entityManager->getRepository(Message::class)->findOneBy(['media' => $media]);

        return $message !== null && $message->getConversation()?->getParticipants()->contains($user);
    }
}
