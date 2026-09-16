<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Command\GenerateFirstAidCatalogCommand;
use App\Service\FirstAidContentLibrary;
use PHPUnit\Framework\TestCase;

final class FirstAidContentLibraryTest extends TestCase
{
    public function testEveryMasterProtocolHasAnInstitutionalHttpsSource(): void
    {
        $reflection = new \ReflectionClass(GenerateFirstAidCatalogCommand::class);
        $topics = $reflection->getReflectionConstant('TOPICS')?->getValue();

        self::assertIsArray($topics);

        $checked = 0;
        foreach ($topics as $items) {
            foreach ($items as [$slug]) {
                $source = FirstAidContentLibrary::sourceFor($slug);

                self::assertStringContainsString('https://', $source, sprintf('Source HTTPS absente pour %s.', $slug));
                self::assertStringNotContainsString(
                    'Référence clinique spécifique à confirmer',
                    $source,
                    sprintf('Source encore générique pour %s.', $slug)
                );
                ++$checked;
            }
        }

        self::assertSame(100, $checked);
    }

    public function testNewbornDraftNeverReusesAdultAedInstructions(): void
    {
        $steps = FirstAidContentLibrary::curatedSteps('nouveau_ne_ne_respire_pas');

        self::assertIsArray($steps);
        $content = mb_strtolower(implode(' ', array_column($steps, 'instruction')));

        self::assertStringNotContainsString('dae', $content);
        self::assertStringNotContainsString('défibrillateur', $content);
        self::assertStringContainsString('ventilation', $content);
        self::assertStringContainsString('nouveau-né', $content);
    }

    public function testSnakebiteDraftExplicitlyRejectsDangerousTraditionalActions(): void
    {
        $steps = FirstAidContentLibrary::curatedSteps('morsure_serpent');

        self::assertIsArray($steps);
        $content = mb_strtolower(implode(' ', array_column($steps, 'instruction')));

        foreach (['garrot', 'inciser', 'aspirer', 'pierre noire', 'glace', 'choc électrique'] as $forbiddenAction) {
            self::assertStringContainsString($forbiddenAction, $content);
        }
        self::assertStringContainsString('limiter strictement la marche', $content);
    }

    public function testSevereBurnDraftCallsWhileCoolingAndProtectsAgainstHypothermia(): void
    {
        $steps = FirstAidContentLibrary::curatedSteps('brulure');

        self::assertIsArray($steps);
        $content = mb_strtolower(implode(' ', array_column($steps, 'instruction')));

        self::assertStringContainsString('appeler pendant le refroidissement', $content);
        self::assertStringContainsString('vingt minutes', $content);
        self::assertStringContainsString('sans refroidir tout le corps', $content);
    }

    public function testSevereBleedingDraftContainsSafeEscalationRules(): void
    {
        $steps = FirstAidContentLibrary::curatedSteps('saignement_externe_important');

        self::assertIsArray($steps);
        $content = mb_strtolower(implode(' ', array_column($steps, 'instruction')));

        self::assertStringContainsString('appuyer très fermement sur la plaie', $content);
        self::assertStringContainsString('garrot commercial', $content);
        self::assertStringContainsString('noter l’heure de pose', $content);
        self::assertStringContainsString('ne pas le desserrer', $content);
    }

    public function testInfantChokingDraftNeverUsesAbdominalThrusts(): void
    {
        $steps = FirstAidContentLibrary::curatedSteps('obstruction_nourrisson');

        self::assertIsArray($steps);
        $content = mb_strtolower(implode(' ', array_column($steps, 'instruction')));

        self::assertStringContainsString('cinq claques dorsales', $content);
        self::assertStringContainsString('cinq compressions thoraciques', $content);
        self::assertStringContainsString('ne pas pratiquer de manœuvre abdominale', $content);
    }

    public function testEveryCuratedDraftContainsAllRequiredSafetyPhases(): void
    {
        $reflection = new \ReflectionClass(FirstAidContentLibrary::class);
        $curated = $reflection->getReflectionConstant('CURATED_STEPS')?->getValue();

        self::assertIsArray($curated);
        self::assertNotEmpty($curated);

        $requiredTypes = ['RECONNAITRE', 'PROTEGER', 'FAIRE', 'EVITER', 'SURVEILLER', 'APPELER'];
        foreach ($curated as $slug => $steps) {
            $types = array_values(array_unique(array_column($steps, 'type')));
            foreach ($requiredTypes as $requiredType) {
                self::assertContains($requiredType, $types, sprintf('Phase %s absente pour %s.', $requiredType, $slug));
            }
        }
    }
}
