<?php

declare(strict_types=1);

namespace App\Enum;

/**
 * Niveaux d'urgence d'un premier soin.
 * Utilisé dans l'entité PremierSoin — remplace les chaînes libres avec Assert\Choice.
 */
enum NiveauUrgence: string
{
    case FAIBLE   = 'FAIBLE';
    case MOYEN    = 'MOYEN';
    case ELEVE    = 'ÉLEVÉ';
    case CRITIQUE = 'CRITIQUE';

    public function label(): string
    {
        return match($this) {
            self::FAIBLE   => 'Faible',
            self::MOYEN    => 'Moyen',
            self::ELEVE    => 'Élevé',
            self::CRITIQUE => 'Critique',
        };
    }

    public function color(): string
    {
        return match($this) {
            self::FAIBLE   => '#10B981',
            self::MOYEN    => '#F59E0B',
            self::ELEVE    => '#EF4444',
            self::CRITIQUE => '#DC2626',
        };
    }
}
