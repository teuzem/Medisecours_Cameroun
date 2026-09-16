<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Entity\Maladie;
use App\Entity\ProtocoleEtape;
use App\Entity\ProtocolePremiersGestes;
use App\Repository\MaladieRepository;
use App\Repository\ProtocolePremiersGestesRepository;
use App\Service\SymptomTriageService;
use PHPUnit\Framework\TestCase;

final class SymptomTriageServiceTest extends TestCase
{
    public function testEmergencyCatalogContainsFiftyCompleteUniqueRules(): void
    {
        $reflection = new \ReflectionClass(SymptomTriageService::class);
        $rules = $reflection->getReflectionConstant('EMERGENCY_RULES')?->getValue();

        self::assertIsArray($rules);
        self::assertCount(50, $rules);

        $labels = [];
        foreach ($rules as $rule) {
            self::assertIsString($rule['label'] ?? null);
            self::assertContains($rule['level'] ?? null, ['ELEVE', 'CRITIQUE']);
            self::assertIsArray($rule['keywords'] ?? null);
            self::assertNotEmpty($rule['keywords']);
            self::assertIsArray($rule['actions'] ?? null);
            self::assertGreaterThanOrEqual(3, count($rule['actions']));
            $labels[] = $rule['label'];
        }

        self::assertCount(50, array_unique($labels));
    }

    /**
     * @dataProvider emergencyProtocolProvider
     */
    public function testEmergencyRuleLoadsExpectedPublishedProtocol(
        string $text,
        string $expectedSlug,
        string $expectedLevel
    ): void {
        $maladieRepository = $this->createMock(MaladieRepository::class);
        $maladieRepository->method('findAllForPatientTriage')->willReturn([]);

        $protocolRepository = $this->createMock(ProtocolePremiersGestesRepository::class);
        $protocolRepository
            ->expects(self::once())
            ->method('findPublicBySlugs')
            ->with([$expectedSlug])
            ->willReturn([$this->protocol($expectedSlug, $expectedLevel)]);

        $result = (new SymptomTriageService($maladieRepository, $protocolRepository))->triage([
            'texteLibre' => $text,
            'symptomes' => [],
            'contextes' => [],
        ]);

        self::assertTrue($result['orientation']['urgenceDetectee']);
        self::assertSame($expectedLevel, $result['orientation']['niveau']);
        self::assertSame($expectedLevel, $result['orientation']['niveauUrgence']);
        self::assertSame($expectedSlug, $result['orientation']['protocoles'][0]['slug']);
        self::assertNotEmpty($result['orientation']['actionsImmediates']);
        self::assertNotEmpty($result['orientation']['actionsInterdites']);
    }

    /**
     * @return iterable<string, array{string, string, string}>
     */
    public function emergencyProtocolProvider(): iterable
    {
        yield 'airway obstruction' => ['ne peut plus parler', 'etouffement', 'CRITIQUE'];
        yield 'poisoning' => ['produit menager avale', 'intoxication', 'ELEVE'];
        yield 'severe allergy' => ['gonflement langue', 'reaction_allergique', 'CRITIQUE'];
        yield 'head trauma' => ['traumatisme tete', 'traumatisme', 'ELEVE'];
        yield 'deep wound' => ['plaie profonde', 'plaie', 'ELEVE'];
        yield 'cardiac arrest' => ['absence de respiration', 'arret_cardiorespiratoire', 'CRITIQUE'];
        yield 'suspected stroke' => ['bouche deviee', 'avc_suspecte', 'CRITIQUE'];
        yield 'snakebite' => ['serpent venimeux', 'morsure_serpent', 'CRITIQUE'];
        yield 'pregnancy bleeding' => ['saignement pendant grossesse', 'saignement_grossesse', 'ELEVE'];
        yield 'carbon monoxide' => ['monoxyde de carbone', 'monoxyde_carbone', 'CRITIQUE'];
        yield 'severe malaria' => ['paludisme severe', 'paludisme_signes_graves', 'CRITIQUE'];
    }

    public function testNegatedDangerSignDoesNotTriggerEmergencyProtocol(): void
    {
        $maladieRepository = $this->createMock(MaladieRepository::class);
        $maladieRepository->method('findAllForPatientTriage')->willReturn([]);

        $protocolRepository = $this->createMock(ProtocolePremiersGestesRepository::class);
        $protocolRepository->expects(self::never())->method('findPublicBySlugs');

        $result = (new SymptomTriageService($maladieRepository, $protocolRepository))->triage([
            'texteLibre' => 'pas de gonflement langue',
            'symptomes' => [],
            'contextes' => [],
        ]);

        self::assertFalse($result['orientation']['urgenceDetectee']);
        self::assertSame([], $result['orientation']['protocoles']);
    }

    public function testInternalScoreRanksCausesButNeverExposesDiagnosticConfidenceOrTreatment(): void
    {
        $maladie = (new Maladie())
            ->setNom('Affection test')
            ->setDescription('Description test')
            ->setSymptomes('gonflement langue')
            ->setNiveauGravite('ELEVE')
            ->setUrgence(false)
            ->setContagieux(false);

        $maladieRepository = $this->createMock(MaladieRepository::class);
        $maladieRepository->method('findAllForPatientTriage')->willReturn([$maladie]);

        $protocolRepository = $this->createMock(ProtocolePremiersGestesRepository::class);
        $protocolRepository->method('findPublicBySlugs')->willReturn([]);

        $result = (new SymptomTriageService($maladieRepository, $protocolRepository))->triage([
            'symptomes' => ['gonflement langue'],
            'contextes' => [],
        ]);

        self::assertCount(1, $result['causesAEvaluer']);
        self::assertSame('Affection test', $result['causesAEvaluer'][0]['nom']);
        self::assertArrayNotHasKey('_scoreInterne', $result['causesAEvaluer'][0]);
        self::assertArrayNotHasKey('confidence', $result['causesAEvaluer'][0]);
        self::assertArrayNotHasKey('niveauCorrespondance', $result['causesAEvaluer'][0]);
        self::assertArrayNotHasKey('traitement', $result['causesAEvaluer'][0]);
        self::assertArrayNotHasKey('premiersSoins', $result['causesAEvaluer'][0]);
        self::assertFalse($result['decisionSupport']['diagnostic'] ?? false);
    }

    private function protocol(string $slug, string $level): ProtocolePremiersGestes
    {
        $step = (new ProtocoleEtape())
            ->setPosition(1)
            ->setType('FAIRE')
            ->setInstruction('Contacter les urgences.');

        return (new ProtocolePremiersGestes())
            ->setSlug($slug)
            ->setTitre('Protocole test')
            ->setNiveauUrgence($level)
            ->setVersion('1.0')
            ->setSourceClinique('OMS, https://www.who.int/example')
            ->addEtape($step);
    }
}
