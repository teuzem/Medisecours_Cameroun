<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260706120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Ajoute les colonnes actif et banni à la table user';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE "user" ADD COLUMN IF NOT EXISTS actif BOOLEAN DEFAULT true NOT NULL');
        $this->addSql('ALTER TABLE "user" ADD COLUMN IF NOT EXISTS banni BOOLEAN DEFAULT false NOT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE "user" DROP COLUMN actif');
        $this->addSql('ALTER TABLE "user" DROP COLUMN banni');
    }
}
