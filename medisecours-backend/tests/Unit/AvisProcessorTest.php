<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use ApiPlatform\Metadata\Post;
use ApiPlatform\State\ProcessorInterface;
use App\Entity\Avis;
use App\Entity\Medecin;
use App\Entity\Patient;
use App\Repository\ConsultationRepository;
use App\State\AvisProcessor;
use PHPUnit\Framework\TestCase;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

final class AvisProcessorTest extends TestCase
{
    public function testPatientCanLeaveAnAvisAfterACompletedConsultation(): void
    {
        $patient = (new Patient())->setNom('Patient');
        $medecin = (new Medecin())->setNom('Test');
        $avis = (new Avis())->setMedecin($medecin)->setNote(4);

        $security = $this->createMock(Security::class);
        $security->method('getUser')->willReturn($patient);

        $consultationRepository = $this->createMock(ConsultationRepository::class);
        $consultationRepository->method('hasCompletedConsultation')->willReturn(true);

        $persistProcessor = $this->createMock(ProcessorInterface::class);
        $persistProcessor->expects(self::once())->method('process')->willReturnArgument(0);

        $processor = new AvisProcessor(
            $persistProcessor,
            $security,
            $consultationRepository
        );

        $result = $processor->process($avis, new Post());

        self::assertSame($patient, $avis->getPatient());
        self::assertSame($avis, $result);
    }

    public function testAvisRequiresACompletedConsultation(): void
    {
        $patient = (new Patient())->setNom('Patient');
        $medecin = (new Medecin())->setNom('Test');
        $avis = (new Avis())->setMedecin($medecin)->setNote(4);

        $security = $this->createMock(Security::class);
        $security->method('getUser')->willReturn($patient);

        $consultationRepository = $this->createMock(ConsultationRepository::class);
        $consultationRepository->method('hasCompletedConsultation')->willReturn(false);

        $persistProcessor = $this->createMock(ProcessorInterface::class);
        $persistProcessor->expects(self::never())->method('process');

        $processor = new AvisProcessor(
            $persistProcessor,
            $security,
            $consultationRepository
        );

        $this->expectException(AccessDeniedHttpException::class);
        $processor->process($avis, new Post());
    }

    public function testPatientCanLeaveSeveralAvisForSameMedecin(): void
    {
        $patient = (new Patient())->setNom('Patient');
        $medecin = (new Medecin())->setNom('Test');
        $firstAvis = (new Avis())->setMedecin($medecin)->setNote(4);
        $secondAvis = (new Avis())->setMedecin($medecin)->setNote(5);

        $security = $this->createMock(Security::class);
        $security->method('getUser')->willReturn($patient);

        $consultationRepository = $this->createMock(ConsultationRepository::class);
        $consultationRepository->method('hasCompletedConsultation')->willReturn(true);

        $persistProcessor = $this->createMock(ProcessorInterface::class);
        $persistProcessor->expects(self::exactly(2))->method('process')->willReturnArgument(0);

        $processor = new AvisProcessor(
            $persistProcessor,
            $security,
            $consultationRepository
        );

        self::assertSame($firstAvis, $processor->process($firstAvis, new Post()));
        self::assertSame($secondAvis, $processor->process($secondAvis, new Post()));
        self::assertSame($patient, $firstAvis->getPatient());
        self::assertSame($patient, $secondAvis->getPatient());
    }
}
