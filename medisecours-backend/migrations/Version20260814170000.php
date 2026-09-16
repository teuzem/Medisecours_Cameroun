<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260814170000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Aligne le statut par défaut des nouvelles prescriptions sur le workflow brouillon';
    }

    public function up(Schema $schema): void
    {
        $this->addSql("ALTER TABLE prescription ALTER statut SET DEFAULT 'BROUILLON'");
    }

    public function down(Schema $schema): void
    {
        $this->addSql("ALTER TABLE prescription ALTER statut SET DEFAULT 'SIGNEE'");
    }
}
