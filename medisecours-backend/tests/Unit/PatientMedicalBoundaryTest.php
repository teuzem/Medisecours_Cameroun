<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Command\GenerateFirstAidCatalogCommand;
use App\Controller\PublicConditionController;
use App\Entity\Maladie;
use PHPUnit\Framework\TestCase;

final class PatientMedicalBoundaryTest extends TestCase
{
    public function testFirstAidCatalogDefinesExactlyFiveVariantsForOneHundredMasters(): void
    {
        $reflection = new \ReflectionClass(GenerateFirstAidCatalogCommand::class);
        $topics = $reflection->getReflectionConstant('TOPICS')?->getValue();
        $variants = $reflection->getReflectionConstant('VARIANTS')?->getValue();

        self::assertIsArray($topics);
        self::assertIsArray($variants);
        self::assertCount(5, $variants);

        $masterCount = array_sum(array_map('count', $topics));
        self::assertSame(100, $masterCount);
        self::assertSame(500, $masterCount * count($variants));
        self::assertSame(
            ['STANDARD', 'TEMOIN_SEUL', 'SECOURS_ELOIGNES', 'TRANSPORT_EN_COURS', 'PLUSIEURS_VICTIMES'],
            array_keys($variants)
        );
    }

    public function testPublicConditionDtoNeverContainsTreatmentOrLegacyFirstAid(): void
    {
        $condition = (new Maladie())
            ->setNom('Condition test')
            ->setDescription('Description suffisamment longue')
            ->setSymptomes('Signe observable')
            ->setPrecautions('Prévention générale')
            ->setTraitement('Traitement médical confidentiel')
            ->setNiveauGravite('MODÉRÉE')
            ->setPatientVisible(true);

        $controller = (new \ReflectionClass(PublicConditionController::class))->newInstanceWithoutConstructor();
        $method = new \ReflectionMethod(PublicConditionController::class, 'serialize');
        $data = $method->invoke($controller, $condition);

        self::assertArrayNotHasKey('traitement', $data);
        self::assertArrayNotHasKey('premiersSoins', $data);
        self::assertArrayNotHasKey('patientPriority', $data);
        self::assertArrayNotHasKey('patientCatalogueReviewedAt', $data);
        self::assertSame('Condition test', $data['nom']);
    }
}
