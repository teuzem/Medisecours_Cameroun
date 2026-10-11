<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Circuit personnel d'établissement : réception, soins infirmiers,
 * pharmacie, dossiers médicaux et validation des pièces.
 */
final class Version20261012120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add facility staff (reception/nurse/pharmacy), medical files, vitals, signed care events and pharmacy circuit';
    }

    public function up(Schema $schema): void
    {
        // Idempotent guards: this release must apply cleanly even if a prior
        // deploy left a partial schema behind. Postgres supports
        // ADD COLUMN IF NOT EXISTS / CREATE [UNIQUE] INDEX IF NOT EXISTS and
        // DROP CONSTRAINT IF EXISTS, which makes every step replay-safe.
        // --- Colonnes STI sur `user` pour PersonnelSante ---
        $this->addSql('ALTER TABLE "user" ADD COLUMN IF NOT EXISTS type_personnel VARCHAR(30) DEFAULT NULL');
        $this->addSql('ALTER TABLE "user" ADD COLUMN IF NOT EXISTS fonction VARCHAR(150) DEFAULT NULL');
        $this->addSql('ALTER TABLE "user" ADD COLUMN IF NOT EXISTS numero_ordre VARCHAR(60) DEFAULT NULL');
        $this->addSql('ALTER TABLE "user" ADD COLUMN IF NOT EXISTS statut_validation VARCHAR(20) DEFAULT \'EN_ATTENTE\' NOT NULL');
        $this->addSql('ALTER TABLE "user" ADD COLUMN IF NOT EXISTS validation_motif TEXT DEFAULT NULL');
        $this->addSql('ALTER TABLE "user" ADD COLUMN IF NOT EXISTS etablissement_id INT DEFAULT NULL');
        $this->addSql('ALTER TABLE "user" ADD COLUMN IF NOT EXISTS validated_by_id UUID DEFAULT NULL');
        $this->addSql('ALTER TABLE "user" ADD COLUMN IF NOT EXISTS validated_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL');
        $this->addSql('COMMENT ON COLUMN "user".validated_at IS \'(DC2Type:datetime_immutable)\'');
        $this->addSql('ALTER TABLE "user" DROP CONSTRAINT IF EXISTS FK_USER_PERSONNEL_ETABLISSEMENT');
        $this->addSql('ALTER TABLE "user" ADD CONSTRAINT FK_USER_PERSONNEL_ETABLISSEMENT FOREIGN KEY (etablissement_id) REFERENCES centre_de_sante (id) ON DELETE SET NULL');
        $this->addSql('ALTER TABLE "user" DROP CONSTRAINT IF EXISTS FK_USER_PERSONNEL_VALIDATED_BY');
        $this->addSql('ALTER TABLE "user" ADD CONSTRAINT FK_USER_PERSONNEL_VALIDATED_BY FOREIGN KEY (validated_by_id) REFERENCES "user" (id) ON DELETE SET NULL');
        $this->addSql('CREATE INDEX IF NOT EXISTS IDX_USER_PERSONNEL_ETABLISSEMENT ON "user" (etablissement_id)');
        $this->addSql('CREATE INDEX IF NOT EXISTS IDX_USER_PERSONNEL_VALIDATED_BY ON "user" (validated_by_id)');

        // --- document_validation ---
        $this->addSql('CREATE SEQUENCE IF NOT EXISTS document_validation_id_seq INCREMENT BY 1 MINVALUE 1 START 1');
        $this->addSql('CREATE TABLE IF NOT EXISTS document_validation (
            id INT NOT NULL,
            personnel_id UUID NOT NULL,
            type_document VARCHAR(40) NOT NULL,
            titre VARCHAR(255) DEFAULT NULL,
            original_name VARCHAR(120) DEFAULT NULL,
            fichier_data TEXT DEFAULT NULL,
            statut VARCHAR(20) DEFAULT \'EN_ATTENTE\' NOT NULL,
            motif TEXT DEFAULT NULL,
            validated_by_id UUID DEFAULT NULL,
            validated_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
            created_at TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
            PRIMARY KEY(id)
        )');
        $this->addSql('COMMENT ON COLUMN document_validation.validated_at IS \'(DC2Type:datetime_immutable)\'');
        $this->addSql('COMMENT ON COLUMN document_validation.created_at IS \'(DC2Type:datetime_immutable)\'');
        $this->addSql('CREATE INDEX IF NOT EXISTS IDX_DOC_VALIDATION_PERSONNEL ON document_validation (personnel_id)');
        $this->addSql('CREATE INDEX IF NOT EXISTS IDX_DOC_VALIDATION_VALIDATED_BY ON document_validation (validated_by_id)');
        $this->addSql('ALTER TABLE document_validation DROP CONSTRAINT IF EXISTS FK_DOC_VALIDATION_PERSONNEL');
        $this->addSql('ALTER TABLE document_validation ADD CONSTRAINT FK_DOC_VALIDATION_PERSONNEL FOREIGN KEY (personnel_id) REFERENCES "user" (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE document_validation DROP CONSTRAINT IF EXISTS FK_DOC_VALIDATION_VALIDATED_BY');
        $this->addSql('ALTER TABLE document_validation ADD CONSTRAINT FK_DOC_VALIDATION_VALIDATED_BY FOREIGN KEY (validated_by_id) REFERENCES "user" (id) ON DELETE SET NULL');

        // --- dossier_medical ---
        $this->addSql('CREATE SEQUENCE IF NOT EXISTS dossier_medical_id_seq INCREMENT BY 1 MINVALUE 1 START 1');
        $this->addSql('CREATE TABLE IF NOT EXISTS dossier_medical (
            id INT NOT NULL,
            numero VARCHAR(30) NOT NULL,
            centre_id INT NOT NULL,
            patient_id UUID NOT NULL,
            statut VARCHAR(20) DEFAULT \'OUVERT\' NOT NULL,
            opened_by_id UUID DEFAULT NULL,
            created_at TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
            closed_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
            PRIMARY KEY(id)
        )');
        $this->addSql('COMMENT ON COLUMN dossier_medical.created_at IS \'(DC2Type:datetime_immutable)\'');
        $this->addSql('COMMENT ON COLUMN dossier_medical.closed_at IS \'(DC2Type:datetime_immutable)\'');
        $this->addSql('CREATE UNIQUE INDEX IF NOT EXISTS uniq_dossier_centre_patient ON dossier_medical (centre_id, patient_id)');
        $this->addSql('CREATE UNIQUE INDEX IF NOT EXISTS UNIQ_DOSSIER_MEDICAL_NUMERO ON dossier_medical (numero)');
        $this->addSql('CREATE INDEX IF NOT EXISTS IDX_DOSSIER_MEDICAL_CENTRE ON dossier_medical (centre_id)');
        $this->addSql('CREATE INDEX IF NOT EXISTS IDX_DOSSIER_MEDICAL_PATIENT ON dossier_medical (patient_id)');
        $this->addSql('CREATE INDEX IF NOT EXISTS IDX_DOSSIER_MEDICAL_OPENED_BY ON dossier_medical (opened_by_id)');
        $this->addSql('ALTER TABLE dossier_medical DROP CONSTRAINT IF EXISTS FK_DOSSIER_MEDICAL_CENTRE');
        $this->addSql('ALTER TABLE dossier_medical ADD CONSTRAINT FK_DOSSIER_MEDICAL_CENTRE FOREIGN KEY (centre_id) REFERENCES centre_de_sante (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE dossier_medical DROP CONSTRAINT IF EXISTS FK_DOSSIER_MEDICAL_PATIENT');
        $this->addSql('ALTER TABLE dossier_medical ADD CONSTRAINT FK_DOSSIER_MEDICAL_PATIENT FOREIGN KEY (patient_id) REFERENCES "user" (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE dossier_medical DROP CONSTRAINT IF EXISTS FK_DOSSIER_MEDICAL_OPENED_BY');
        $this->addSql('ALTER TABLE dossier_medical ADD CONSTRAINT FK_DOSSIER_MEDICAL_OPENED_BY FOREIGN KEY (opened_by_id) REFERENCES "user" (id) ON DELETE SET NULL');

        // --- signe_vitaux ---
        $this->addSql('CREATE SEQUENCE IF NOT EXISTS signe_vitaux_id_seq INCREMENT BY 1 MINVALUE 1 START 1');
        $this->addSql('CREATE TABLE IF NOT EXISTS signe_vitaux (
            id INT NOT NULL,
            dossier_id INT NOT NULL,
            patient_id UUID NOT NULL,
            centre_id INT DEFAULT NULL,
            saisi_par_id UUID DEFAULT NULL,
            age_ans INT DEFAULT NULL,
            poids_kg DOUBLE PRECISION DEFAULT NULL,
            taille_cm DOUBLE PRECISION DEFAULT NULL,
            temperature_c DOUBLE PRECISION DEFAULT NULL,
            tension_arteriale_gauche VARCHAR(20) DEFAULT NULL,
            tension_arteriale_droite VARCHAR(20) DEFAULT NULL,
            pouls_par_min INT DEFAULT NULL,
            spo2 INT DEFAULT NULL,
            glycemie_mmol DOUBLE PRECISION DEFAULT NULL,
            notes TEXT DEFAULT NULL,
            recorded_at TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
            PRIMARY KEY(id)
        )');
        $this->addSql('COMMENT ON COLUMN signe_vitaux.recorded_at IS \'(DC2Type:datetime_immutable)\'');
        $this->addSql('CREATE INDEX IF NOT EXISTS IDX_SIGNE_VITAUX_DOSSIER ON signe_vitaux (dossier_id)');
        $this->addSql('CREATE INDEX IF NOT EXISTS IDX_SIGNE_VITAUX_PATIENT ON signe_vitaux (patient_id)');
        $this->addSql('ALTER TABLE signe_vitaux DROP CONSTRAINT IF EXISTS FK_SIGNE_VITAUX_DOSSIER');
        $this->addSql('ALTER TABLE signe_vitaux ADD CONSTRAINT FK_SIGNE_VITAUX_DOSSIER FOREIGN KEY (dossier_id) REFERENCES dossier_medical (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE signe_vitaux DROP CONSTRAINT IF EXISTS FK_SIGNE_VITAUX_PATIENT');
        $this->addSql('ALTER TABLE signe_vitaux ADD CONSTRAINT FK_SIGNE_VITAUX_PATIENT FOREIGN KEY (patient_id) REFERENCES "user" (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE signe_vitaux DROP CONSTRAINT IF EXISTS FK_SIGNE_VITAUX_CENTRE');
        $this->addSql('ALTER TABLE signe_vitaux ADD CONSTRAINT FK_SIGNE_VITAUX_CENTRE FOREIGN KEY (centre_id) REFERENCES centre_de_sante (id) ON DELETE SET NULL');
        $this->addSql('ALTER TABLE signe_vitaux DROP CONSTRAINT IF EXISTS FK_SIGNE_VITAUX_SAISI_PAR');
        $this->addSql('ALTER TABLE signe_vitaux ADD CONSTRAINT FK_SIGNE_VITAUX_SAISI_PAR FOREIGN KEY (saisi_par_id) REFERENCES "user" (id) ON DELETE SET NULL');

        // --- dossier_evenement (herodates) ---
        $this->addSql('CREATE SEQUENCE IF NOT EXISTS dossier_evenement_id_seq INCREMENT BY 1 MINVALUE 1 START 1');
        $this->addSql('CREATE TABLE IF NOT EXISTS dossier_evenement (
            id INT NOT NULL,
            dossier_id INT DEFAULT NULL,
            patient_id UUID NOT NULL,
            centre_id INT DEFAULT NULL,
            type VARCHAR(30) NOT NULL,
            titre VARCHAR(255) NOT NULL,
            details JSON DEFAULT NULL,
            auteur_id UUID DEFAULT NULL,
            signature_hash VARCHAR(64) DEFAULT NULL,
            created_at TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
            PRIMARY KEY(id)
        )');
        $this->addSql('COMMENT ON COLUMN dossier_evenement.created_at IS \'(DC2Type:datetime_immutable)\'');
        $this->addSql('CREATE INDEX IF NOT EXISTS idx_dossier_evenement_dossier_date ON dossier_evenement (dossier_id, created_at)');
        $this->addSql('CREATE INDEX IF NOT EXISTS IDX_DOSSIER_EVENEMENT_PATIENT ON dossier_evenement (patient_id)');
        $this->addSql('ALTER TABLE dossier_evenement DROP CONSTRAINT IF EXISTS FK_DOSSIER_EVENEMENT_DOSSIER');
        $this->addSql('ALTER TABLE dossier_evenement ADD CONSTRAINT FK_DOSSIER_EVENEMENT_DOSSIER FOREIGN KEY (dossier_id) REFERENCES dossier_medical (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE dossier_evenement DROP CONSTRAINT IF EXISTS FK_DOSSIER_EVENEMENT_PATIENT');
        $this->addSql('ALTER TABLE dossier_evenement ADD CONSTRAINT FK_DOSSIER_EVENEMENT_PATIENT FOREIGN KEY (patient_id) REFERENCES "user" (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE dossier_evenement DROP CONSTRAINT IF EXISTS FK_DOSSIER_EVENEMENT_CENTRE');
        $this->addSql('ALTER TABLE dossier_evenement ADD CONSTRAINT FK_DOSSIER_EVENEMENT_CENTRE FOREIGN KEY (centre_id) REFERENCES centre_de_sante (id) ON DELETE SET NULL');
        $this->addSql('ALTER TABLE dossier_evenement DROP CONSTRAINT IF EXISTS FK_DOSSIER_EVENEMENT_AUTEUR');
        $this->addSql('ALTER TABLE dossier_evenement ADD CONSTRAINT FK_DOSSIER_EVENEMENT_AUTEUR FOREIGN KEY (auteur_id) REFERENCES "user" (id) ON DELETE SET NULL');

        // --- soin_administre ---
        $this->addSql('CREATE SEQUENCE IF NOT EXISTS soin_administre_id_seq INCREMENT BY 1 MINVALUE 1 START 1');
        $this->addSql('CREATE TABLE IF NOT EXISTS soin_administre (
            id INT NOT NULL,
            dossier_id INT NOT NULL,
            patient_id UUID NOT NULL,
            consultation_id INT DEFAULT NULL,
            ordonnance_id INT DEFAULT NULL,
            infirmier_id UUID DEFAULT NULL,
            libelle VARCHAR(255) NOT NULL,
            details TEXT DEFAULT NULL,
            statut VARCHAR(20) DEFAULT \'PLANIFIE\' NOT NULL,
            signature_image TEXT DEFAULT NULL,
            signature_hash VARCHAR(64) DEFAULT NULL,
            created_at TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
            realised_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
            PRIMARY KEY(id)
        )');
        $this->addSql('COMMENT ON COLUMN soin_administre.created_at IS \'(DC2Type:datetime_immutable)\'');
        $this->addSql('COMMENT ON COLUMN soin_administre.realised_at IS \'(DC2Type:datetime_immutable)\'');
        $this->addSql('CREATE INDEX IF NOT EXISTS IDX_SOIN_ADMINISTRE_DOSSIER ON soin_administre (dossier_id)');
        $this->addSql('CREATE INDEX IF NOT EXISTS IDX_SOIN_ADMINISTRE_PATIENT ON soin_administre (patient_id)');
        $this->addSql('CREATE INDEX IF NOT EXISTS IDX_SOIN_ADMINISTRE_CONSULTATION ON soin_administre (consultation_id)');
        $this->addSql('CREATE INDEX IF NOT EXISTS IDX_SOIN_ADMINISTRE_ORDONNANCE ON soin_administre (ordonnance_id)');
        $this->addSql('ALTER TABLE soin_administre DROP CONSTRAINT IF EXISTS FK_SOIN_ADMINISTRE_DOSSIER');
        $this->addSql('ALTER TABLE soin_administre ADD CONSTRAINT FK_SOIN_ADMINISTRE_DOSSIER FOREIGN KEY (dossier_id) REFERENCES dossier_medical (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE soin_administre DROP CONSTRAINT IF EXISTS FK_SOIN_ADMINISTRE_PATIENT');
        $this->addSql('ALTER TABLE soin_administre ADD CONSTRAINT FK_SOIN_ADMINISTRE_PATIENT FOREIGN KEY (patient_id) REFERENCES "user" (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE soin_administre DROP CONSTRAINT IF EXISTS FK_SOIN_ADMINISTRE_CONSULTATION');
        $this->addSql('ALTER TABLE soin_administre ADD CONSTRAINT FK_SOIN_ADMINISTRE_CONSULTATION FOREIGN KEY (consultation_id) REFERENCES consultation (id) ON DELETE SET NULL');
        $this->addSql('ALTER TABLE soin_administre DROP CONSTRAINT IF EXISTS FK_SOIN_ADMINISTRE_INFIRMIER');
        $this->addSql('ALTER TABLE soin_administre ADD CONSTRAINT FK_SOIN_ADMINISTRE_INFIRMIER FOREIGN KEY (infirmier_id) REFERENCES "user" (id) ON DELETE SET NULL');

        // --- ordonnance_pharmacie ---
        $this->addSql('CREATE SEQUENCE IF NOT EXISTS ordonnance_pharmacie_id_seq INCREMENT BY 1 MINVALUE 1 START 1');
        $this->addSql('CREATE TABLE IF NOT EXISTS ordonnance_pharmacie (
            id INT NOT NULL,
            prescription_id INT NOT NULL,
            centre_id INT DEFAULT NULL,
            patient_id UUID NOT NULL,
            statut VARCHAR(20) DEFAULT \'RECUE\' NOT NULL,
            montant_total DOUBLE PRECISION DEFAULT NULL,
            facture_par_id UUID DEFAULT NULL,
            facture_le TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
            paye_par_id UUID DEFAULT NULL,
            paye_le TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
            cancel_motif TEXT DEFAULT NULL,
            created_at TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
            updated_at TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
            PRIMARY KEY(id)
        )');
        $this->addSql('COMMENT ON COLUMN ordonnance_pharmacie.facture_le IS \'(DC2Type:datetime_immutable)\'');
        $this->addSql('COMMENT ON COLUMN ordonnance_pharmacie.paye_le IS \'(DC2Type:datetime_immutable)\'');
        $this->addSql('COMMENT ON COLUMN ordonnance_pharmacie.created_at IS \'(DC2Type:datetime_immutable)\'');
        $this->addSql('COMMENT ON COLUMN ordonnance_pharmacie.updated_at IS \'(DC2Type:datetime_immutable)\'');
        $this->addSql('CREATE UNIQUE INDEX IF NOT EXISTS UNIQ_ORDONNANCE_PHARMACIE_PRESCRIPTION ON ordonnance_pharmacie (prescription_id)');
        $this->addSql('CREATE INDEX IF NOT EXISTS idx_ord_pharm_centre_statut ON ordonnance_pharmacie (centre_id, statut)');
        $this->addSql('CREATE INDEX IF NOT EXISTS IDX_ORDONNANCE_PHARMACIE_PATIENT ON ordonnance_pharmacie (patient_id)');
        $this->addSql('ALTER TABLE ordonnance_pharmacie DROP CONSTRAINT IF EXISTS FK_ORDONNANCE_PHARMACIE_PRESCRIPTION');
        $this->addSql('ALTER TABLE ordonnance_pharmacie ADD CONSTRAINT FK_ORDONNANCE_PHARMACIE_PRESCRIPTION FOREIGN KEY (prescription_id) REFERENCES prescription (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE ordonnance_pharmacie DROP CONSTRAINT IF EXISTS FK_ORDONNANCE_PHARMACIE_CENTRE');
        $this->addSql('ALTER TABLE ordonnance_pharmacie ADD CONSTRAINT FK_ORDONNANCE_PHARMACIE_CENTRE FOREIGN KEY (centre_id) REFERENCES centre_de_sante (id) ON DELETE SET NULL');
        $this->addSql('ALTER TABLE ordonnance_pharmacie DROP CONSTRAINT IF EXISTS FK_ORDONNANCE_PHARMACIE_PATIENT');
        $this->addSql('ALTER TABLE ordonnance_pharmacie ADD CONSTRAINT FK_ORDONNANCE_PHARMACIE_PATIENT FOREIGN KEY (patient_id) REFERENCES "user" (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE ordonnance_pharmacie DROP CONSTRAINT IF EXISTS FK_ORDONNANCE_PHARMACIE_FACTURE_PAR');
        $this->addSql('ALTER TABLE ordonnance_pharmacie ADD CONSTRAINT FK_ORDONNANCE_PHARMACIE_FACTURE_PAR FOREIGN KEY (facture_par_id) REFERENCES "user" (id) ON DELETE SET NULL');
        $this->addSql('ALTER TABLE ordonnance_pharmacie DROP CONSTRAINT IF EXISTS FK_ORDONNANCE_PHARMACIE_PAYE_PAR');
        $this->addSql('ALTER TABLE ordonnance_pharmacie ADD CONSTRAINT FK_ORDONNANCE_PHARMACIE_PAYE_PAR FOREIGN KEY (paye_par_id) REFERENCES "user" (id) ON DELETE SET NULL');
        $this->addSql('ALTER TABLE soin_administre DROP CONSTRAINT IF EXISTS FK_SOIN_ADMINISTRE_ORDONNANCE');
        $this->addSql('ALTER TABLE soin_administre ADD CONSTRAINT FK_SOIN_ADMINISTRE_ORDONNANCE FOREIGN KEY (ordonnance_id) REFERENCES ordonnance_pharmacie (id) ON DELETE SET NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE soin_administre DROP CONSTRAINT FK_SOIN_ADMINISTRE_ORDONNANCE');
        $this->addSql('DROP TABLE ordonnance_pharmacie');
        $this->addSql('DROP SEQUENCE ordonnance_pharmacie_id_seq');
        $this->addSql('DROP TABLE soin_administre');
        $this->addSql('DROP SEQUENCE soin_administre_id_seq');
        $this->addSql('DROP TABLE dossier_evenement');
        $this->addSql('DROP SEQUENCE dossier_evenement_id_seq');
        $this->addSql('DROP TABLE signe_vitaux');
        $this->addSql('DROP SEQUENCE signe_vitaux_id_seq');
        $this->addSql('DROP TABLE dossier_medical');
        $this->addSql('DROP SEQUENCE dossier_medical_id_seq');
        $this->addSql('DROP TABLE document_validation');
        $this->addSql('DROP SEQUENCE document_validation_id_seq');
        $this->addSql('ALTER TABLE "user" DROP CONSTRAINT FK_USER_PERSONNEL_ETABLISSEMENT');
        $this->addSql('ALTER TABLE "user" DROP CONSTRAINT FK_USER_PERSONNEL_VALIDATED_BY');
        $this->addSql('DROP INDEX IDX_USER_PERSONNEL_ETABLISSEMENT');
        $this->addSql('DROP INDEX IDX_USER_PERSONNEL_VALIDATED_BY');
        $this->addSql('ALTER TABLE "user" DROP validated_at, DROP validated_by_id, DROP etablissement_id, DROP validation_motif, DROP statut_validation, DROP numero_ordre, DROP fonction, DROP type_personnel');
    }
}
