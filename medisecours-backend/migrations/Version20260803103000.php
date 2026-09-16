<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260803103000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Expire email verification tokens and preserve access for existing accounts';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE "user" ADD email_verification_token_expires_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL');
        $this->addSql('UPDATE "user" SET email_verified = TRUE WHERE email_verified = FALSE');
        $this->addSql('UPDATE "user" SET email_verification_token = NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE "user" DROP email_verification_token_expires_at');
    }
}
