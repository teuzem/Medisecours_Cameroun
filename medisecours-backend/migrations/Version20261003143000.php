<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261003143000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add Cameroon administrative geography to users and health facilities';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE "user" ADD region VARCHAR(100) DEFAULT NULL');
        $this->addSql('ALTER TABLE "user" ADD region_code VARCHAR(20) DEFAULT NULL');
        $this->addSql('ALTER TABLE "user" ADD departement VARCHAR(100) DEFAULT NULL');
        $this->addSql('ALTER TABLE "user" ADD departement_code VARCHAR(20) DEFAULT NULL');
        $this->addSql('ALTER TABLE "user" ADD arrondissement VARCHAR(120) DEFAULT NULL');
        $this->addSql('ALTER TABLE "user" ADD arrondissement_code VARCHAR(20) DEFAULT NULL');
        $this->addSql('ALTER TABLE "user" ADD latitude DOUBLE PRECISION DEFAULT NULL');
        $this->addSql('ALTER TABLE "user" ADD longitude DOUBLE PRECISION DEFAULT NULL');
        $this->addSql('ALTER TABLE centre_de_sante ADD region_code VARCHAR(20) DEFAULT NULL');
        $this->addSql('ALTER TABLE centre_de_sante ADD departement VARCHAR(100) DEFAULT NULL');
        $this->addSql('ALTER TABLE centre_de_sante ADD departement_code VARCHAR(20) DEFAULT NULL');
        $this->addSql('ALTER TABLE centre_de_sante ADD arrondissement VARCHAR(120) DEFAULT NULL');
        $this->addSql('ALTER TABLE centre_de_sante ADD arrondissement_code VARCHAR(20) DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE "user" DROP region');
        $this->addSql('ALTER TABLE "user" DROP region_code');
        $this->addSql('ALTER TABLE "user" DROP departement');
        $this->addSql('ALTER TABLE "user" DROP departement_code');
        $this->addSql('ALTER TABLE "user" DROP arrondissement');
        $this->addSql('ALTER TABLE "user" DROP arrondissement_code');
        $this->addSql('ALTER TABLE "user" DROP latitude');
        $this->addSql('ALTER TABLE "user" DROP longitude');
        $this->addSql('ALTER TABLE centre_de_sante DROP region_code');
        $this->addSql('ALTER TABLE centre_de_sante DROP departement');
        $this->addSql('ALTER TABLE centre_de_sante DROP departement_code');
        $this->addSql('ALTER TABLE centre_de_sante DROP arrondissement');
        $this->addSql('ALTER TABLE centre_de_sante DROP arrondissement_code');
    }
}

