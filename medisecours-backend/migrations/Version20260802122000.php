<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260802122000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Renseigne pair_key pour les conversations historiques sans fusion destructive.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            WITH pairs AS (
                SELECT
                    cp.conversation_id,
                    STRING_AGG(cp.user_id::text, ':' ORDER BY cp.user_id::text) AS pair_key
                FROM conversation_participants cp
                GROUP BY cp.conversation_id
                HAVING COUNT(*) = 2
            ),
            unique_pairs AS (
                SELECT
                    conversation_id,
                    pair_key,
                    COUNT(*) OVER (PARTITION BY pair_key) AS pair_count
                FROM pairs
            )
            UPDATE conversation c
            SET pair_key = unique_pairs.pair_key
            FROM unique_pairs
            WHERE c.id = unique_pairs.conversation_id
              AND c.pair_key IS NULL
              AND unique_pairs.pair_count = 1
            SQL);
    }

    public function down(Schema $schema): void
    {
        $this->addSql('UPDATE conversation SET pair_key = NULL');
    }
}
