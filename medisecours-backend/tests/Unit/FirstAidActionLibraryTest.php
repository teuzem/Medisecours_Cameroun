<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Service\FirstAidActionLibrary;
use PHPUnit\Framework\TestCase;

final class FirstAidActionLibraryTest extends TestCase
{
    public function testLibraryContainsOneCompleteActionForEachMasterProtocol(): void
    {
        self::assertCount(100, FirstAidActionLibrary::ACTIONS);

        foreach (FirstAidActionLibrary::ACTIONS as $slug => $action) {
            self::assertNotSame('', trim($slug));
            self::assertNotSame('', trim($action['titre']), sprintf('Titre manquant pour %s.', $slug));
            self::assertNotSame('', trim($action['instruction']), sprintf('Instruction manquante pour %s.', $slug));
            self::assertGreaterThanOrEqual(
                20,
                mb_strlen($action['instruction']),
                sprintf('Instruction trop courte pour %s.', $slug)
            );
        }
    }

    public function testUnknownMasterProtocolIsRejected(): void
    {
        $this->expectException(\LogicException::class);
        FirstAidActionLibrary::get('protocole_inconnu');
    }
}
