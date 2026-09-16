<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260630144500 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Align consultation and message index names with Doctrine metadata.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER INDEX idx_9646858b6b899279 RENAME TO IDX_964685A66B899279');
        $this->addSql('ALTER INDEX idx_9646858b3f71d4b9 RENAME TO IDX_964685A64F31A84');
        $this->addSql('ALTER INDEX idx_b6bd307f8657b4d2 RENAME TO IDX_B6BD307F62FF6CDF');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER INDEX idx_964685a66b899279 RENAME TO IDX_9646858B6B899279');
        $this->addSql('ALTER INDEX idx_964685a64f31a84 RENAME TO IDX_9646858B3F71D4B9');
        $this->addSql('ALTER INDEX idx_b6bd307f62ff6cdf RENAME TO IDX_B6BD307F8657B4D2');
    }
}
