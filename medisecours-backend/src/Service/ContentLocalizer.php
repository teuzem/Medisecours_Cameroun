<?php

declare(strict_types=1);

namespace App\Service;

/**
 * Sélectionne le texte localisé : renvoie la version anglaise quand elle
 * existe et que le client demande l'anglais, sinon la version française.
 */
final class ContentLocalizer
{
    public function __construct(private readonly LocaleResolver $localeResolver)
    {
    }

    public function pick(string $french, ?string $english): string
    {
        if ($this->localeResolver->isEnglish() && $english !== null && trim($english) !== '') {
            return $english;
        }

        return $french;
    }

    public function pickNullable(?string $french, ?string $english): ?string
    {
        if ($this->localeResolver->isEnglish() && $english !== null && trim($english) !== '') {
            return $english;
        }

        return $french;
    }
}
