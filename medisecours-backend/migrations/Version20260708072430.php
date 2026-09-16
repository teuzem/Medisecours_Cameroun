<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20260708072430 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE centre_de_sante ADD email VARCHAR(255) DEFAULT NULL');
        $this->addSql('ALTER TABLE centre_de_sante ADD site_web VARCHAR(255) DEFAULT NULL');
        $this->addSql('ALTER TABLE centre_de_sante ADD statut VARCHAR(50) DEFAULT \'prive\' NOT NULL');
        $this->addSql('ALTER TABLE centre_de_sante ADD quartier VARCHAR(255) DEFAULT NULL');
        $this->addSql('ALTER TABLE "user" ALTER created_at DROP DEFAULT');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE centre_de_sante DROP email');
        $this->addSql('ALTER TABLE centre_de_sante DROP site_web');
        $this->addSql('ALTER TABLE centre_de_sante DROP statut');
        $this->addSql('ALTER TABLE centre_de_sante DROP quartier');
        $this->addSql('ALTER TABLE "user" ALTER created_at SET DEFAULT \'now()\'');
    }
}
