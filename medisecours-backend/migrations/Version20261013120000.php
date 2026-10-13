<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Galerie carte : videos externes integrees (YouTube, TikTok, Instagram,
 * Facebook, Vimeo, Dailymotion) sur media_object. 100 % idempotente
 * (IF NOT EXISTS).
 */
final class Version20261013120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Carte gallery: external embedded videos (provider, urls) on media_object';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE media_object ADD COLUMN IF NOT EXISTS external_url VARCHAR(1000) DEFAULT NULL');
        $this->addSql('ALTER TABLE media_object ADD COLUMN IF NOT EXISTS provider VARCHAR(20) DEFAULT NULL');
        $this->addSql('ALTER TABLE media_object ADD COLUMN IF NOT EXISTS embed_url VARCHAR(1000) DEFAULT NULL');
        $this->addSql('ALTER TABLE media_object ADD COLUMN IF NOT EXISTS thumbnail_url VARCHAR(1000) DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE media_object DROP COLUMN IF EXISTS thumbnail_url');
        $this->addSql('ALTER TABLE media_object DROP COLUMN IF EXISTS embed_url');
        $this->addSql('ALTER TABLE media_object DROP COLUMN IF EXISTS provider');
        $this->addSql('ALTER TABLE media_object DROP COLUMN IF EXISTS external_url');
    }
}
