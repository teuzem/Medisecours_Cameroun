<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260811150000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Ajoute le verso obligatoire de la CNI au dossier de vérification des médecins.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE "user" ADD piece_identite_verso_id INT DEFAULT NULL');
        $this->addSql('ALTER TABLE "user" ADD CONSTRAINT FK_USER_PIECE_IDENTITE_VERSO FOREIGN KEY (piece_identite_verso_id) REFERENCES media_object (id) ON DELETE SET NULL NOT DEFERRABLE INITIALLY IMMEDIATE');
        $this->addSql('CREATE INDEX IDX_8D93D649A26FACA5 ON "user" (piece_identite_verso_id)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE "user" DROP CONSTRAINT FK_USER_PIECE_IDENTITE_VERSO');
        $this->addSql('DROP INDEX IDX_8D93D649A26FACA5');
        $this->addSql('ALTER TABLE "user" DROP piece_identite_verso_id');
    }
}
