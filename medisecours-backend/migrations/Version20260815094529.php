<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20260815094529 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE categorie ADD nom_en VARCHAR(255) DEFAULT NULL');
        $this->addSql('ALTER TABLE categorie ADD description_en TEXT DEFAULT NULL');
        $this->addSql('ALTER TABLE maladie ADD nom_en VARCHAR(255) DEFAULT NULL');
        $this->addSql('ALTER TABLE maladie ADD description_en TEXT DEFAULT NULL');
        $this->addSql('ALTER TABLE maladie ADD symptomes_en TEXT DEFAULT NULL');
        $this->addSql('ALTER TABLE maladie ADD precautions_en TEXT DEFAULT NULL');
        $this->addSql('ALTER TABLE maladie ADD traitement_en TEXT DEFAULT NULL');
        $this->addSql('ALTER TABLE maladie ADD causes_en TEXT DEFAULT NULL');
        $this->addSql('ALTER TABLE maladie ADD type_accident_en VARCHAR(255) DEFAULT NULL');
        $this->addSql('ALTER TABLE premier_soin ADD titre_en VARCHAR(255) DEFAULT NULL');
        $this->addSql('ALTER TABLE premier_soin ADD description_en TEXT DEFAULT NULL');
        $this->addSql('ALTER TABLE premier_soin ADD symptomes_en TEXT DEFAULT NULL');
        $this->addSql('ALTER TABLE protocole_etape ADD titre_en VARCHAR(160) DEFAULT NULL');
        $this->addSql('ALTER TABLE protocole_etape ADD instruction_en TEXT DEFAULT NULL');
        $this->addSql('ALTER TABLE protocole_premiers_gestes ADD titre_en VARCHAR(180) DEFAULT NULL');
        $this->addSql('ALTER TABLE protocole_premiers_gestes ADD restrictions_populations_en TEXT DEFAULT NULL');
        $this->addSql('ALTER TABLE protocole_premiers_gestes ADD source_clinique_en TEXT DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE categorie DROP nom_en');
        $this->addSql('ALTER TABLE categorie DROP description_en');
        $this->addSql('ALTER TABLE maladie DROP nom_en');
        $this->addSql('ALTER TABLE maladie DROP description_en');
        $this->addSql('ALTER TABLE maladie DROP symptomes_en');
        $this->addSql('ALTER TABLE maladie DROP precautions_en');
        $this->addSql('ALTER TABLE maladie DROP traitement_en');
        $this->addSql('ALTER TABLE maladie DROP causes_en');
        $this->addSql('ALTER TABLE maladie DROP type_accident_en');
        $this->addSql('ALTER TABLE premier_soin DROP titre_en');
        $this->addSql('ALTER TABLE premier_soin DROP description_en');
        $this->addSql('ALTER TABLE premier_soin DROP symptomes_en');
        $this->addSql('ALTER TABLE protocole_etape DROP titre_en');
        $this->addSql('ALTER TABLE protocole_etape DROP instruction_en');
        $this->addSql('ALTER TABLE protocole_premiers_gestes DROP titre_en');
        $this->addSql('ALTER TABLE protocole_premiers_gestes DROP restrictions_populations_en');
        $this->addSql('ALTER TABLE protocole_premiers_gestes DROP source_clinique_en');
    }
}
