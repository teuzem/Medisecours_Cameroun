<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260809193000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Stocke le contenu des médias en base (base64) pour survivre aux redéploiements.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE media_object ADD data TEXT DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE media_object DROP data');
    }
}
