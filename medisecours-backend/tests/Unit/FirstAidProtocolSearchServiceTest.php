<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Entity\ProtocoleEtape;
use App\Entity\ProtocolePremiersGestes;
use App\Service\FirstAidProtocolSearchService;
use PHPUnit\Framework\TestCase;

final class FirstAidProtocolSearchServiceTest extends TestCase
{
    public function testPreciseSynonymQueryReturnsSingleRelevantProtocol(): void
    {
        $protocols = $this->catalog();

        $result = $this->search('sang qui coule beaucoup', $protocols);

        self::assertCount(1, $result['results']);
        self::assertSame('saignement_externe_important', $result['results'][0]['protocol']->getSlug());
    }

    public function testGibberishQueryReturnsNothingWithCategorySuggestions(): void
    {
        $result = $this->search('xylophone', $this->catalog());

        self::assertSame([], $result['results']);
        self::assertNotSame([], $result['suggestions']);
    }

    public function testNegationExcludesProtocol(): void
    {
        $protocols = [
            $this->protocol('fievre', 'Fièvre', 'MOYEN', 'fievre', ['Vérifier la température.']),
            $this->protocol('convulsion', 'Convulsions', 'CRITIQUE', 'inconscience', ['Garder l enfant en sécurité.']),
        ];

        // « pas de convulsion » : la négation doit exclure le protocole convulsion
        // et ne pas renvoyer un faux positif par le mot « convulsion ».
        $result = $this->search('pas de convulsion', $protocols);

        self::assertSame([], $result['results']);
        foreach ($result['results'] as $entry) {
            self::assertNotSame('convulsion', $entry['protocol']->getSlug());
        }
    }

    public function testCategoryQueryReturnsOnlyProtocolsOfThatCategory(): void
    {
        $protocols = [
            $this->protocol('brulure', 'Brûlure grave', 'ELEVE', 'brulures', ['Refroidir à l eau tiède.']),
            $this->protocol('plaie', 'Plaie profonde', 'MOYEN', 'saignements', ['Nettoyer la plaie.']),
        ];

        $result = $this->search('brulures', $protocols);

        self::assertCount(1, $result['results']);
        self::assertSame('brulure', $result['results'][0]['protocol']->getSlug());
    }

    public function testResultsAreRankedByUrgencyOnTie(): void
    {
        $protocols = [
            $this->protocol('douleur_thoracique', 'Douleur thoracique intense', 'CRITIQUE', 'respiration', ['Appeler les urgences.']),
            $this->protocol('etouffement', 'Obstruction des voies aériennes', 'ELEVE', 'respiration', ['Dégager les voies aériennes.']),
        ];

        $result = $this->search('respiration', $protocols);

        self::assertCount(2, $result['results']);
        self::assertSame('douleur_thoracique', $result['results'][0]['protocol']->getSlug());
    }

    /**
     * @param ProtocolePremiersGestes[] $protocols
     * @return array{results: array<int, array<string, mixed>>, suggestions: string[]}
     */
    private function search(string $query, array $protocols): array
    {
        return (new FirstAidProtocolSearchService())->search($protocols, $query);
    }

    /**
     * @return ProtocolePremiersGestes[]
     */
    private function catalog(): array
    {
        return [
            $this->protocol('saignement_externe_important', 'Saignement important', 'ELEVE', 'saignements', ['Comprimer la plaie.']),
            $this->protocol('fievre', 'Fièvre avec signes de gravité', 'ELEVE', 'fievre', ['Consulter un médecin.']),
            $this->protocol('etouffement', 'Obstruction des voies aériennes', 'ELEVE', 'respiration', ['Réaliser des claques dans le dos.']),
        ];
    }

    /**
     * @param string[] $instructions
     */
    private function protocol(string $slug, string $titre, string $urgence, string $categorie, array $instructions): ProtocolePremiersGestes
    {
        $protocol = (new ProtocolePremiersGestes())
            ->setSlug($slug)
            ->setTitre($titre)
            ->setNiveauUrgence($urgence)
            ->setCategorie($categorie);

        foreach ($instructions as $position => $instruction) {
            $protocol->addEtape(
                (new ProtocoleEtape())
                    ->setPosition($position + 1)
                    ->setType('FAIRE')
                    ->setInstruction($instruction)
            );
        }

        return $protocol;
    }
}
