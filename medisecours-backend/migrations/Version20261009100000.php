<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261009100000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Préférences de personnalisation de l\'établissement (espace structure) persistées côté serveur';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('CREATE TABLE etablissement_preference (
            centre_id INT NOT NULL,
            data JSON NOT NULL,
            updated_at TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
            updated_by UUID DEFAULT NULL,
            PRIMARY KEY (centre_id)
        )');
        $this->addSql('ALTER TABLE etablissement_preference ADD CONSTRAINT FK_ETAB_PREF_CENTRE FOREIGN KEY (centre_id) REFERENCES centre_de_sante (id) ON DELETE CASCADE NOT DEFERRABLE INITIALLY IMMEDIATE');
        $this->addSql('ALTER TABLE etablissement_preference ADD CONSTRAINT FK_ETAB_PREF_UPDATED_BY FOREIGN KEY (updated_by) REFERENCES "user" (id) ON DELETE SET NULL NOT DEFERRABLE INITIALLY IMMEDIATE');
        $this->addSql('CREATE INDEX IDX_ETAB_PREF_UPDATED ON etablissement_preference (updated_at)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE etablissement_preference');
    }
}
