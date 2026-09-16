<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260805140000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Ajoute un titre court facultatif aux étapes des protocoles de premiers secours.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE protocole_etape ADD titre VARCHAR(160) DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE protocole_etape DROP titre');
    }
}
