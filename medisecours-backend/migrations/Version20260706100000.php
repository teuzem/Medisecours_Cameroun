<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Ajoute created_at sur user (timeseries dashboard) et table ext_log_entries (Gedmo Loggable).
 */
final class Version20260706100000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Dashboard admin : created_at sur user + table ext_log_entries Gedmo';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE "user" ADD created_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NOW() NOT NULL');
        $this->addSql('UPDATE "user" SET created_at = NOW() WHERE created_at IS NULL');

        $this->addSql('CREATE TABLE ext_log_entries (
            id SERIAL NOT NULL,
            action VARCHAR(8) NOT NULL,
            logged_at TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
            object_id VARCHAR(64) DEFAULT NULL,
            object_class VARCHAR(255) NOT NULL,
            version INT NOT NULL,
            data TEXT DEFAULT NULL,
            username VARCHAR(255) DEFAULT NULL,
            PRIMARY KEY(id)
        )');
        $this->addSql('CREATE INDEX log_class_lookup_idx ON ext_log_entries (object_class)');
        $this->addSql('CREATE INDEX log_date_lookup_idx ON ext_log_entries (logged_at)');
        $this->addSql('CREATE INDEX log_user_lookup_idx ON ext_log_entries (username)');
        $this->addSql('CREATE INDEX log_version_lookup_idx ON ext_log_entries (object_id, object_class, version)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE ext_log_entries');
        $this->addSql('ALTER TABLE "user" DROP created_at');
    }
}
