<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260918140000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Link uploaded review images to their moderated establishment review.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE media_object ADD avis_id INT DEFAULT NULL');
        $this->addSql('ALTER TABLE media_object ADD CONSTRAINT FK_5A2A2C955CE5F6E7 FOREIGN KEY (avis_id) REFERENCES avis_etablissement (id) ON DELETE CASCADE NOT DEFERRABLE INITIALLY IMMEDIATE');
        $this->addSql('CREATE INDEX IDX_5A2A2C955CE5F6E7 ON media_object (avis_id)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE media_object DROP CONSTRAINT FK_5A2A2C955CE5F6E7');
        $this->addSql('DROP INDEX IDX_5A2A2C955CE5F6E7');
        $this->addSql('ALTER TABLE media_object DROP avis_id');
    }
}
