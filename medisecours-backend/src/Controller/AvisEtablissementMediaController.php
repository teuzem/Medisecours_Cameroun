<?php

declare(strict_types=1);

namespace App\Controller;

use App\Entity\AvisEtablissement;
use App\Entity\CentreDeSante;
use App\Entity\MediaObject;
use App\Entity\User;
use App\Repository\AvisEtablissementRepository;
use App\Service\ExternalVideoParser;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;

final class AvisEtablissementMediaController extends AbstractController
{
    private const MAX_IMAGES = 5;
    private const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
    private const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
    private const MAX_VIDEOS = 1;
    private const MAX_VIDEO_BYTES = 30 * 1024 * 1024;
    private const ALLOWED_VIDEO_MIME_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

    #[Route('/api/avis_etablissements/avec-images', name: 'api_avis_etablissement_with_images', methods: ['POST'])]
    public function __invoke(
        Request $request,
        EntityManagerInterface $entityManager,
        AvisEtablissementRepository $reviewRepository,
    ): JsonResponse {
        $user = $this->getUser();
        if (!$user instanceof User) {
            return new JsonResponse(['error' => 'Un compte est requis pour laisser un avis.'], Response::HTTP_UNAUTHORIZED);
        }

        $centreId = filter_var($request->request->get('centre'), FILTER_VALIDATE_INT);
        $note = filter_var($request->request->get('note'), FILTER_VALIDATE_INT);
        $comment = trim((string) $request->request->get('commentaire', ''));
        if ($centreId === false || $note === false || $note < 1 || $note > 5) {
            return new JsonResponse(['error' => 'Etablissement ou note invalide.'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }
        if ($comment !== '' && (mb_strlen($comment) < 5 || mb_strlen($comment) > 2000)) {
            return new JsonResponse(['error' => 'Le commentaire doit contenir entre 5 et 2000 caracteres.'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $centre = $entityManager->getRepository(CentreDeSante::class)->find($centreId);
        if (!$centre) {
            return new JsonResponse(['error' => 'Etablissement introuvable.'], Response::HTTP_NOT_FOUND);
        }

        $images = array_values(array_filter(
            (array) ($request->files->all('images') ?? []),
            static fn (mixed $file): bool => $file instanceof UploadedFile
        ));
        $videos = array_values(array_filter(
            (array) ($request->files->all('videos') ?? []),
            static fn (mixed $file): bool => $file instanceof UploadedFile
        ));
        // Rétro-compatibilité : un champ unique `video` est accepté comme alias de `videos[]`.
        $singleVideo = $request->files->get('video');
        if ($singleVideo instanceof UploadedFile && $videos === []) {
            $videos = [$singleVideo];
        }
        $videoUrl = trim((string) $request->request->get('videoUrl', ''));

        if ($images === [] && $videos === [] && $videoUrl === '') {
            return new JsonResponse(
                ['error' => 'Ajoutez au moins une image, une vidéo ou un lien vidéo.'],
                Response::HTTP_UNPROCESSABLE_ENTITY
            );
        }
        if (count($images) > self::MAX_IMAGES) {
            return new JsonResponse(['error' => 'Maximum 5 images JPEG, PNG ou WebP de 2 Mo chacune.'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }
        foreach ($images as $image) {
            if (!$image->isValid()) {
                return new JsonResponse(['error' => 'Une image televersee est invalide.'], Response::HTTP_UNPROCESSABLE_ENTITY);
            }
            $mimeType = strtolower((string) ($image->getMimeType() ?: $image->getClientMimeType()));
            if (!in_array($mimeType, self::ALLOWED_IMAGE_MIME_TYPES, true) || ($image->getSize() ?? 0) > self::MAX_IMAGE_BYTES) {
                return new JsonResponse(['error' => 'Maximum 5 images JPEG, PNG ou WebP de 2 Mo chacune.'], Response::HTTP_UNPROCESSABLE_ENTITY);
            }
        }
        if (count($videos) > self::MAX_VIDEOS) {
            return new JsonResponse(['error' => 'Une seule vidéo par avis (30 Mo maximum).'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }
        foreach ($videos as $video) {
            if (!$video->isValid()) {
                return new JsonResponse(['error' => 'La vidéo téléversée est invalide.'], Response::HTTP_UNPROCESSABLE_ENTITY);
            }
            $mimeType = strtolower((string) ($video->getMimeType() ?: $video->getClientMimeType()));
            if (!in_array($mimeType, self::ALLOWED_VIDEO_MIME_TYPES, true)) {
                return new JsonResponse(['error' => 'Vidéo refusée. Utilisez MP4, WebM ou MOV.'], Response::HTTP_UNPROCESSABLE_ENTITY);
            }
            if (($video->getSize() ?? 0) > self::MAX_VIDEO_BYTES) {
                return new JsonResponse(['error' => 'La vidéo ne doit pas dépasser 30 Mo.'], Response::HTTP_UNPROCESSABLE_ENTITY);
            }
        }
        $parsedVideo = null;
        if ($videoUrl !== '') {
            $parsedVideo = ExternalVideoParser::parse($videoUrl);
            if ($parsedVideo === null) {
                return new JsonResponse(
                    ['error' => 'Lien vidéo non pris en charge. Utilisez YouTube, TikTok, Instagram, Facebook, Vimeo ou Dailymotion.'],
                    Response::HTTP_UNPROCESSABLE_ENTITY
                );
            }
        }

        $connection = $entityManager->getConnection();
        $connection->beginTransaction();
        try {
            $review = (new AvisEtablissement())
                ->setEtablissement($centre)
                ->setUser($user)
                ->setNote($note)
                ->setCommentaire($comment !== '' ? $comment : null)
                ->setStatut('PUBLIE')
                ->setUpdatedAt(new \DateTimeImmutable());
            $entityManager->persist($review);

            foreach ($images as $image) {
                $media = $this->createFileMedia($image, $user);
                $media->setAvis($review);
                $review->addImage($media);
                $entityManager->persist($media);
            }
            foreach ($videos as $video) {
                $media = $this->createFileMedia($video, $user);
                $media->setAvis($review);
                $review->addImage($media);
                $entityManager->persist($media);
            }
            if ($parsedVideo !== null) {
                $external = (new MediaObject())
                    ->setExternalUrl($parsedVideo['watchUrl'])
                    ->setProvider($parsedVideo['provider'])
                    ->setEmbedUrl($parsedVideo['embedUrl'])
                    ->setThumbnailUrl($parsedVideo['thumbnailUrl'])
                    ->setOriginalName($parsedVideo['watchUrl'])
                    ->setMimeType('video/' . $parsedVideo['provider'])
                    ->setSize(null)
                    ->setIsPublic(true)
                    ->setPurpose(MediaObject::PURPOSE_REVIEW_IMAGE)
                    ->setUploadedBy($user)
                    ->setAvis($review);
                $review->addImage($external);
                $entityManager->persist($external);
            }

            $entityManager->flush();
            $reviewRepository->refreshAggregates($centre);
            $connection->commit();

            return new JsonResponse([
                'id' => $review->getId(),
                'note' => $review->getNote(),
                'commentaire' => $review->getCommentaire(),
                'statut' => $review->getStatut(),
                'createdAt' => $review->getCreatedAt()->format(DATE_ATOM),
            ], Response::HTTP_CREATED);
        } catch (\Throwable $exception) {
            if ($connection->isTransactionActive()) {
                $connection->rollBack();
            }

            return new JsonResponse(['error' => 'Impossible de publier cet avis.'], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    private function createFileMedia(UploadedFile $file, User $user): MediaObject
    {
        $binary = file_get_contents($file->getPathname());
        if ($binary === false || $binary === '') {
            throw new \RuntimeException('Un fichier est vide ou illisible.');
        }
        $mimeType = strtolower((string) ($file->getMimeType() ?: $file->getClientMimeType()));
        $extension = match ($mimeType) {
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp',
            'video/mp4' => 'mp4',
            'video/webm' => 'webm',
            'video/quicktime' => 'mov',
            default => throw new \RuntimeException('Format de fichier invalide.'),
        };

        return (new MediaObject())
            ->setFilePath(bin2hex(random_bytes(16)) . '.' . $extension)
            ->setOriginalName($file->getClientOriginalName())
            ->setMimeType($mimeType)
            ->setSize(strlen($binary))
            ->setData($binary)
            ->setIsPublic(true)
            ->setPurpose(MediaObject::PURPOSE_REVIEW_IMAGE)
            ->setUploadedBy($user);
    }
}
