<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use ApiPlatform\Metadata\Post;
use ApiPlatform\State\ProcessorInterface;
use App\Entity\Consultation;
use App\Entity\Medecin;
use App\Entity\Patient;
use App\Entity\Prescription;
use App\State\PrescriptionProcessor;
use PHPUnit\Framework\TestCase;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;

final class PrescriptionProcessorTest extends TestCase
{
    public function testPrescriptionRequiresAnActiveConsultationOwnedByTheDoctor(): void
    {
        $doctor = new Medecin();
        $security = $this->createMock(Security::class);
        $security->method('getUser')->willReturn($doctor);
        $persistProcessor = $this->createMock(ProcessorInterface::class);

        $processor = new PrescriptionProcessor($persistProcessor, $security);
        $prescription = new Prescription();

        $this->expectException(BadRequestHttpException::class);
        $this->expectExceptionMessage('La consultation est obligatoire.');

        $processor->process($prescription, new Post());
    }

    public function testPrescriptionIsBoundToTheConsultationPatientAndDoctor(): void
    {
        $doctor = new Medecin();
        $patient = new Patient();
        $consultation = new Consultation();
        $consultation->setPatient($patient);
        $consultation->setMedecin($doctor);
        $consultation->setStatut(Consultation::STATUT_EN_COURS);

        $security = $this->createMock(Security::class);
        $security->method('getUser')->willReturn($doctor);
        $persistProcessor = $this->createMock(ProcessorInterface::class);
        $persistProcessor->expects(self::once())
            ->method('process')
            ->willReturnCallback(static fn (mixed $data): mixed => $data);

        $prescription = new Prescription();
        $prescription->setConsultation($consultation);

        $result = (new PrescriptionProcessor($persistProcessor, $security))
            ->process($prescription, new Post());

        self::assertSame($prescription, $result);
        self::assertSame($doctor, $prescription->getMedecin());
        self::assertSame($patient, $prescription->getPatient());
    }
}
