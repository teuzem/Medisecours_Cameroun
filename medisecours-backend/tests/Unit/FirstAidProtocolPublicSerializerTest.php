<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Entity\ProtocoleEtape;
use App\Entity\ProtocolePremiersGestes;
use App\Service\FirstAidProtocolPublicSerializer;
use PHPUnit\Framework\TestCase;

final class FirstAidProtocolPublicSerializerTest extends TestCase
{
    public function testPublicPayloadContainsContentWithoutAdministrativeFields(): void
    {
        $protocol = (new ProtocolePremiersGestes())
            ->setSlug('candidate')
            ->setMasterSlug('candidate')
            ->setVariantKey('STANDARD')
            ->setTitre('Candidate')
            ->setStatut(ProtocolePremiersGestes::STATUT_BROUILLON);

        $data = (new FirstAidProtocolPublicSerializer())->serialize($protocol);

        self::assertSame('candidate', $data['slug']);
        self::assertSame('candidate', $data['masterSlug']);
        self::assertSame('STANDARD', $data['variantKey']);
        self::assertSame([
            'slug',
            'titre',
            'categorie',
            'masterSlug',
            'variantKey',
            'niveauUrgence',
            'population',
            'version',
            'sourceClinique',
            'restrictionsPopulations',
            'etapes',
        ], array_keys($data));
    }

    public function testStepTitleAndInstructionAreExposedSeparately(): void
    {
        $protocol = (new ProtocolePremiersGestes())
            ->setSlug('cardiac-arrest')
            ->setTitre('Absence de respiration normale')
            ->addEtape(
                (new ProtocoleEtape())
                    ->setPosition(1)
                    ->setType('FAIRE')
                    ->setTitre('Commencer les compressions thoraciques')
                    ->setInstruction('Comprimer au centre de la poitrine.')
            );

        $data = (new FirstAidProtocolPublicSerializer())->serialize($protocol);

        self::assertSame('Commencer les compressions thoraciques', $data['etapes'][0]['titre']);
        self::assertSame('Comprimer au centre de la poitrine.', $data['etapes'][0]['instruction']);
    }
}
