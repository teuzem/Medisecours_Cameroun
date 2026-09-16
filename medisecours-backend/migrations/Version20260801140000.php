<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260801140000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Aligne les index et valeurs par défaut du schéma avec les mappings Doctrine.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE maladie_symptome ALTER obligatoire DROP DEFAULT');
        $this->addSql('ALTER TABLE maladie_symptome ALTER contradictoire DROP DEFAULT');
        $this->addSql('ALTER INDEX idx_maladie_symptome_maladie RENAME TO IDX_941A7D2DB4B1C397');
        $this->addSql('ALTER INDEX idx_maladie_symptome_symptome RENAME TO IDX_941A7D2D12B83D77');
        $this->addSql('ALTER INDEX uniq_refresh_token_hash RENAME TO UNIQ_C74F2195B3BC57DA');
        $this->addSql('DROP INDEX idx_symptome_nom');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE maladie_symptome ALTER obligatoire SET DEFAULT false');
        $this->addSql('ALTER TABLE maladie_symptome ALTER contradictoire SET DEFAULT false');
        $this->addSql('ALTER INDEX IDX_941A7D2DB4B1C397 RENAME TO idx_maladie_symptome_maladie');
        $this->addSql('ALTER INDEX IDX_941A7D2D12B83D77 RENAME TO idx_maladie_symptome_symptome');
        $this->addSql('ALTER INDEX UNIQ_C74F2195B3BC57DA RENAME TO uniq_refresh_token_hash');
        $this->addSql('CREATE INDEX idx_symptome_nom ON symptome (nom)');
    }
}
