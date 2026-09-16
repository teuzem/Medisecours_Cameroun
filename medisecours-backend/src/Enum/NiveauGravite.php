<?php

declare(strict_types=1);

namespace App\Enum;

/**
 * Niveaux de gravité d'une maladie.
 * Utilisé dans l'entité Maladie — remplace les chaînes libres avec Assert\Choice.
 */
enum NiveauGravite: string
{
    case LEGERE   = 'LÉGÈRE';
    case MODEREE  = 'MODÉRÉE';
    case SEVERE   = 'SÉVÈRE';
    case CRITIQUE = 'CRITIQUE';
    case VARIABLE = 'VARIABLE';

    public function label(): string
    {
        return match($this) {
            self::LEGERE   => 'Légère',
            self::MODEREE  => 'Modérée',
            self::SEVERE   => 'Sévère',
            self::CRITIQUE => 'Critique',
            self::VARIABLE => 'Variable',
        };
    }

    public function color(): string
    {
        return match($this) {
            self::LEGERE   => '#10B981',
            self::MODEREE  => '#F59E0B',
            self::SEVERE   => '#EF4444',
            self::CRITIQUE => '#DC2626',
            self::VARIABLE => '#6B7280',
        };
    }
}
