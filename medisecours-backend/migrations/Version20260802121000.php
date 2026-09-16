<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260802121000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Aligne le nom de l’index unique de pair_key avec Doctrine.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER INDEX uniq_conversation_pair_key RENAME TO UNIQ_8A8E26E9AEE589DA');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER INDEX uniq_8a8e26e9aee589da RENAME TO UNIQ_CONVERSATION_PAIR_KEY');
    }
}
