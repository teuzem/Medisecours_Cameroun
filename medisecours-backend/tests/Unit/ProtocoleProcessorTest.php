<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use ApiPlatform\Metadata\Patch;
use ApiPlatform\Metadata\Post;
use ApiPlatform\State\ProcessorInterface;
use App\Entity\ProtocolePremiersGestes;
use App\State\ProtocoleProcessor;
use PHPUnit\Framework\TestCase;

final class ProtocoleProcessorTest extends TestCase
{
    public function testNewProtocolIsCreatedAsDraft(): void
    {
        $protocol = (new ProtocolePremiersGestes())
            ->setStatut(ProtocolePremiersGestes::STATUT_PUBLIE);
        $persistProcessor = $this->createMock(ProcessorInterface::class);
        $persistProcessor->expects(self::once())->method('process')->willReturn($protocol);

        (new ProtocoleProcessor($persistProcessor))->process($protocol, new Post());

        self::assertSame(ProtocolePremiersGestes::STATUT_BROUILLON, $protocol->getStatut());
    }

    public function testExistingProtocolCanBeEditedWithoutChangingItsStatus(): void
    {
        $protocol = (new ProtocolePremiersGestes())
            ->setStatut(ProtocolePremiersGestes::STATUT_PUBLIE);
        $persistProcessor = $this->createMock(ProcessorInterface::class);
        $persistProcessor->expects(self::once())->method('process')->willReturn($protocol);

        (new ProtocoleProcessor($persistProcessor))->process($protocol, new Patch());

        self::assertSame(ProtocolePremiersGestes::STATUT_PUBLIE, $protocol->getStatut());
    }
}
