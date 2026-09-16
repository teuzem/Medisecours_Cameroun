<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20260708105127 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE categorie ADD icone VARCHAR(100) DEFAULT NULL');
        $this->addSql("UPDATE categorie SET icone = 'heart' WHERE nom LIKE '%Cardiologie%' AND icone IS NULL");
        $this->addSql("UPDATE categorie SET icone = 'air-vent' WHERE nom LIKE '%Pneumologie%' AND icone IS NULL");
        $this->addSql("UPDATE categorie SET icone = 'brain' WHERE nom LIKE '%Neurologie%' AND icone IS NULL");
        $this->addSql("UPDATE categorie SET icone = 'utensils-crossed' WHERE (nom LIKE '%Gastroentérologie%' OR nom LIKE '%Gastro-entérologie%' OR nom LIKE '%Gastro%') AND icone IS NULL");
        $this->addSql("UPDATE categorie SET icone = 'bone' WHERE nom LIKE '%Orthopédie%' AND icone IS NULL");
        $this->addSql("UPDATE categorie SET icone = 'eye' WHERE nom LIKE '%Ophtalmologie%' AND icone IS NULL");
        $this->addSql("UPDATE categorie SET icone = 'ear' WHERE nom LIKE '%ORL%' AND icone IS NULL");
        $this->addSql("UPDATE categorie SET icone = 'scan-face' WHERE nom LIKE '%Dermatologie%' AND icone IS NULL");
        $this->addSql("UPDATE categorie SET icone = 'sparkles' WHERE nom LIKE '%Allergologie%' AND icone IS NULL");
        $this->addSql("UPDATE categorie SET icone = 'flame' WHERE nom LIKE '%Toxicologie%' AND icone IS NULL");
        $this->addSql("UPDATE categorie SET icone = 'bug' WHERE nom LIKE '%Infectiologie%' AND icone IS NULL");
        $this->addSql("UPDATE categorie SET icone = 'baby' WHERE nom LIKE '%Pédiatrie%' AND icone IS NULL");
        $this->addSql("UPDATE categorie SET icone = 'stethoscope' WHERE nom LIKE '%Médecine générale%' AND icone IS NULL");
        $this->addSql("UPDATE categorie SET icone = 'ambulance' WHERE nom LIKE '%Urgences vitales%' AND icone IS NULL");
        $this->addSql("UPDATE categorie SET icone = 'bandage' WHERE nom LIKE '%Traumatologie%' AND icone IS NULL");
        $this->addSql("UPDATE categorie SET icone = 'ribbon' WHERE nom LIKE '%Santé maternelle%' AND icone IS NULL");
        $this->addSql("UPDATE categorie SET icone = 'stethoscope' WHERE icone IS NULL");
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE categorie DROP icone');
    }
}
