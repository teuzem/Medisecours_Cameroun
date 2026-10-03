<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261003110000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add configurable health facility logo URL.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE centre_de_sante ADD logo_url VARCHAR(500) DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE centre_de_sante DROP logo_url');
    }
}
