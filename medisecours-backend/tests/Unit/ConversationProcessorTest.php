<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use ApiPlatform\Metadata\Post;
use ApiPlatform\State\ProcessorInterface;
use App\Entity\Conversation;
use App\Entity\Medecin;
use App\Entity\Patient;
use App\Entity\User;
use App\Repository\ConversationRepository;
use App\State\ConversationProcessor;
use PHPUnit\Framework\TestCase;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Symfony\Component\Uid\Uuid;

final class ConversationProcessorTest extends TestCase
{
    public function testConversationMustAssociateOnePatientAndOneDoctor(): void
    {
        $patient = $this->withId(new Patient());
        $otherPatient = $this->withId(new Patient());
        $conversation = (new Conversation())
            ->addParticipant($patient)
            ->addParticipant($otherPatient);

        $security = $this->createMock(Security::class);
        $security->method('getUser')->willReturn($patient);

        $processor = new ConversationProcessor(
            $this->createMock(ProcessorInterface::class),
            $security,
            $this->createMock(ConversationRepository::class),
        );

        $this->expectException(BadRequestHttpException::class);
        $this->expectExceptionMessage('exactement un patient et un médecin');
        $processor->process($conversation, new Post());
    }

    public function testUnvalidatedDoctorCannotReceiveANewConversation(): void
    {
        $patient = $this->withId(new Patient());
        $doctor = $this->withId(new Medecin());
        $conversation = (new Conversation())
            ->addParticipant($patient)
            ->addParticipant($doctor);

        $security = $this->createMock(Security::class);
        $security->method('getUser')->willReturn($patient);

        $processor = new ConversationProcessor(
            $this->createMock(ProcessorInterface::class),
            $security,
            $this->createMock(ConversationRepository::class),
        );

        $this->expectException(BadRequestHttpException::class);
        $this->expectExceptionMessage('n’est pas autorisé');
        $processor->process($conversation, new Post());
    }

    public function testValidConversationGetsADeterministicPairKey(): void
    {
        $patient = $this->withId(new Patient());
        $doctor = $this->withId((new Medecin())->setEstValide(true));
        $conversation = (new Conversation())
            ->addParticipant($patient)
            ->addParticipant($doctor);

        $security = $this->createMock(Security::class);
        $security->method('getUser')->willReturn($patient);

        $repository = $this->createMock(ConversationRepository::class);
        $repository->method('findOneBy')->willReturn(null);
        $repository->method('findExactParticipants')->willReturn(null);

        $persist = $this->createMock(ProcessorInterface::class);
        $persist->expects(self::once())
            ->method('process')
            ->with($conversation)
            ->willReturn($conversation);

        $result = (new ConversationProcessor($persist, $security, $repository))
            ->process($conversation, new Post());

        self::assertSame($conversation, $result);
        self::assertSame(ConversationRepository::pairKey($patient, $doctor), $conversation->getPairKey());
    }

    private function withId(User $user): User
    {
        $property = new \ReflectionProperty(User::class, 'id');
        $property->setValue($user, Uuid::v4());

        return $user;
    }
}
