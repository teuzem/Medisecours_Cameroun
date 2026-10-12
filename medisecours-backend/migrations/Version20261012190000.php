<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Triage SOS + éligibilité : commutateur d'alertes et disponibilité sur
 * `user` (médecins, ambulanciers), gravité / âge / grossesse sur
 * `demande_sos`. 100 % idempotente (IF NOT EXISTS partout) : rejoue sans
 * échec si marquée exécutée sans objets, ou exécutée deux fois.
 */
final class Version20261012190000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'SOS triage: user alert toggle and crew availability, demande_sos severity/age/pregnancy columns';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE "user" ADD COLUMN IF NOT EXISTS sos_alertes_active BOOLEAN DEFAULT \'true\' NOT NULL');
        $this->addSql('ALTER TABLE "user" ADD COLUMN IF NOT EXISTS en_service BOOLEAN DEFAULT \'true\' NOT NULL');
        $this->addSql('ALTER TABLE demande_sos ADD COLUMN IF NOT EXISTS gravite VARCHAR(20) DEFAULT \'LEGERE\' NOT NULL');
        $this->addSql('ALTER TABLE demande_sos ADD COLUMN IF NOT EXISTS age_patient INT DEFAULT NULL');
        $this->addSql('ALTER TABLE demande_sos ADD COLUMN IF NOT EXISTS enceinte BOOLEAN DEFAULT \'false\' NOT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE demande_sos DROP COLUMN IF EXISTS enceinte');
        $this->addSql('ALTER TABLE demande_sos DROP COLUMN IF EXISTS age_patient');
        $this->addSql('ALTER TABLE demande_sos DROP COLUMN IF EXISTS gravite');
        $this->addSql('ALTER TABLE "user" DROP COLUMN IF EXISTS en_service');
        $this->addSql('ALTER TABLE "user" DROP COLUMN IF EXISTS sos_alertes_active');
    }
}
