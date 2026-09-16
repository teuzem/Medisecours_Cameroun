<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260801100000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Ajoute la visibilité des médias : les nouveaux fichiers de messagerie sont privés par défaut.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE media_object ADD is_public BOOLEAN NOT NULL DEFAULT true');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE media_object DROP is_public');
    }
}
