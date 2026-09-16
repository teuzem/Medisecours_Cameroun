<?php

namespace App\Controller\Admin;

use App\Entity\Maladie;
use App\Entity\MediaObject;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/admin/maladies')]
#[IsGranted('ROLE_ADMIN')]
class UploadMaladieImageController extends AbstractController
{
    #[Route('/{id}/images', name: 'admin_upload_maladie_images', methods: ['POST'])]
    public function uploadImages(Maladie $maladie, Request $request, EntityManagerInterface $em): JsonResponse
    {
        try {
            $submitted = $request->files->get('files', []);
            if (!is_array($submitted)) {
                $submitted = [$submitted];
            }
            $submitted = array_values(array_filter($submitted, fn($f) => $f instanceof UploadedFile));

            if (empty($submitted)) {
                return $this->json(['error' => 'Aucun fichier fourni.'], Response::HTTP_BAD_REQUEST);
            }

            if (count($submitted) > 10) {
                return $this->json(['error' => 'Maximum 10 images par upload.'], Response::HTTP_BAD_REQUEST);
            }

            $allowedMime = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
            $allowedExt = ['jpeg', 'jpg', 'png', 'webp', 'gif'];
            $uploaded = [];

            foreach ($submitted as $file) {
                $ext = strtolower($file->getClientOriginalExtension());
                if (!in_array($ext, $allowedExt, true)) continue;
                if (!in_array($file->getMimeType(), $allowedMime, true)) continue;
                if ($file->getSize() > 10 * 1024 * 1024) continue;

                $media = new MediaObject();
                $media->setFile($file);
                $media->setUploadedBy($this->getUser());
                $media->setMaladie($maladie);

                $em->persist($media);
                $uploaded[] = $media;
            }

            if (empty($uploaded)) {
                return $this->json(['error' => 'Aucune image valide (JPEG, PNG, WebP, GIF max 10 MB).'], Response::HTTP_BAD_REQUEST);
            }

            $em->flush();

            $items = array_map(fn(MediaObject $m) => [
                'id'           => $m->getId(),
                'url'          => $m->getContentUrl(),
                'originalName' => $m->getOriginalName(),
                'filePath'     => $m->getFilePath(),
            ], $uploaded);

            return $this->json([
                'success' => true,
                'message' => count($items) . ' image(s) uploadée(s).',
                'images'  => $items,
            ]);
        } catch (\Throwable $e) {
            return $this->json(['error' => $e->getMessage()], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    #[Route('/{id}/images/{imageId}', name: 'admin_delete_maladie_image', methods: ['DELETE'])]
    public function deleteImage(Maladie $maladie, int $imageId, EntityManagerInterface $em): JsonResponse
    {
        $media = $em->getRepository(MediaObject::class)->findOneBy([
            'id' => $imageId,
            'maladie' => $maladie,
        ]);

        if (!$media) {
            return $this->json(['error' => 'Image introuvable.'], Response::HTTP_NOT_FOUND);
        }

        $em->remove($media);
        $em->flush();

        return $this->json(['success' => true, 'message' => 'Image supprimée.']);
    }
}
