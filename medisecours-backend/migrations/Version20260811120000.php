<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260811120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Ajoute le dossier privé de vérification d’identité des médecins.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql("ALTER TABLE media_object ADD purpose VARCHAR(40) DEFAULT 'general' NOT NULL");
        $this->addSql('ALTER TABLE "user" ADD type_piece_identite VARCHAR(20) DEFAULT NULL');
        $this->addSql('ALTER TABLE "user" ADD piece_identite_id INT DEFAULT NULL');
        $this->addSql('ALTER TABLE "user" ADD photo_verification_identite_id INT DEFAULT NULL');
        $this->addSql('ALTER TABLE "user" ADD CONSTRAINT FK_USER_PIECE_IDENTITE FOREIGN KEY (piece_identite_id) REFERENCES media_object (id) ON DELETE SET NULL NOT DEFERRABLE INITIALLY IMMEDIATE');
        $this->addSql('ALTER TABLE "user" ADD CONSTRAINT FK_USER_PHOTO_VERIFICATION FOREIGN KEY (photo_verification_identite_id) REFERENCES media_object (id) ON DELETE SET NULL NOT DEFERRABLE INITIALLY IMMEDIATE');
        $this->addSql('CREATE INDEX IDX_8D93D6491B21CC5E ON "user" (piece_identite_id)');
        $this->addSql('CREATE INDEX IDX_8D93D64992F2B792 ON "user" (photo_verification_identite_id)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE "user" DROP CONSTRAINT FK_USER_PIECE_IDENTITE');
        $this->addSql('ALTER TABLE "user" DROP CONSTRAINT FK_USER_PHOTO_VERIFICATION');
        $this->addSql('DROP INDEX IDX_8D93D6491B21CC5E');
        $this->addSql('DROP INDEX IDX_8D93D64992F2B792');
        $this->addSql('ALTER TABLE "user" DROP type_piece_identite');
        $this->addSql('ALTER TABLE "user" DROP piece_identite_id');
        $this->addSql('ALTER TABLE "user" DROP photo_verification_identite_id');
        $this->addSql('ALTER TABLE media_object DROP purpose');
    }
}
