<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Ajoute les champs de classification et de services aux centres de sante.
 */
final class Version20260701170758 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Ajoute les champs type, ville, region, specialites, services et disponibilite aux centres de sante.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql("ALTER TABLE centre_de_sante ADD type VARCHAR(50) DEFAULT 'hopital_general' NOT NULL");
        $this->addSql("ALTER TABLE centre_de_sante ADD ville VARCHAR(100) DEFAULT 'Non renseignee' NOT NULL");
        $this->addSql("ALTER TABLE centre_de_sante ADD region VARCHAR(100) DEFAULT 'Centre' NOT NULL");
        $this->addSql("ALTER TABLE centre_de_sante ADD specialites JSON DEFAULT '[]' NOT NULL");
        $this->addSql("ALTER TABLE centre_de_sante ADD services JSON DEFAULT '[]' NOT NULL");
        $this->addSql('ALTER TABLE centre_de_sante ADD description TEXT DEFAULT NULL');
        $this->addSql('ALTER TABLE centre_de_sante ADD est_actif BOOLEAN DEFAULT true NOT NULL');
        $this->addSql('ALTER TABLE centre_de_sante ADD urgences24h BOOLEAN DEFAULT false NOT NULL');
        $this->addSql('ALTER TABLE centre_de_sante ADD distance DOUBLE PRECISION DEFAULT NULL');
        $this->addSql('ALTER TABLE centre_de_sante ALTER telephone TYPE VARCHAR(20)');

        $this->addSql("ALTER TABLE centre_de_sante ALTER type DROP DEFAULT");
        $this->addSql("ALTER TABLE centre_de_sante ALTER ville DROP DEFAULT");
        $this->addSql("ALTER TABLE centre_de_sante ALTER region DROP DEFAULT");
        $this->addSql("ALTER TABLE centre_de_sante ALTER specialites DROP DEFAULT");
        $this->addSql("ALTER TABLE centre_de_sante ALTER services DROP DEFAULT");
        $this->addSql('ALTER TABLE centre_de_sante ALTER est_actif DROP DEFAULT');
        $this->addSql('ALTER TABLE centre_de_sante ALTER urgences24h DROP DEFAULT');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE centre_de_sante DROP type');
        $this->addSql('ALTER TABLE centre_de_sante DROP ville');
        $this->addSql('ALTER TABLE centre_de_sante DROP region');
        $this->addSql('ALTER TABLE centre_de_sante DROP specialites');
        $this->addSql('ALTER TABLE centre_de_sante DROP services');
        $this->addSql('ALTER TABLE centre_de_sante DROP description');
        $this->addSql('ALTER TABLE centre_de_sante DROP est_actif');
        $this->addSql('ALTER TABLE centre_de_sante DROP urgences24h');
        $this->addSql('ALTER TABLE centre_de_sante DROP distance');
        $this->addSql('ALTER TABLE centre_de_sante ALTER telephone TYPE VARCHAR(255)');
    }
}