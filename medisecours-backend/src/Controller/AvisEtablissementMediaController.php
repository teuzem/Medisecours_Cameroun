<?php

declare(strict_types=1);

namespace App\Controller;

use App\Entity\AvisEtablissement;
use App\Entity\CentreDeSante;
use App\Entity\MediaObject;
use App\Entity\User;
use App\Repository\AvisEtablissementRepository;
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
    private const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

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

        $images = $request->files->all('images');
        if (!$images || count($images) > self::MAX_IMAGES) {
            return new JsonResponse(['error' => 'Ajoutez entre 1 et 5 images.'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }
        foreach ($images as $image) {
            if (!$image instanceof UploadedFile || !$image->isValid()) {
                return new JsonResponse(['error' => 'Une image televersee est invalide.'], Response::HTTP_UNPROCESSABLE_ENTITY);
            }
            $mimeType = strtolower((string) ($image->getMimeType() ?: $image->getClientMimeType()));
            if (!in_array($mimeType, self::ALLOWED_MIME_TYPES, true) || ($image->getSize() ?? 0) > self::MAX_IMAGE_BYTES) {
                return new JsonResponse(['error' => 'Maximum 5 images JPEG, PNG ou WebP de 2 Mo chacune.'], Response::HTTP_UNPROCESSABLE_ENTITY);
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
                $binary = file_get_contents($image->getPathname());
                if ($binary === false || $binary === '') {
                    throw new \RuntimeException('Une image est vide ou illisible.');
                }
                $mimeType = strtolower((string) ($image->getMimeType() ?: $image->getClientMimeType()));
                $extension = match ($mimeType) {
                    'image/jpeg' => 'jpg',
                    'image/png' => 'png',
                    'image/webp' => 'webp',
                    default => throw new \RuntimeException('Format image invalide.'),
                };
                $media = (new MediaObject())
                    ->setFilePath(bin2hex(random_bytes(16)).'.'.$extension)
                    ->setOriginalName($image->getClientOriginalName())
                    ->setMimeType($mimeType)
                    ->setSize(strlen($binary))
                    ->setData($binary)
                    ->setIsPublic(true)
                    ->setPurpose(MediaObject::PURPOSE_REVIEW_IMAGE)
                    ->setUploadedBy($user)
                    ->setAvis($review);
                $review->addImage($media);
                $entityManager->persist($media);
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
}
