<?php

declare(strict_types=1);

namespace App\Serializer;

use Symfony\Component\HttpFoundation\RequestStack;
use Symfony\Component\Serializer\Encoder\DecoderInterface;

/**
 * Décodeur multipart/form-data pour API Platform.
 *
 * Sans ce décodeur, API Platform renvoie 400 « Deserialization for the format
 * "multipart" is not supported » car aucun encodeur Serializer n'est enregistré
 * pour ce format. Il extrait les champs du formulaire ET les fichiers téléversés.
 */
final class MultipartDecoder implements DecoderInterface
{
    public function __construct(private readonly RequestStack $requestStack)
    {
    }

    public function decode(string $data, string $format, array $context = []): ?array
    {
        $request = $this->requestStack->getCurrentRequest();
        if (!$request) {
            return null;
        }

        $result = $request->request->all();

        foreach ($request->files->all() as $key => $file) {
            $result[$key] = $file;
        }

        return $result;
    }

    public function supportsDecoding(string $format): bool
    {
        return 'multipart' === $format;
    }
}
