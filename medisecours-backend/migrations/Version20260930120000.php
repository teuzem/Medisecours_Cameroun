<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260930120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add structured facility availability, accessibility and ambulance metadata.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE centre_de_sante ADD horaires_details JSON DEFAULT NULL');
        $this->addSql('ALTER TABLE centre_de_sante ADD accessibilite JSON NOT NULL DEFAULT \'[]\'');
        $this->addSql('ALTER TABLE centre_de_sante ADD ambulances_disponibles BOOLEAN NOT NULL DEFAULT FALSE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE centre_de_sante DROP horaires_details');
        $this->addSql('ALTER TABLE centre_de_sante DROP accessibilite');
        $this->addSql('ALTER TABLE centre_de_sante DROP ambulances_disponibles');
    }
}
