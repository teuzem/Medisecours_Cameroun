<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260807100000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Ajoute le suivi versionne des catalogues de reference charges en base.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE reference_data_version (
                dataset VARCHAR(100) NOT NULL,
                catalog_version VARCHAR(80) NOT NULL,
                applied_at TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY(dataset)
            )
        SQL);
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE reference_data_version');
    }
}
