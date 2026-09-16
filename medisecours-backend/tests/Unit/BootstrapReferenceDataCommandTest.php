<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Command\BootstrapReferenceDataCommand;
use Doctrine\DBAL\Connection;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Tester\CommandTester;

final class BootstrapReferenceDataCommandTest extends TestCase
{
    public function testCheckSucceedsWhenExpectedCatalogVolumesArePresent(): void
    {
        $connection = $this->createMock(Connection::class);
        $connection->expects(self::exactly(3))
            ->method('fetchOne')
            ->willReturnOnConsecutiveCalls('1026', '200', '500');

        $tester = new CommandTester(new BootstrapReferenceDataCommand($connection));
        $exitCode = $tester->execute(['--check' => true]);

        self::assertSame(Command::SUCCESS, $exitCode);
        self::assertStringContainsString('Maladies stockees', $tester->getDisplay());
        self::assertStringContainsString('500', $tester->getDisplay());
    }

    public function testCheckFailsWhenPatientCatalogIsIncomplete(): void
    {
        $connection = $this->createMock(Connection::class);
        $connection->expects(self::exactly(3))
            ->method('fetchOne')
            ->willReturnOnConsecutiveCalls('1026', '199', '500');

        $tester = new CommandTester(new BootstrapReferenceDataCommand($connection));
        $exitCode = $tester->execute(['--check' => true]);

        self::assertSame(Command::FAILURE, $exitCode);
        self::assertStringContainsString('volumes minimaux', $tester->getDisplay());
    }
}
