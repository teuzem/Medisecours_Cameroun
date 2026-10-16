<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * SOS : nature explicite de la preuve (PHOTO / VIDEO).
 *
 * Stockée plutôt que déduite : l'équipe de secours doit pouvoir relire une
 * vidéo de confirmation avant de lancer la sirène. Deviner le type en
 * reniflant la data-URL affichait les vidéos dans une balise <img>.
 *
 * 100 % idempotente (ADD COLUMN IF NOT EXISTS).
 */
final class Version20261016120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'SOS: type de preuve explicite (demande_sos.preuve_type)';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE demande_sos ADD COLUMN IF NOT EXISTS preuve_type VARCHAR(10) DEFAULT NULL');
        // Rétro-alimentation : les alertes existantes restent lisibles.
        $this->addSql('UPDATE demande_sos SET preuve_type = \'VIDEO\' WHERE preuve_type IS NULL AND preuve_photo LIKE \'data:video/%\'');
        $this->addSql('UPDATE demande_sos SET preuve_type = \'PHOTO\' WHERE preuve_type IS NULL AND preuve_photo LIKE \'data:image/%\'');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE demande_sos DROP COLUMN IF EXISTS preuve_type');
    }
}