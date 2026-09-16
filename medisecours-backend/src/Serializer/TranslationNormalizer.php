<?php

declare(strict_types=1);

namespace App\Serializer;

use Symfony\Component\HttpFoundation\RequestStack;
use Symfony\Component\Serializer\Normalizer\NormalizerAwareInterface;
use Symfony\Component\Serializer\Normalizer\NormalizerAwareTrait;
use Symfony\Component\Serializer\Normalizer\NormalizerInterface;

final class TranslationNormalizer implements NormalizerInterface, NormalizerAwareInterface
{
    use NormalizerAwareTrait;

    private const ALREADY_CALLED = 'TRANSLATION_NORMALIZER_ALREADY_CALLED';

    public function __construct(private readonly RequestStack $requestStack)
    {
    }

    public function supportsNormalization(mixed $data, ?string $format = null, array $context = []): bool
    {
        // On évite la boucle infinie
        if (isset($context[self::ALREADY_CALLED])) {
            return false;
        }

        return $data instanceof \App\Entity\Maladie || 
               $data instanceof \App\Entity\Categorie || 
               $data instanceof \App\Entity\PremierSoin;
    }

    public function normalize(mixed $object, ?string $format = null, array $context = []): array|string|int|float|bool|\ArrayObject|null
    {
        $context[self::ALREADY_CALLED] = true;

        $data = $this->normalizer->normalize($object, $format, $context);

        $request = $this->requestStack->getCurrentRequest();
        $locale = 'fr';
        
        if ($request !== null) {
            $header = (string) $request->headers->get('Accept-Language', '');
            foreach (explode(',', $header) as $part) {
                $lang = strtolower(trim(explode(';', $part)[0]));
                $lang = explode('-', $lang)[0];
                if ($lang === 'en') {
                    $locale = 'en';
                    break;
                }
                if ($lang === 'fr') {
                    $locale = 'fr';
                    break;
                }
            }
        }

        if ($locale === 'en' && is_array($data)) {
            $fields = [];
            if ($object instanceof \App\Entity\Maladie) {
                $fields = [
                    'nom' => 'getNomEn',
                    'description' => 'getDescriptionEn',
                    'symptomes' => 'getSymptomesEn',
                    'precautions' => 'getPrecautionsEn',
                    'traitement' => 'getTraitementEn',
                    'causes' => 'getCausesEn',
                    'typeAccident' => 'getTypeAccidentEn',
                ];
            } elseif ($object instanceof \App\Entity\Categorie) {
                $fields = [
                    'nom' => 'getNomEn',
                    'description' => 'getDescriptionEn',
                ];
            } elseif ($object instanceof \App\Entity\PremierSoin) {
                $fields = [
                    'titre' => 'getTitreEn',
                    'description' => 'getDescriptionEn',
                    'symptomes' => 'getSymptomesEn',
                ];
            }

            foreach ($fields as $field => $getter) {
                if (isset($data[$field]) && method_exists($object, $getter)) {
                    $englishValue = $object->$getter();
                    if (!empty($englishValue)) {
                        $data[$field] = $englishValue;
                    }
                }
            }
        }

        return $data;
    }

    public function getSupportedTypes(?string $format): array
    {
        return [
            \App\Entity\Maladie::class => true,
            \App\Entity\Categorie::class => true,
            \App\Entity\PremierSoin::class => true,
        ];
    }
}
