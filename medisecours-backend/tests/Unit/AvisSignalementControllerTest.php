<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Controller\AvisSignalementController;
use App\Entity\Avis;
use App\Entity\Medecin;
use App\Entity\Patient;
use App\Repository\AvisRepository;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\TestCase;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\Request;

final class AvisSignalementControllerTest extends TestCase
{
    public function testMedecinCanFlagHisOwnAvis(): void
    {
        $medecin = (new Medecin())->setNom('Test');
        $avis = (new Avis())
            ->setMedecin($medecin)
            ->setPatient((new Patient())->setNom('Patient'))
            ->setNote(2);

        $security = $this->createMock(Security::class);
        $security->method('getUser')->willReturn($medecin);

        $repository = $this->createMock(AvisRepository::class);
        $repository->method('find')->with('42')->willReturn($avis);

        $entityManager = $this->createMock(EntityManagerInterface::class);
        $entityManager->expects(self::once())->method('flush');

        $controller = new AvisSignalementController($security, $repository, $entityManager);
        $request = new Request(content: json_encode(['raison' => 'Commentaire offensant'], JSON_THROW_ON_ERROR));
        $response = $controller->signaler('42', $request);

        self::assertSame(200, $response->getStatusCode());
        self::assertTrue($avis->isSignale());
        self::assertSame('Commentaire offensant', $avis->getRaisonSignalement());
    }

    public function testMedecinCannotFlagAnotherDoctorsAvis(): void
    {
        $avis = (new Avis())
            ->setMedecin((new Medecin())->setNom('Autre médecin'))
            ->setPatient((new Patient())->setNom('Patient'))
            ->setNote(2);

        $otherMedecin = (new Medecin())->setNom('Moi');

        $security = $this->createMock(Security::class);
        $security->method('getUser')->willReturn($otherMedecin);

        $repository = $this->createMock(AvisRepository::class);
        $repository->method('find')->with('42')->willReturn($avis);

        $entityManager = $this->createMock(EntityManagerInterface::class);
        $entityManager->expects(self::never())->method('flush');

        $controller = new AvisSignalementController($security, $repository, $entityManager);
        $request = new Request(content: json_encode(['raison' => 'Raison'], JSON_THROW_ON_ERROR));
        $response = $controller->signaler('42', $request);

        self::assertSame(403, $response->getStatusCode());
        self::assertFalse($avis->isSignale());
    }

    public function testRaisonIsRequired(): void
    {
        $medecin = (new Medecin())->setNom('Test');
        $avis = (new Avis())
            ->setMedecin($medecin)
            ->setPatient((new Patient())->setNom('Patient'))
            ->setNote(2);

        $security = $this->createMock(Security::class);
        $security->method('getUser')->willReturn($medecin);

        $repository = $this->createMock(AvisRepository::class);
        $repository->method('find')->with('42')->willReturn($avis);

        $entityManager = $this->createMock(EntityManagerInterface::class);
        $entityManager->expects(self::never())->method('flush');

        $controller = new AvisSignalementController($security, $repository, $entityManager);
        $request = new Request(content: json_encode(['raison' => '   '], JSON_THROW_ON_ERROR));
        $response = $controller->signaler('42', $request);

        self::assertSame(422, $response->getStatusCode());
        self::assertFalse($avis->isSignale());
    }

    public function testUnknownAvisReturns404(): void
    {
        $medecin = (new Medecin())->setNom('Test');

        $security = $this->createMock(Security::class);
        $security->method('getUser')->willReturn($medecin);

        $repository = $this->createMock(AvisRepository::class);
        $repository->method('find')->with('999')->willReturn(null);

        $entityManager = $this->createMock(EntityManagerInterface::class);
        $entityManager->expects(self::never())->method('flush');

        $controller = new AvisSignalementController($security, $repository, $entityManager);
        $request = new Request(content: json_encode(['raison' => 'Raison'], JSON_THROW_ON_ERROR));
        $response = $controller->signaler('999', $request);

        self::assertSame(404, $response->getStatusCode());
    }
}
