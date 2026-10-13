<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Consultations : canal présentiel / téléconsultation (consultation.mode).
 * 100 % idempotente (IF NOT EXISTS).
 */
final class Version20261013140000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Consultations: presentiel vs teleconsultation channel (consultation.mode)';
    }

    public function up(Schema $schema): void
    {
        $this->addSql("ALTER TABLE consultation ADD COLUMN IF NOT EXISTS mode VARCHAR(20) DEFAULT 'PRESENTIEL' NOT NULL");
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE consultation DROP COLUMN IF EXISTS mode');
    }
}
