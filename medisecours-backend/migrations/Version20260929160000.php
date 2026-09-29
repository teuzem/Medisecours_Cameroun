<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260929160000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add real-time interaction tracking for establishment fiches (analytics).';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('CREATE TABLE evenement_etablissement (id SERIAL NOT NULL, etablissement_id INT NOT NULL, type VARCHAR(30) NOT NULL, metadata JSON NOT NULL, utilisateur_id UUID DEFAULT NULL, created_at TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL, PRIMARY KEY(id))');
        $this->addSql('CREATE INDEX idx_evenement_etab ON evenement_etablissement (etablissement_id, type)');
        $this->addSql('CREATE INDEX idx_evenement_etab_date ON evenement_etablissement (etablissement_id, created_at)');
        $this->addSql('ALTER TABLE evenement_etablissement ADD CONSTRAINT FK_EVENEMENT_ETAB FOREIGN KEY (etablissement_id) REFERENCES centre_de_sante (id) ON DELETE CASCADE NOT DEFERRABLE INITIALLY IMMEDIATE');
        $this->addSql('ALTER TABLE evenement_etablissement ADD CONSTRAINT FK_EVENEMENT_USER FOREIGN KEY (utilisateur_id) REFERENCES "user" (id) ON DELETE SET NULL NOT DEFERRABLE INITIALLY IMMEDIATE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE evenement_etablissement');
    }
}