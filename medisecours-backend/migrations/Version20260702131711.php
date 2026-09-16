<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Migration structuration des données médicales et disponibilités.
 *
 * Changements :
 * 1. allergies       : TEXT → JSON  (ex: "Pénicilline" → ["Pénicilline"])
 * 2. contacts_urgence: TEXT → JSON  (ex: "Mère: +237..." → [{"nom":"Mère","telephone":"+237..."}])
 * 3. disponibilites  : TEXT → JSON  (ex: "Lundi-Vendredi 08h-17h" → conservé en disponibilites_texte)
 * 4. disponibilites_texte: nouveau champ TEXT pour la migration progressive
 *
 * Stratégie de migration sans perte de données :
 * - Les anciennes valeurs texte sont converties en JSON minimal valide
 * - Les valeurs NULL restent NULL
 * - Les données invalides sont préservées dans disponibilites_texte
 */
final class Version20260702131711 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Structuration JSON : allergies, contacts_urgence, disponibilites. Ajout disponibilites_texte.';
    }

    public function up(Schema $schema): void
    {
        // 1. Ajouter le champ texte libre pour disponibilités (migration progressive)
        $this->addSql('ALTER TABLE "user" ADD disponibilites_texte TEXT DEFAULT NULL');

        // 2. Migrer les disponibilités texte existantes vers le nouveau champ texte libre
        //    avant de convertir disponibilites en JSON
        $this->addSql('UPDATE "user" SET disponibilites_texte = disponibilites WHERE disponibilites IS NOT NULL');
        $this->addSql('UPDATE "user" SET disponibilites = NULL WHERE disponibilites IS NOT NULL');

        // 3. Convertir allergies TEXT → JSON
        $this->addSql(<<<'SQL'
            UPDATE "user"
            SET allergies = CASE
                WHEN allergies IS NULL THEN NULL
                WHEN allergies LIKE '[%' THEN allergies
                ELSE json_build_array(allergies)::text
            END
            WHERE type = 'patient' AND allergies IS NOT NULL
        SQL);

        // 4. Convertir contacts_urgence TEXT → JSON
        $this->addSql(<<<'SQL'
            UPDATE "user"
            SET contacts_urgence = CASE
                WHEN contacts_urgence IS NULL THEN NULL
                WHEN contacts_urgence LIKE '[%' THEN contacts_urgence
                ELSE json_build_array(
                    json_build_object('nom', contacts_urgence, 'telephone', '', 'lien', '')
                )::text
            END
            WHERE type = 'patient' AND contacts_urgence IS NOT NULL
        SQL);

        // 5. Changer les types de colonnes
        $this->addSql('ALTER TABLE "user" ALTER allergies TYPE JSON USING allergies::json');
        $this->addSql('ALTER TABLE "user" ALTER contacts_urgence TYPE JSON USING contacts_urgence::json');
        $this->addSql('ALTER TABLE "user" ALTER disponibilites TYPE JSON USING disponibilites::json');
    }

    public function down(Schema $schema): void
    {
        // Restaurer les textes depuis disponibilites_texte
        $this->addSql('UPDATE "user" SET disponibilites = disponibilites_texte WHERE disponibilites_texte IS NOT NULL');

        $this->addSql('ALTER TABLE "user" DROP disponibilites_texte');
        $this->addSql('ALTER TABLE "user" ALTER allergies TYPE TEXT USING allergies::text');
        $this->addSql('ALTER TABLE "user" ALTER contacts_urgence TYPE TEXT USING contacts_urgence::text');
        $this->addSql('ALTER TABLE "user" ALTER disponibilites TYPE TEXT USING disponibilites::text');
    }
}
