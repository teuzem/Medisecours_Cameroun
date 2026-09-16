<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Entity\Consultation;
use PHPUnit\Framework\TestCase;

final class ConsultationTest extends TestCase
{
    public function testClosingAConsultationSetsItsClosureDate(): void
    {
        $consultation = new Consultation();

        $consultation->setStatut(Consultation::STATUT_TERMINEE);

        self::assertSame(Consultation::STATUT_TERMINEE, $consultation->getStatut());
        self::assertInstanceOf(\DateTimeImmutable::class, $consultation->getClosedAt());
    }

    public function testReopeningAConsultationClearsItsClosureDate(): void
    {
        $consultation = new Consultation();
        $consultation->setStatut(Consultation::STATUT_TERMINEE);

        $consultation->setStatut(Consultation::STATUT_EN_COURS);

        self::assertNull($consultation->getClosedAt());
    }
}
