<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Entity\ProtocolePremiersGestes;
use App\Service\CameroonFirstAidPriorityService;
use PHPUnit\Framework\TestCase;

final class CameroonFirstAidPriorityServiceTest extends TestCase
{
    public function testCommonCameroonSituationsComeBeforeLessFrequentEmergencies(): void
    {
        $protocols = [
            $this->protocol('foudre', 'Personne frappée par la foudre', 'CRITIQUE'),
            $this->protocol('accident_route', 'Victime d’un accident de la route', 'CRITIQUE'),
            $this->protocol('diarrhee_aigue', 'Diarrhée aiguë', 'MOYEN'),
            $this->protocol('paludisme_signes_graves', 'Paludisme grave', 'CRITIQUE'),
            $this->protocol('difficulte_respiratoire', 'Difficulté respiratoire', 'CRITIQUE'),
            $this->protocol('malaise', 'Malaise', 'MOYEN'),
        ];

        $sorted = (new CameroonFirstAidPriorityService())->sort($protocols);

        self::assertSame(
            [
                'paludisme_signes_graves',
                'difficulte_respiratoire',
                'diarrhee_aigue',
                'accident_route',
                'malaise',
                'foudre',
            ],
            array_map(static fn (ProtocolePremiersGestes $protocol): string => $protocol->getSlug(), $sorted),
        );
    }

    public function testStandardProtocolComesBeforeItsContextualVariants(): void
    {
        $standard = $this->protocol('fievre', 'Fièvre', 'ELEVE')
            ->setMasterSlug('fievre')
            ->setVariantKey('STANDARD');
        $remote = $this->protocol('fievre-secours-eloignes', 'Fièvre - secours éloignés', 'ELEVE')
            ->setMasterSlug('fievre')
            ->setVariantKey('SECOURS_ELOIGNES');

        $sorted = (new CameroonFirstAidPriorityService())->sort([$remote, $standard]);

        self::assertSame([$standard, $remote], $sorted);
    }

    private function protocol(string $slug, string $title, string $urgency): ProtocolePremiersGestes
    {
        return (new ProtocolePremiersGestes())
            ->setSlug($slug)
            ->setTitre($title)
            ->setNiveauUrgence($urgency)
            ->setPopulation('TOUS')
            ->setVersion('1.0');
    }
}
