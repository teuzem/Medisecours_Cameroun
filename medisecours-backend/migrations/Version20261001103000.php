<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261001103000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add controlled facility access, payment, insurance and transfer metadata.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql("ALTER TABLE centre_de_sante ADD paiement JSON NOT NULL DEFAULT '[]'");
        $this->addSql("ALTER TABLE centre_de_sante ADD assurance JSON NOT NULL DEFAULT '[]'");
        $this->addSql("ALTER TABLE centre_de_sante ADD evacuation_sanitaire JSON NOT NULL DEFAULT '[]'");
        $this->addSql("ALTER TABLE centre_de_sante ADD acces_route JSON NOT NULL DEFAULT '[]'");
        $this->addSql("ALTER TABLE centre_de_sante ADD parking JSON NOT NULL DEFAULT '[]'");
        $this->addSql("ALTER TABLE centre_de_sante ADD langues JSON NOT NULL DEFAULT '[]'");
        $this->addSql('ALTER TABLE centre_de_sante ADD teleconsultation BOOLEAN NOT NULL DEFAULT FALSE');
        $this->addSql('ALTER TABLE centre_de_sante ADD prise_rendez_vous BOOLEAN NOT NULL DEFAULT FALSE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE centre_de_sante DROP paiement');
        $this->addSql('ALTER TABLE centre_de_sante DROP assurance');
        $this->addSql('ALTER TABLE centre_de_sante DROP evacuation_sanitaire');
        $this->addSql('ALTER TABLE centre_de_sante DROP acces_route');
        $this->addSql('ALTER TABLE centre_de_sante DROP parking');
        $this->addSql('ALTER TABLE centre_de_sante DROP langues');
        $this->addSql('ALTER TABLE centre_de_sante DROP teleconsultation');
        $this->addSql('ALTER TABLE centre_de_sante DROP prise_rendez_vous');
    }
}
