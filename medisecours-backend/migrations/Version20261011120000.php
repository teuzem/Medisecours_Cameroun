<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261011120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Préférences de personnalisation de l\'utilisateur (espace médecin) persistées côté serveur';
    }

    public function up(Schema $schema): void
    {
        // Idempotent : rejoue sans échec si user_preference existe déjà
        // (deploy interrompu, migration marquée exécutée sans objets).
        $this->addSql('CREATE TABLE IF NOT EXISTS user_preference (
            user_id UUID NOT NULL,
            data JSON NOT NULL,
            updated_at TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
            PRIMARY KEY (user_id)
        )');
        $this->addSql('ALTER TABLE user_preference DROP CONSTRAINT IF EXISTS FK_USER_PREF_USER');
        $this->addSql('ALTER TABLE user_preference ADD CONSTRAINT FK_USER_PREF_USER FOREIGN KEY (user_id) REFERENCES "user" (id) ON DELETE CASCADE NOT DEFERRABLE INITIALLY IMMEDIATE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE IF EXISTS user_preference');
    }
}
