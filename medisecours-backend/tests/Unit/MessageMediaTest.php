<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Entity\Message;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Validator\Validation;

final class MessageMediaTest extends TestCase
{
    public function testVideoIsAnAcceptedMessageType(): void
    {
        $message = (new Message())->setTypeMessage(Message::TYPE_VIDEO);
        $validator = Validation::createValidatorBuilder()->enableAttributeMapping()->getValidator();

        self::assertCount(0, $validator->validateProperty($message, 'typeMessage'));
    }

    public function testUnknownMediaTypeIsRejected(): void
    {
        $message = (new Message())->setTypeMessage('MEDIA_INCONNU');
        $validator = Validation::createValidatorBuilder()->enableAttributeMapping()->getValidator();

        self::assertCount(1, $validator->validateProperty($message, 'typeMessage'));
    }
}
