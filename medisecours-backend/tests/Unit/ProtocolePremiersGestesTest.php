<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Entity\ProtocoleEtape;
use App\Entity\ProtocolePremiersGestes;
use PHPUnit\Framework\TestCase;

final class ProtocolePremiersGestesTest extends TestCase
{
    public function testCompareVersionsHandlesMultiDigitMinor(): void
    {
        self::assertTrue(ProtocolePremiersGestes::compareVersions('1.10', '1.9') > 0);
        self::assertTrue(ProtocolePremiersGestes::compareVersions('1.1', '1.0') > 0);
        self::assertSame(0, ProtocolePremiersGestes::compareVersions('2.3', '2.3'));
        self::assertTrue(ProtocolePremiersGestes::compareVersions('2.0', '1.99') > 0);
    }

    public function testNextVersionIncrementsMinor(): void
    {
        self::assertSame('1.1', (new ProtocolePremiersGestes())->setVersion('1.0')->nextVersion());
        self::assertSame('1.10', (new ProtocolePremiersGestes())->setVersion('1.9')->nextVersion());
        self::assertSame('2.10', (new ProtocolePremiersGestes())->setVersion('2.9')->nextVersion());
    }

    public function testDuplicateAsNewVersionKeepsContentAndCreatesDraft(): void
    {
        $original = (new ProtocolePremiersGestes())
            ->setSlug('protocole_test')
            ->setTitre('Protocole de test')
            ->setVersion('1.0')
            ->setStatut(ProtocolePremiersGestes::STATUT_PUBLIE)
            ->setCategorie('saignements')
            ->setMasterSlug('protocole_test')
            ->setVariantKey('TEMOIN_SEUL')
            ->setRestrictionsPopulations('Enfant : consulter rapidement.')
            ->setSourceClinique('Source documentaire')
            ->addEtape(
                (new ProtocoleEtape())
                    ->setPosition(1)
                    ->setType('FAIRE')
                    ->setTitre('Alerter')
                    ->setInstruction('Contacter les urgences.')
            );

        $copy = $original->duplicateAsNewVersion();

        self::assertSame('1.1', $copy->getVersion());
        self::assertSame(ProtocolePremiersGestes::STATUT_BROUILLON, $copy->getStatut());
        self::assertSame($original->getSlug(), $copy->getSlug());
        self::assertSame($original->getCategorie(), $copy->getCategorie());
        self::assertSame($original->getVariantKey(), $copy->getVariantKey());
        self::assertSame($original->getSourceClinique(), $copy->getSourceClinique());
        self::assertCount(1, $copy->getEtapes());
        self::assertNotSame($original->getEtapes()->first(), $copy->getEtapes()->first());
    }
}
