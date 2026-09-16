<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260801151000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Aligne le nom de l’index des étapes de protocole avec Doctrine.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            DO $$
            BEGIN
                IF to_regclass('idx_protocole_etape_protocole') IS NOT NULL
                   AND to_regclass('idx_e30866eff77fb932') IS NULL THEN
                    ALTER INDEX idx_protocole_etape_protocole RENAME TO IDX_E30866EFF77FB932;
                END IF;
            END
            $$;
        SQL);
    }

    public function down(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            DO $$
            BEGIN
                IF to_regclass('idx_e30866eff77fb932') IS NOT NULL
                   AND to_regclass('idx_protocole_etape_protocole') IS NULL THEN
                    ALTER INDEX IDX_E30866EFF77FB932 RENAME TO idx_protocole_etape_protocole;
                END IF;
            END
            $$;
        SQL);
    }
}
