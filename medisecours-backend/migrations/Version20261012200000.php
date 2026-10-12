<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Triage SOS : urgence vitale déclarée par le demandeur
 * (`demande_sos.urgence_vitale`). 100 % idempotente (IF NOT EXISTS).
 */
final class Version20261012200000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'SOS triage: demande_sos.urgence_vitale flag declared by the requester';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE demande_sos ADD COLUMN IF NOT EXISTS urgence_vitale BOOLEAN DEFAULT \'false\' NOT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE demande_sos DROP COLUMN IF EXISTS urgence_vitale');
    }
}
