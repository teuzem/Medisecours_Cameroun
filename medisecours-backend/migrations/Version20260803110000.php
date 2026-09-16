<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260803110000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Ajoute la categorie et les adaptations de population aux protocoles de premiers gestes.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql("ALTER TABLE protocole_premiers_gestes ADD categorie VARCHAR(60) DEFAULT NULL");
        $this->addSql("ALTER TABLE protocole_premiers_gestes ADD restrictions_populations TEXT DEFAULT NULL");
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE protocole_premiers_gestes DROP restrictions_populations');
        $this->addSql('ALTER TABLE protocole_premiers_gestes DROP categorie');
    }
}
