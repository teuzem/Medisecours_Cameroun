<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Controller\SignalementMedecinController;
use App\Entity\Medecin;
use App\Entity\Patient;
use App\Entity\SignalementMedecin;
use App\Repository\ConsultationRepository;
use App\Repository\SignalementMedecinRepository;
use App\Repository\UserRepository;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\TestCase;
use Symfony\Component\DependencyInjection\Container;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Security\Core\Authentication\Token\Storage\TokenStorageInterface;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;

final class SignalementMedecinControllerTest extends TestCase
{
    public function testPatientWithCompletedConsultationCanReportDoctor(): void
    {
        $patient = (new Patient())->setEmail('patient@example.test');
        $medecin = (new Medecin())->setEmail('medecin@example.test');
        $users = $this->userRepositoryReturning($medecin);
        $consultations = $this->createMock(ConsultationRepository::class);
        $consultations
            ->expects(self::once())
            ->method('hasCompletedConsultation')
            ->with($patient, $medecin)
            ->willReturn(true);
        $entityManager = $this->createMock(EntityManagerInterface::class);
        $entityManager
            ->expects(self::once())
            ->method('persist')
            ->with(self::callback(static function (SignalementMedecin $signalement) use ($patient, $medecin): bool {
                return $signalement->getPatient() === $patient
                    && $signalement->getMedecin() === $medecin
                    && $signalement->getMotif() === SignalementMedecin::MOTIF_NEGLIGENCE
                    && $signalement->getDescription() === 'Une description suffisamment précise des faits constatés.';
            }));
        $entityManager->expects(self::once())->method('flush');

        $response = $this->controllerFor($patient)->create(
            $this->request([
                'medecin' => '/api/users/doctor-id',
                'motif' => SignalementMedecin::MOTIF_NEGLIGENCE,
                'description' => 'Une description suffisamment précise des faits constatés.',
            ]),
            $users,
            $consultations,
            $entityManager,
        );

        self::assertSame(201, $response->getStatusCode());
        self::assertSame(
            SignalementMedecin::STATUT_NOUVEAU,
            json_decode((string) $response->getContent(), true)['statut'],
        );
    }

    public function testReportIsRejectedWithoutCompletedConsultation(): void
    {
        $patient = (new Patient())->setEmail('patient@example.test');
        $medecin = (new Medecin())->setEmail('medecin@example.test');
        $consultations = $this->createMock(ConsultationRepository::class);
        $consultations->method('hasCompletedConsultation')->willReturn(false);
        $entityManager = $this->createMock(EntityManagerInterface::class);
        $entityManager->expects(self::never())->method('persist');
        $entityManager->expects(self::never())->method('flush');

        $response = $this->controllerFor($patient)->create(
            $this->validRequest(),
            $this->userRepositoryReturning($medecin),
            $consultations,
            $entityManager,
        );

        self::assertSame(403, $response->getStatusCode());
    }

    public function testPatientCanReportSameDoctorSeveralTimes(): void
    {
        $patient = (new Patient())->setEmail('patient@example.test');
        $medecin = (new Medecin())->setEmail('medecin@example.test');
        $users = $this->userRepositoryReturning($medecin);
        $consultations = $this->createMock(ConsultationRepository::class);
        $consultations->method('hasCompletedConsultation')->willReturn(true);
        $entityManager = $this->createMock(EntityManagerInterface::class);
        $entityManager->expects(self::exactly(2))->method('persist');
        $entityManager->expects(self::exactly(2))->method('flush');
        $controller = $this->controllerFor($patient);

        $firstResponse = $controller->create(
            $this->validRequest(),
            $users,
            $consultations,
            $entityManager,
        );
        $secondResponse = $controller->create(
            $this->request([
                'medecin' => 'doctor-id',
                'motif' => SignalementMedecin::MOTIF_FRAUDE,
                'description' => 'Un second signalement distinct avec des faits suffisamment détaillés.',
            ]),
            $users,
            $consultations,
            $entityManager,
        );

        self::assertSame(201, $firstResponse->getStatusCode());
        self::assertSame(201, $secondResponse->getStatusCode());
    }

    public function testInvalidReasonIsRejected(): void
    {
        $response = $this->createWithPayload([
            'medecin' => 'doctor-id',
            'motif' => 'MOTIF_INCONNU',
            'description' => 'Une description suffisamment précise des faits constatés.',
        ]);

        self::assertSame(422, $response->getStatusCode());
    }

    public function testDescriptionShorterThanTwentyCharactersIsRejected(): void
    {
        $response = $this->createWithPayload([
            'medecin' => 'doctor-id',
            'motif' => SignalementMedecin::MOTIF_AUTRE,
            'description' => 'Trop court.',
        ]);

        self::assertSame(422, $response->getStatusCode());
    }

    public function testPatientCanSeeAdminResponseInOwnReportHistory(): void
    {
        $patient = (new Patient())->setEmail('patient@example.test');
        $medecin = (new Medecin())
            ->setNom('Sikombe')
            ->setPrenom('Albert')
            ->setEmail('medecin@example.test')
            ->setSpecialite('Médecine générale');
        $handledAt = new \DateTimeImmutable('2026-08-08 12:00:00');
        $signalement = (new SignalementMedecin())
            ->setPatient($patient)
            ->setMedecin($medecin)
            ->setMotif(SignalementMedecin::MOTIF_NEGLIGENCE)
            ->setDescription('Une description suffisamment précise des faits constatés.')
            ->setStatut(SignalementMedecin::STATUT_TRAITE)
            ->setNoteAdmin('Le signalement a été vérifié et le patient a été informé.')
            ->setUpdatedAt($handledAt)
            ->setTraiteAt($handledAt);
        $signalements = $this->createMock(SignalementMedecinRepository::class);
        $signalements
            ->expects(self::once())
            ->method('findForPatient')
            ->with($patient)
            ->willReturn([$signalement]);

        $response = $this->controllerFor($patient)->mine($signalements);
        $payload = json_decode((string) $response->getContent(), true);
        $item = $payload['items'][0];

        self::assertSame(200, $response->getStatusCode());
        self::assertSame('Sikombe', $item['medecin']['nom']);
        self::assertSame('Albert', $item['medecin']['prenom']);
        self::assertSame('Médecine générale', $item['medecin']['specialite']);
        self::assertSame(SignalementMedecin::STATUT_TRAITE, $item['statut']);
        self::assertSame(
            'Le signalement a été vérifié et le patient a été informé.',
            $item['noteAdmin'],
        );
        self::assertSame($handledAt->format(\DateTimeInterface::ATOM), $item['traiteAt']);
    }

    private function createWithPayload(array $payload): \Symfony\Component\HttpFoundation\JsonResponse
    {
        $patient = (new Patient())->setEmail('patient@example.test');
        $medecin = (new Medecin())->setEmail('medecin@example.test');
        $consultations = $this->createMock(ConsultationRepository::class);
        $consultations->method('hasCompletedConsultation')->willReturn(true);
        $entityManager = $this->createMock(EntityManagerInterface::class);
        $entityManager->expects(self::never())->method('persist');
        $entityManager->expects(self::never())->method('flush');

        return $this->controllerFor($patient)->create(
            $this->request($payload),
            $this->userRepositoryReturning($medecin),
            $consultations,
            $entityManager,
        );
    }

    private function validRequest(): Request
    {
        return $this->request([
            'medecin' => 'doctor-id',
            'motif' => SignalementMedecin::MOTIF_AUTRE,
            'description' => 'Une description suffisamment précise des faits constatés.',
        ]);
    }

    private function request(array $payload): Request
    {
        return new Request(content: json_encode($payload, JSON_THROW_ON_ERROR));
    }

    private function userRepositoryReturning(Medecin $medecin): UserRepository
    {
        $users = $this->createMock(UserRepository::class);
        $users->method('find')->with('doctor-id')->willReturn($medecin);

        return $users;
    }

    private function controllerFor(Patient $patient): SignalementMedecinController
    {
        $token = $this->createMock(TokenInterface::class);
        $token->method('getUser')->willReturn($patient);

        $tokenStorage = $this->createMock(TokenStorageInterface::class);
        $tokenStorage->method('getToken')->willReturn($token);

        $container = new Container();
        $container->set('security.token_storage', $tokenStorage);

        $controller = new SignalementMedecinController();
        $controller->setContainer($container);

        return $controller;
    }
}
