<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Cachet officiel + dirigeant sur l'établissement, signatures numériques.
 */
final class Version20261011180000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add signature_numerique table and establishment stamp/leader columns';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('CREATE SEQUENCE signature_numerique_id_seq INCREMENT BY 1 MINVALUE 1 START 1');
        $this->addSql('CREATE TABLE signature_numerique (
            id INT NOT NULL,
            utilisateur_id INT NOT NULL,
            image_data TEXT NOT NULL,
            hash_sha256 VARCHAR(64) NOT NULL,
            grade VARCHAR(120) DEFAULT NULL,
            signed_at TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL COMMENT \'(DC2Type:datetime_immutable)\',
            est_active BOOLEAN DEFAULT \'true\' NOT NULL,
            PRIMARY KEY(id)
        )');
        $this->addSql('CREATE INDEX IDX_SIGNATURE_USER_ACTIVE ON signature_numerique (utilisateur_id, est_active)');
        $this->addSql('CREATE INDEX IDX_9E0C1F5A13044D9 ON signature_numerique (utilisateur_id)');
        $this->addSql('ALTER TABLE signature_numerique ADD CONSTRAINT FK_9E0C1F5A13044D9 FOREIGN KEY (utilisateur_id) REFERENCES "user" (id) ON DELETE CASCADE');

        $this->addSql('ALTER TABLE centre_de_sante ADD cachet_url TEXT DEFAULT NULL');
        $this->addSql('ALTER TABLE centre_de_sante ADD dirigeant_nom VARCHAR(255) DEFAULT NULL');
        $this->addSql('ALTER TABLE centre_de_sante ADD dirigeant_grade VARCHAR(120) DEFAULT NULL');
        $this->addSql('ALTER TABLE centre_de_sante ADD dirigeant_id INT DEFAULT NULL');
        $this->addSql('ALTER TABLE centre_de_sante ADD CONSTRAINT FK_CENTRE_DIRIGEANT FOREIGN KEY (dirigeant_id) REFERENCES "user" (id) ON DELETE SET NULL');
        $this->addSql('CREATE INDEX IDX_CENTRE_DIRIGEANT ON centre_de_sante (dirigeant_id)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE centre_de_sante DROP FOREIGN KEY FK_CENTRE_DIRIGEANT');
        $this->addSql('DROP INDEX IDX_CENTRE_DIRIGEANT ON centre_de_sante');
        $this->addSql('ALTER TABLE centre_de_sante DROP dirigeant_id, DROP dirigeant_grade, DROP dirigeant_nom, DROP cachet_url');
        $this->addSql('DROP TABLE signature_numerique');
        $this->addSql('DROP SEQUENCE signature_numerique_id_seq');
    }
}
