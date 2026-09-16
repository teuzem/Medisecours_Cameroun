<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260802120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Ajoute une clé unique pour les conversations patient-médecin.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE conversation ADD pair_key VARCHAR(73) DEFAULT NULL');
        $this->addSql('CREATE UNIQUE INDEX UNIQ_CONVERSATION_PAIR_KEY ON conversation (pair_key)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP INDEX UNIQ_CONVERSATION_PAIR_KEY');
        $this->addSql('ALTER TABLE conversation DROP pair_key');
    }
}
