<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261011140000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Lien optionnel consultation → établissement (demande de consultation ciblée)';
    }

    public function up(Schema $schema): void
    {
        // Idempotent : rejoue sans échec si la colonne / FK / index existe déjà.
        $this->addSql('ALTER TABLE consultation ADD COLUMN IF NOT EXISTS etablissement_id INT DEFAULT NULL');
        $this->addSql('ALTER TABLE consultation DROP CONSTRAINT IF EXISTS FK_CONSULTATION_ETABLISSEMENT');
        $this->addSql('ALTER TABLE consultation ADD CONSTRAINT FK_CONSULTATION_ETABLISSEMENT FOREIGN KEY (etablissement_id) REFERENCES centre_de_sante (id) ON DELETE SET NULL NOT DEFERRABLE INITIALLY IMMEDIATE');
        $this->addSql('CREATE INDEX IF NOT EXISTS IDX_CONSULTATION_ETABLISSEMENT ON consultation (etablissement_id)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE consultation DROP CONSTRAINT IF EXISTS FK_CONSULTATION_ETABLISSEMENT');
        $this->addSql('DROP INDEX IF EXISTS IDX_CONSULTATION_ETABLISSEMENT');
        $this->addSql('ALTER TABLE consultation DROP COLUMN IF EXISTS etablissement_id');
    }
}
