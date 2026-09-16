<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Controller\Admin\AdminSignalementController;
use App\Entity\Medecin;
use App\Entity\Patient;
use App\Entity\SignalementMedecin;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\TestCase;
use Symfony\Component\DependencyInjection\Container;
use Symfony\Component\HttpFoundation\Request;

final class AdminSignalementControllerTest extends TestCase
{
    public function testAdminCanMarkReportAsHandled(): void
    {
        $signalement = $this->report();
        $entityManager = $this->createMock(EntityManagerInterface::class);
        $entityManager->expects(self::once())->method('flush');

        $response = $this->controller()->update(
            $signalement,
            new Request(content: json_encode([
                'statut' => SignalementMedecin::STATUT_TRAITE,
                'noteAdmin' => 'Le dossier a été vérifié et les mesures nécessaires ont été prises.',
            ], JSON_THROW_ON_ERROR)),
            $entityManager,
        );

        self::assertSame(200, $response->getStatusCode());
        self::assertSame(SignalementMedecin::STATUT_TRAITE, $signalement->getStatut());
        self::assertSame(
            'Le dossier a été vérifié et les mesures nécessaires ont été prises.',
            $signalement->getNoteAdmin(),
        );
        self::assertNotNull($signalement->getTraiteAt());
    }

    public function testRejectedReportGetsHandledDate(): void
    {
        $signalement = $this->report();
        $entityManager = $this->createMock(EntityManagerInterface::class);
        $entityManager->expects(self::once())->method('flush');

        $this->controller()->update(
            $signalement,
            new Request(content: json_encode([
                'statut' => SignalementMedecin::STATUT_REJETE,
            ], JSON_THROW_ON_ERROR)),
            $entityManager,
        );

        self::assertSame(SignalementMedecin::STATUT_REJETE, $signalement->getStatut());
        self::assertNotNull($signalement->getTraiteAt());
    }

    public function testReopeningReportClearsHandledDate(): void
    {
        $signalement = $this->report()
            ->setStatut(SignalementMedecin::STATUT_TRAITE)
            ->setTraiteAt(new \DateTimeImmutable('-1 day'));
        $entityManager = $this->createMock(EntityManagerInterface::class);
        $entityManager->expects(self::once())->method('flush');

        $this->controller()->update(
            $signalement,
            new Request(content: json_encode([
                'statut' => SignalementMedecin::STATUT_EN_COURS,
            ], JSON_THROW_ON_ERROR)),
            $entityManager,
        );

        self::assertSame(SignalementMedecin::STATUT_EN_COURS, $signalement->getStatut());
        self::assertNull($signalement->getTraiteAt());
    }

    public function testInvalidStatusIsRejected(): void
    {
        $signalement = $this->report();
        $entityManager = $this->createMock(EntityManagerInterface::class);
        $entityManager->expects(self::never())->method('flush');

        $response = $this->controller()->update(
            $signalement,
            new Request(content: json_encode(['statut' => 'INCONNU'], JSON_THROW_ON_ERROR)),
            $entityManager,
        );

        self::assertSame(422, $response->getStatusCode());
        self::assertSame(SignalementMedecin::STATUT_NOUVEAU, $signalement->getStatut());
        self::assertNull($signalement->getTraiteAt());
    }

    private function report(): SignalementMedecin
    {
        return (new SignalementMedecin())
            ->setPatient(
                (new Patient())
                    ->setNom('Patient')
                    ->setPrenom('Test')
                    ->setEmail('patient@example.test'),
            )
            ->setMedecin(
                (new Medecin())
                    ->setNom('Médecin')
                    ->setPrenom('Test')
                    ->setEmail('medecin@example.test')
                    ->setSpecialite('Médecine générale'),
            )
            ->setMotif(SignalementMedecin::MOTIF_NEGLIGENCE)
            ->setDescription('Une description suffisamment précise des faits constatés.');
    }

    private function controller(): AdminSignalementController
    {
        $controller = new AdminSignalementController();
        $controller->setContainer(new Container());

        return $controller;
    }
}
