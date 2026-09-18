<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260918150000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Persist authenticated map collections, saved places, and history.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('CREATE TABLE carte_collection (id SERIAL NOT NULL, user_id UUID NOT NULL, name VARCHAR(80) NOT NULL, note TEXT DEFAULT NULL, places JSON NOT NULL, created_at TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL, updated_at TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL, PRIMARY KEY(id))');
        $this->addSql('CREATE UNIQUE INDEX uniq_carte_collection_owner_name ON carte_collection (user_id, name)');
        $this->addSql('CREATE INDEX IDX_CARTE_COLLECTION_USER ON carte_collection (user_id)');
        $this->addSql('ALTER TABLE carte_collection ADD CONSTRAINT FK_CARTE_COLLECTION_USER FOREIGN KEY (user_id) REFERENCES "user" (id) ON DELETE CASCADE NOT DEFERRABLE INITIALLY IMMEDIATE');
        $this->addSql('CREATE TABLE carte_saved_place (id SERIAL NOT NULL, user_id UUID NOT NULL, centre_id INT NOT NULL, created_at TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL, PRIMARY KEY(id))');
        $this->addSql('CREATE UNIQUE INDEX uniq_carte_saved_place_owner_centre ON carte_saved_place (user_id, centre_id)');
        $this->addSql('CREATE INDEX IDX_CARTE_SAVED_USER ON carte_saved_place (user_id)');
        $this->addSql('CREATE INDEX IDX_CARTE_SAVED_CENTRE ON carte_saved_place (centre_id)');
        $this->addSql('ALTER TABLE carte_saved_place ADD CONSTRAINT FK_CARTE_SAVED_USER FOREIGN KEY (user_id) REFERENCES "user" (id) ON DELETE CASCADE NOT DEFERRABLE INITIALLY IMMEDIATE');
        $this->addSql('ALTER TABLE carte_saved_place ADD CONSTRAINT FK_CARTE_SAVED_CENTRE FOREIGN KEY (centre_id) REFERENCES centre_de_sante (id) ON DELETE CASCADE NOT DEFERRABLE INITIALLY IMMEDIATE');
        $this->addSql('CREATE TABLE carte_history (id SERIAL NOT NULL, user_id UUID NOT NULL, type VARCHAR(20) NOT NULL, query VARCHAR(255) DEFAULT NULL, centre_id INT DEFAULT NULL, metadata JSON NOT NULL, created_at TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL, PRIMARY KEY(id))');
        $this->addSql('CREATE INDEX IDX_CARTE_HISTORY_USER ON carte_history (user_id)');
        $this->addSql('CREATE INDEX IDX_CARTE_HISTORY_CENTRE ON carte_history (centre_id)');
        $this->addSql('ALTER TABLE carte_history ADD CONSTRAINT FK_CARTE_HISTORY_USER FOREIGN KEY (user_id) REFERENCES "user" (id) ON DELETE CASCADE NOT DEFERRABLE INITIALLY IMMEDIATE');
        $this->addSql('ALTER TABLE carte_history ADD CONSTRAINT FK_CARTE_HISTORY_CENTRE FOREIGN KEY (centre_id) REFERENCES centre_de_sante (id) ON DELETE SET NULL NOT DEFERRABLE INITIALLY IMMEDIATE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE carte_history');
        $this->addSql('DROP TABLE carte_saved_place');
        $this->addSql('DROP TABLE carte_collection');
    }
}
