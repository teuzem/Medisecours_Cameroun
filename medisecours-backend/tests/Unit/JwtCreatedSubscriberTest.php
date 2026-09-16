<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Entity\Patient;
use App\Entity\User;
use App\EventSubscriber\JwtCreatedSubscriber;
use Lexik\Bundle\JWTAuthenticationBundle\Event\JWTCreatedEvent;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Uid\Uuid;

final class JwtCreatedSubscriberTest extends TestCase
{
    public function testJwtSubjectContainsTheImmutableUserId(): void
    {
        $user = new Patient();
        $id = Uuid::v4();
        $property = new \ReflectionProperty(User::class, 'id');
        $property->setValue($user, $id);

        $event = new JWTCreatedEvent(['username' => 'patient@example.test'], $user);
        (new JwtCreatedSubscriber())->onJwtCreated($event);

        self::assertSame((string) $id, $event->getData()['sub']);
        self::assertSame('medisecours-api', $event->getData()['iss']);
        self::assertSame('medisecours-websocket', $event->getData()['aud']);
    }
}
