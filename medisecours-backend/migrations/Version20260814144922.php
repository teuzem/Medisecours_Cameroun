<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260814144922 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Ajoute les champs de cycle de vie à la prescription (statut, reference, version, dates, supersededBy)';
    }

    public function up(Schema $schema): void
    {
        // Ajouter d'abord les colonnes nullable
        $this->addSql('ALTER TABLE prescription ADD reference VARCHAR(40) DEFAULT NULL');
        $this->addSql('ALTER TABLE prescription ADD statut VARCHAR(20) DEFAULT NULL');
        $this->addSql('ALTER TABLE prescription ADD updated_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL');
        $this->addSql('ALTER TABLE prescription ADD signed_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL');
        $this->addSql('ALTER TABLE prescription ADD expires_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL');
        $this->addSql('ALTER TABLE prescription ADD cancelled_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL');
        $this->addSql('ALTER TABLE prescription ADD cancel_reason TEXT DEFAULT NULL');
        $this->addSql('ALTER TABLE prescription ADD sent_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL');
        $this->addSql('ALTER TABLE prescription ADD version INT DEFAULT 1');
        $this->addSql('ALTER TABLE prescription ADD superseded_by_id INT DEFAULT NULL');

        // Peupler les lignes existantes avec des valeurs par défaut
        $this->addSql("UPDATE prescription SET reference = 'ORD-' || UPPER(SUBSTR(MD5(RANDOM()::TEXT), 1, 10)) WHERE reference IS NULL");
        $this->addSql("UPDATE prescription SET statut = 'SIGNEE' WHERE statut IS NULL");
        $this->addSql('UPDATE prescription SET updated_at = created_at WHERE updated_at IS NULL');
        $this->addSql('UPDATE prescription SET signed_at = created_at WHERE signed_at IS NULL');

        // Rendre les colonnes NOT NULL
        $this->addSql('ALTER TABLE prescription ALTER COLUMN reference SET NOT NULL');
        $this->addSql('ALTER TABLE prescription ALTER COLUMN statut SET NOT NULL');
        $this->addSql('ALTER TABLE prescription ALTER COLUMN updated_at SET NOT NULL');
        $this->addSql('ALTER TABLE prescription ALTER COLUMN version SET NOT NULL');

        // Contraintes et index
        $this->addSql('ALTER TABLE prescription ADD CONSTRAINT FK_1FBFB8D939626D86 FOREIGN KEY (superseded_by_id) REFERENCES prescription (id) NOT DEFERRABLE');
        $this->addSql('CREATE UNIQUE INDEX UNIQ_1FBFB8D9AEA34913 ON prescription (reference)');
        $this->addSql('CREATE INDEX IDX_1FBFB8D939626D86 ON prescription (superseded_by_id)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE prescription DROP CONSTRAINT FK_1FBFB8D939626D86');
        $this->addSql('DROP INDEX UNIQ_1FBFB8D9AEA34913');
        $this->addSql('DROP INDEX IDX_1FBFB8D939626D86');
        $this->addSql('ALTER TABLE prescription DROP reference');
        $this->addSql('ALTER TABLE prescription DROP statut');
        $this->addSql('ALTER TABLE prescription DROP updated_at');
        $this->addSql('ALTER TABLE prescription DROP signed_at');
        $this->addSql('ALTER TABLE prescription DROP expires_at');
        $this->addSql('ALTER TABLE prescription DROP cancelled_at');
        $this->addSql('ALTER TABLE prescription DROP cancel_reason');
        $this->addSql('ALTER TABLE prescription DROP sent_at');
        $this->addSql('ALTER TABLE prescription DROP version');
        $this->addSql('ALTER TABLE prescription DROP superseded_by_id');
    }
}
