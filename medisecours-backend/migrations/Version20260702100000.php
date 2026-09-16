<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Corrections de sécurité et nouvelles fonctionnalités :
 *
 * 1. Table User : ajout de email_verified, email_verification_token,
 *                 password_reset_token, password_reset_token_expires_at
 * 2. Table Avis : création complète
 * 3. Table centre_de_sante : suppression du champ distance (transient, pas en DB)
 */
final class Version20260702100000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Sécurité : vérification email, reset password, entité Avis, suppression champ distance en DB.';
    }

    public function up(Schema $schema): void
    {
        // ── 1. Champs de vérification/reset sur la table user ─────────────────
        $this->addSql('ALTER TABLE "user" ADD email_verified BOOLEAN DEFAULT false NOT NULL');
        $this->addSql('ALTER TABLE "user" ADD email_verification_token VARCHAR(100) DEFAULT NULL');
        $this->addSql('ALTER TABLE "user" ADD password_reset_token VARCHAR(100) DEFAULT NULL');
        $this->addSql('ALTER TABLE "user" ADD password_reset_token_expires_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL');

        // Index unique sur les tokens pour lookup rapide
        $this->addSql('CREATE UNIQUE INDEX UNIQ_EMAIL_VERIFICATION_TOKEN ON "user" (email_verification_token)');
        $this->addSql('CREATE UNIQUE INDEX UNIQ_PASSWORD_RESET_TOKEN ON "user" (password_reset_token)');

        // Marquer les comptes existants comme email vérifié (migration sans rupture)
        $this->addSql('UPDATE "user" SET email_verified = true WHERE email_verified = false');

        // ── 2. Table Avis ──────────────────────────────────────────────────────
        $this->addSql('
            CREATE TABLE avis (
                id           SERIAL NOT NULL,
                patient_id   UUID NOT NULL,
                medecin_id   UUID NOT NULL,
                note         SMALLINT NOT NULL,
                commentaire  TEXT DEFAULT NULL,
                signale      BOOLEAN DEFAULT false NOT NULL,
                raison_signalement TEXT DEFAULT NULL,
                created_at   TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at   TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                CONSTRAINT pk_avis PRIMARY KEY (id),
                CONSTRAINT fk_avis_patient FOREIGN KEY (patient_id) REFERENCES "user" (id) ON DELETE CASCADE,
                CONSTRAINT fk_avis_medecin FOREIGN KEY (medecin_id) REFERENCES "user" (id) ON DELETE CASCADE,
                CONSTRAINT uq_avis_patient_medecin UNIQUE (patient_id, medecin_id)
            )
        ');

        // Index pour les requêtes fréquentes
        $this->addSql('CREATE INDEX idx_avis_medecin ON avis (medecin_id)');
        $this->addSql('CREATE INDEX idx_avis_patient ON avis (patient_id)');
        $this->addSql('CREATE INDEX idx_avis_signale ON avis (signale)');

        // ── 3. Suppression du champ distance de centre_de_sante ──────────────
        // Ce champ est transient (calculé à la volée, jamais persisté)
        $this->addSql('ALTER TABLE centre_de_sante DROP COLUMN IF EXISTS distance');
    }

    public function down(Schema $schema): void
    {
        // Supprimer les index avant les colonnes
        $this->addSql('DROP INDEX IF EXISTS UNIQ_EMAIL_VERIFICATION_TOKEN');
        $this->addSql('DROP INDEX IF EXISTS UNIQ_PASSWORD_RESET_TOKEN');

        $this->addSql('ALTER TABLE "user" DROP COLUMN email_verified');
        $this->addSql('ALTER TABLE "user" DROP COLUMN email_verification_token');
        $this->addSql('ALTER TABLE "user" DROP COLUMN password_reset_token');
        $this->addSql('ALTER TABLE "user" DROP COLUMN password_reset_token_expires_at');

        $this->addSql('DROP TABLE IF EXISTS avis');

        $this->addSql('ALTER TABLE centre_de_sante ADD distance DOUBLE PRECISION DEFAULT NULL');
    }
}
