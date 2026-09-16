<?php

declare(strict_types=1);

namespace App\State;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProcessorInterface;
use App\Entity\Conversation;
use App\Entity\Medecin;
use App\Entity\Patient;
use App\Entity\User;
use App\Repository\ConversationRepository;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;

final class ConversationProcessor implements ProcessorInterface
{
    public function __construct(
        #[Autowire(service: 'api_platform.doctrine.orm.state.persist_processor')]
        private readonly ProcessorInterface $persistProcessor,
        private readonly Security $security,
        private readonly ConversationRepository $conversations,
    ) {
    }

    public function process(mixed $data, Operation $operation, array $uriVariables = [], array $context = []): mixed
    {
        if (!$data instanceof Conversation) {
            return $this->persistProcessor->process($data, $operation, $uriVariables, $context);
        }

        $user = $this->security->getUser();
        if (!$user instanceof User) {
            throw new AccessDeniedHttpException('Authentification requise.');
        }
        if (!$user->isActif()) {
            throw new AccessDeniedHttpException('Votre compte ne peut pas créer de conversation.');
        }

        $participants = $data->getParticipants()->toArray();
        if (count($participants) !== 2 || !$data->getParticipants()->contains($user)) {
            throw new BadRequestHttpException('Une conversation doit contenir exactement le demandeur et un interlocuteur.');
        }

        $patients = array_values(array_filter($participants, static fn (mixed $participant): bool => $participant instanceof Patient));
        $doctors = array_values(array_filter($participants, static fn (mixed $participant): bool => $participant instanceof Medecin));

        if (count($patients) !== 1 || count($doctors) !== 1) {
            throw new BadRequestHttpException('Une conversation doit associer exactement un patient et un médecin.');
        }

        /** @var Medecin $doctor */
        $doctor = $doctors[0];
        if (!$doctor->isActif() || !$doctor->isEstValide()) {
            throw new BadRequestHttpException('Ce médecin n’est pas autorisé à recevoir de nouveaux messages.');
        }

        $pairKey = ConversationRepository::pairKey($patients[0], $doctor);
        $this->conversations->acquirePairLock($pairKey);

        try {
            $existing = $this->conversations->findOneBy(['pairKey' => $pairKey]);
            if ($existing instanceof Conversation) {
                return $existing;
            }

            // Compatibilité avec les conversations créées avant l'ajout de pairKey.
            $existing = $this->conversations->findExactParticipants($patients[0], $doctor);
            if ($existing instanceof Conversation) {
                $existing->setPairKey($pairKey);

                return $this->persistProcessor->process($existing, $operation, $uriVariables, $context);
            }

            $data->setPairKey($pairKey);

            return $this->persistProcessor->process($data, $operation, $uriVariables, $context);
        } finally {
            $this->conversations->releasePairLock($pairKey);
        }
    }
}
