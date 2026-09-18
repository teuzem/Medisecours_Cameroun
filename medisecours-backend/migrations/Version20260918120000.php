<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Module "Carte Santé" — temps réel :
 *  - rôle "etablissement" (EtablissementManager : etablissement_nom, fonction)
 *  - traçabilité de synchronisation des structures (source, last_synced_at)
 *  - index unique sur google_place_id (féminine idempotence des upserts Google Places).
 */
final class Version20260918120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Rôle établissement (etablissement_nom, fonction) + synchronisation temps réel des structures (source, last_synced_at, index unique google_place_id).';
    }

    public function up(Schema $schema): void
    {
        // ── user : profil manager d'établissement ────────────────────────
        $this->addSql('ALTER TABLE "user" ADD etablissement_nom VARCHAR(255) DEFAULT NULL');
        $this->addSql('ALTER TABLE "user" ADD fonction VARCHAR(120) DEFAULT NULL');

        // ── centre_de_sante : traçabilité de la synchronisation ──────────
        $this->addSql("ALTER TABLE centre_de_sante ADD source VARCHAR(20) DEFAULT 'manuel' NOT NULL");
        $this->addSql('ALTER TABLE centre_de_sante ADD last_synced_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL');
        $this->addSql('CREATE UNIQUE INDEX UNIQ_CENTRE_GOOGLE_PLACE ON centre_de_sante (google_place_id)');
        $this->addSql('CREATE INDEX IDX_CENTRE_SOURCE ON centre_de_sante (source)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP INDEX IDX_CENTRE_SOURCE');
        $this->addSql('DROP INDEX UNIQ_CENTRE_GOOGLE_PLACE');
        $this->addSql('ALTER TABLE centre_de_sante DROP last_synced_at');
        $this->addSql('ALTER TABLE centre_de_sante DROP source');
        $this->addSql('ALTER TABLE "user" DROP fonction');
        $this->addSql('ALTER TABLE "user" DROP etablissement_nom');
    }
}