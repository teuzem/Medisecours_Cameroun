<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Suivi opérationnel des interventions SOS.
 *
 * Ajoute au cycle de vie (prise en charge → départ → arrivée → transport →
 * clôture) les horodatages mesurés par l'intervenant, plus le type
 * d'intervenant et une note libre. Ces colonnes alimentent les délais
 * moyens du tableau de bord ambulance/médecin.
 *
 * 100 % idempotente (ADD COLUMN IF NOT EXISTS).
 */
final class Version20261015120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'SOS: suivi opérationnel des interventions (départ, arrivée, transport)';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE demande_sos ADD COLUMN IF NOT EXISTS prise_en_charge_type VARCHAR(20) DEFAULT NULL');
        $this->addSql('ALTER TABLE demande_sos ADD COLUMN IF NOT EXISTS depart_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL');
        $this->addSql('ALTER TABLE demande_sos ADD COLUMN IF NOT EXISTS arrivee_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL');
        $this->addSql('ALTER TABLE demande_sos ADD COLUMN IF NOT EXISTS patient_embarque_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL');
        $this->addSql('ALTER TABLE demande_sos ADD COLUMN IF NOT EXISTS note_intervention TEXT DEFAULT NULL');
        $this->addSql('CREATE INDEX IF NOT EXISTS IDX_DEMANDE_SOS_PRISE_EN_CHARGE ON demande_sos (pris_en_charge_par_id)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP INDEX IF EXISTS IDX_DEMANDE_SOS_PRISE_EN_CHARGE');
        $this->addSql('ALTER TABLE demande_sos DROP COLUMN IF EXISTS note_intervention');
        $this->addSql('ALTER TABLE demande_sos DROP COLUMN IF EXISTS patient_embarque_at');
        $this->addSql('ALTER TABLE demande_sos DROP COLUMN IF EXISTS arrivee_at');
        $this->addSql('ALTER TABLE demande_sos DROP COLUMN IF EXISTS depart_at');
        $this->addSql('ALTER TABLE demande_sos DROP COLUMN IF EXISTS prise_en_charge_type');
    }
}