<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Allows a health establishment to be created during registration before
 * its coordinates are enriched by the maps synchronization service.
 */
final class Version20260918130000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Make health-centre coordinates optional for manual establishment registration.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE centre_de_sante ALTER latitude DROP NOT NULL');
        $this->addSql('ALTER TABLE centre_de_sante ALTER longitude DROP NOT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('UPDATE centre_de_sante SET latitude = 0, longitude = 0 WHERE latitude IS NULL OR longitude IS NULL');
        $this->addSql('ALTER TABLE centre_de_sante ALTER latitude SET NOT NULL');
        $this->addSql('ALTER TABLE centre_de_sante ALTER longitude SET NOT NULL');
    }
}
