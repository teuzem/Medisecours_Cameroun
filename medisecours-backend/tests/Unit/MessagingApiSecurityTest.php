<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Delete;
use ApiPlatform\Metadata\Patch;
use App\Entity\Conversation;
use App\Entity\Message;
use PHPUnit\Framework\TestCase;

final class MessagingApiSecurityTest extends TestCase
{
    /**
     * @dataProvider immutableResources
     */
    public function testGenericPatchAndDeleteAreNotExposed(string $resourceClass): void
    {
        $reflection = new \ReflectionClass($resourceClass);
        $attribute = $reflection->getAttributes(ApiResource::class)[0] ?? null;
        self::assertNotNull($attribute);

        $resource = $attribute->newInstance();
        foreach ($resource->getOperations() ?? [] as $operation) {
            self::assertNotInstanceOf(Patch::class, $operation);
            self::assertNotInstanceOf(Delete::class, $operation);
        }
    }

    public static function immutableResources(): iterable
    {
        yield 'message' => [Message::class];
        yield 'conversation' => [Conversation::class];
    }
}
