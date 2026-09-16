<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Controller\AdminProtocolController;
use App\Entity\ProtocolePremiersGestes;
use App\Repository\ProtocolePremiersGestesRepository;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\TestCase;
use Symfony\Component\DependencyInjection\Container;
use Symfony\Component\HttpFoundation\Request;

final class AdminProtocolControllerTest extends TestCase
{
    public function testProtocolCanBeMadeVisibleWithoutExternalApproval(): void
    {
        $protocol = (new ProtocolePremiersGestes())
            ->setSlug('publication_simple')
            ->setTitre('Publication simple')
            ->setStatut(ProtocolePremiersGestes::STATUT_BROUILLON);
        $entityManager = $this->createMock(EntityManagerInterface::class);
        $entityManager->expects(self::once())->method('flush');
        $request = new Request(content: json_encode([
            'statut' => 'PUBLIE',
            'sourceClinique' => '',
        ], JSON_THROW_ON_ERROR));

        $controller = new AdminProtocolController(
            $this->createMock(ProtocolePremiersGestesRepository::class)
        );
        $controller->setContainer(new Container());
        $response = $controller->updateStatus($protocol, $request, $entityManager);

        self::assertSame(200, $response->getStatusCode());
        self::assertSame(ProtocolePremiersGestes::STATUT_PUBLIE, $protocol->getStatut());
        self::assertNull($protocol->getSourceClinique());
    }

    public function testProtocolCanBeRetired(): void
    {
        $protocol = (new ProtocolePremiersGestes())
            ->setSlug('fiche_retiree')
            ->setTitre('Fiche retiree')
            ->setStatut(ProtocolePremiersGestes::STATUT_PUBLIE);
        $entityManager = $this->createMock(EntityManagerInterface::class);
        $entityManager->expects(self::once())->method('flush');
        $request = new Request(content: json_encode(['statut' => 'RETIRE'], JSON_THROW_ON_ERROR));

        $controller = new AdminProtocolController(
            $this->createMock(ProtocolePremiersGestesRepository::class)
        );
        $controller->setContainer(new Container());
        $response = $controller->updateStatus($protocol, $request, $entityManager);

        self::assertSame(200, $response->getStatusCode());
        self::assertSame(ProtocolePremiersGestes::STATUT_RETIRE, $protocol->getStatut());
    }
}
