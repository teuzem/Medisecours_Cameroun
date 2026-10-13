<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Compte OAuth : identifiant Google (user.google_id) pour distinguer les
 * comptes connectés via Google des comptes à mot de passe.
 * 100 % idempotente (IF NOT EXISTS).
 */
final class Version20261013150000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Auth: google account identifier (user.google_id)';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE "user" ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE "user" DROP COLUMN IF EXISTS google_id');
    }
}
