<?php

declare(strict_types=1);

namespace App\Service;

use App\Entity\MediaObject;
use App\Entity\User;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;

final class IdentityDocumentStorage
{
    private const MAX_FILE_SIZE = 5 * 1024 * 1024;
    private const MAX_DIMENSION = 6000;
    private const MAX_PIXELS = 24_000_000;
    private const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

    public function createIdentityDocument(UploadedFile $file, User $owner): MediaObject
    {
        return $this->createMedia(
            $file,
            $owner,
            MediaObject::PURPOSE_IDENTITY_DOCUMENT,
            self::IMAGE_MIME_TYPES,
            'piece-identite'
        );
    }

    public function createVerificationPhoto(UploadedFile $file, User $owner): MediaObject
    {
        return $this->createMedia(
            $file,
            $owner,
            MediaObject::PURPOSE_IDENTITY_PHOTO,
            self::IMAGE_MIME_TYPES,
            'photo-verification'
        );
    }

    /**
     * @param list<string> $allowedMimeTypes
     */
    private function createMedia(
        UploadedFile $file,
        User $owner,
        string $purpose,
        array $allowedMimeTypes,
        string $defaultName
    ): MediaObject {
        if (!$file->isValid()) {
            throw new UnprocessableEntityHttpException('Le fichier transmis est invalide.');
        }
        if ((int) $file->getSize() > self::MAX_FILE_SIZE) {
            throw new UnprocessableEntityHttpException('Chaque justificatif doit peser au maximum 5 Mo.');
        }

        $mimeType = $file->getMimeType();
        if (!is_string($mimeType) || !in_array($mimeType, $allowedMimeTypes, true)) {
            throw new UnprocessableEntityHttpException(
                $purpose === MediaObject::PURPOSE_IDENTITY_DOCUMENT
                    ? 'La pièce d’identité doit être une image JPEG, PNG ou WebP.'
                    : 'La photo de vérification doit être une image JPEG, PNG ou WebP.'
            );
        }

        if (in_array($mimeType, self::IMAGE_MIME_TYPES, true)) {
            $this->validateImage($file, $mimeType);
        }

        $contents = @file_get_contents($file->getPathname());
        if ($contents === false || $contents === '') {
            throw new UnprocessableEntityHttpException('Le fichier ne peut pas être lu.');
        }

        $extension = match ($mimeType) {
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp',
            default => throw new \LogicException('Format de justificatif non pris en charge.'),
        };
        $originalName = basename(trim($file->getClientOriginalName()));
        if ($originalName === '' || $originalName === '.' || $originalName === '..') {
            $originalName = $defaultName.'.'.$extension;
        }

        return (new MediaObject())
            ->setFilePath(bin2hex(random_bytes(20)).'.'.$extension)
            ->setOriginalName($originalName)
            ->setMimeType($mimeType)
            ->setSize(strlen($contents))
            ->setData($contents)
            ->setUploadedBy($owner)
            ->setIsPublic(false)
            ->setPurpose($purpose);
    }

    private function validateImage(UploadedFile $file, string $mimeType): void
    {
        $imageInfo = @getimagesize($file->getPathname());
        if ($imageInfo === false) {
            throw new UnprocessableEntityHttpException('Le fichier ne contient pas une image valide.');
        }

        [$width, $height] = $imageInfo;
        if (
            $width < 1
            || $height < 1
            || $width > self::MAX_DIMENSION
            || $height > self::MAX_DIMENSION
            || ($width * $height) > self::MAX_PIXELS
        ) {
            throw new UnprocessableEntityHttpException(
                'Les dimensions de l’image dépassent la limite de 6000 px ou 24 mégapixels.'
            );
        }

        $detectedMimeType = image_type_to_mime_type((int) $imageInfo[2]);
        if ($detectedMimeType !== $mimeType || !in_array($detectedMimeType, self::IMAGE_MIME_TYPES, true)) {
            throw new UnprocessableEntityHttpException('Le contenu de l’image ne correspond pas à son format.');
        }
    }
}
