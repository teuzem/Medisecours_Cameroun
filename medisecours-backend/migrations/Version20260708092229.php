<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20260708092229 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE media_object ADD categorie_id INT DEFAULT NULL');
        $this->addSql('ALTER TABLE media_object ADD maladie_id INT DEFAULT NULL');
        $this->addSql('ALTER TABLE media_object ADD CONSTRAINT FK_14D43132BCF5E72D FOREIGN KEY (categorie_id) REFERENCES categorie (id) ON DELETE SET NULL NOT DEFERRABLE');
        $this->addSql('ALTER TABLE media_object ADD CONSTRAINT FK_14D43132B4B1C397 FOREIGN KEY (maladie_id) REFERENCES maladie (id) ON DELETE SET NULL NOT DEFERRABLE');
        $this->addSql('CREATE INDEX IDX_14D43132BCF5E72D ON media_object (categorie_id)');
        $this->addSql('CREATE INDEX IDX_14D43132B4B1C397 ON media_object (maladie_id)');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE media_object DROP CONSTRAINT FK_14D43132BCF5E72D');
        $this->addSql('ALTER TABLE media_object DROP CONSTRAINT FK_14D43132B4B1C397');
        $this->addSql('DROP INDEX IDX_14D43132BCF5E72D');
        $this->addSql('DROP INDEX IDX_14D43132B4B1C397');
        $this->addSql('ALTER TABLE media_object DROP categorie_id');
        $this->addSql('ALTER TABLE media_object DROP maladie_id');
    }
}
