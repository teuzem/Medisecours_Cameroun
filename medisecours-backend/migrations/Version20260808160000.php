<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260808160000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Autorise plusieurs avis d un patient pour un même médecin.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE avis DROP CONSTRAINT unique_avis_patient_medecin');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE avis ADD CONSTRAINT unique_avis_patient_medecin UNIQUE (patient_id, medecin_id)');
    }
}
