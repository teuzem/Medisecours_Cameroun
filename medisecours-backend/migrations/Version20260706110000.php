<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260706110000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Ajoute la colonne created_at à la table user si elle n\'existe pas';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE "user" ADD IF NOT EXISTS created_at TIMESTAMP(0) WITHOUT TIME ZONE');
        $this->addSql('UPDATE "user" SET created_at = NOW() WHERE created_at IS NULL');
        $this->addSql('ALTER TABLE "user" ALTER COLUMN created_at SET NOT NULL');
        $this->addSql('ALTER TABLE "user" ALTER COLUMN created_at SET DEFAULT NOW()');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE "user" DROP created_at');
    }
}
