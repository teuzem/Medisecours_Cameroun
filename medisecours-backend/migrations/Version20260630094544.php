<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20260630094544 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE maladie ADD causes TEXT DEFAULT NULL');
        $this->addSql('ALTER TABLE maladie ADD is_accident BOOLEAN DEFAULT NULL');
        $this->addSql('ALTER TABLE maladie ADD type_accident VARCHAR(255) DEFAULT NULL');
        $this->addSql('ALTER TABLE premier_soin ADD maladie_id INT DEFAULT NULL');
        $this->addSql('ALTER TABLE premier_soin ADD CONSTRAINT FK_AD8436B2B4B1C397 FOREIGN KEY (maladie_id) REFERENCES maladie (id)');
        $this->addSql('CREATE INDEX IDX_AD8436B2B4B1C397 ON premier_soin (maladie_id)');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE maladie DROP causes');
        $this->addSql('ALTER TABLE maladie DROP is_accident');
        $this->addSql('ALTER TABLE maladie DROP type_accident');
        $this->addSql('ALTER TABLE premier_soin DROP CONSTRAINT FK_AD8436B2B4B1C397');
        $this->addSql('DROP INDEX IDX_AD8436B2B4B1C397');
        $this->addSql('ALTER TABLE premier_soin DROP maladie_id');
    }
}
