<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260805120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Separe le catalogue interne du catalogue patient limite.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE maladie ADD patient_visible BOOLEAN DEFAULT FALSE NOT NULL');
        $this->addSql('ALTER TABLE maladie ADD patient_priority INT DEFAULT NULL');
        $this->addSql('CREATE INDEX idx_maladie_patient_catalogue ON maladie (patient_visible, patient_priority)');
        $this->addSql('ALTER TABLE protocole_premiers_gestes ADD master_slug VARCHAR(120) DEFAULT NULL');
        $this->addSql('ALTER TABLE protocole_premiers_gestes ADD variant_key VARCHAR(40) DEFAULT NULL');
        $this->addSql('CREATE INDEX idx_protocole_master_variant ON protocole_premiers_gestes (master_slug, variant_key)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP INDEX idx_maladie_patient_catalogue');
        $this->addSql('ALTER TABLE maladie DROP patient_visible');
        $this->addSql('ALTER TABLE maladie DROP patient_priority');
        $this->addSql('DROP INDEX idx_protocole_master_variant');
        $this->addSql('ALTER TABLE protocole_premiers_gestes DROP master_slug');
        $this->addSql('ALTER TABLE protocole_premiers_gestes DROP variant_key');
    }
}
