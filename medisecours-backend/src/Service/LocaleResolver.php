<?php

declare(strict_types=1);

namespace App\Service;

use Symfony\Component\HttpFoundation\RequestStack;

/**
 * Résout la langue demandée par le client à partir de l'en-tête
 * Accept-Language (envoyé par le frontend) ou du paramètre _locale.
 */
final class LocaleResolver
{
    private const SUPPORTED = ['fr', 'en'];

    public function __construct(private readonly RequestStack $requestStack)
    {
    }

    public function current(): string
    {
        $request = $this->requestStack->getCurrentRequest();
        if ($request === null) {
            return 'fr';
        }

        $explicit = $request->query->get('_locale');
        if (is_string($explicit) && $explicit !== '' && in_array($explicit, self::SUPPORTED, true)) {
            return $explicit;
        }

        $header = (string) $request->headers->get('Accept-Language', '');
        if ($header === '') {
            return 'fr';
        }

        // Forme: "fr-FR,fr;q=0.9,en;q=0.8" — on prend la langue préférée.
        foreach (explode(',', $header) as $part) {
            $lang = strtolower(trim(explode(';', $part)[0]));
            $lang = explode('-', $lang)[0];
            if ($lang === 'en') {
                return 'en';
            }
            if ($lang === 'fr') {
                return 'fr';
            }
        }

        return 'fr';
    }

    public function isEnglish(): bool
    {
        return $this->current() === 'en';
    }
}
