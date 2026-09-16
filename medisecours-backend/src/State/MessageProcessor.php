<?php

declare(strict_types=1);

namespace App\State;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProcessorInterface;
use App\Entity\Consultation;
use App\Entity\Conversation;
use App\Entity\Medecin;
use App\Entity\Message;
use App\Entity\Patient;
use App\Entity\User;
use App\Message\WebSocketNotification;
use App\Repository\ConversationRepository;
use App\Service\NotificationService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Symfony\Component\Messenger\MessageBusInterface;

class MessageProcessor implements ProcessorInterface
{
    public function __construct(
        #[Autowire(service: 'api_platform.doctrine.orm.state.persist_processor')]
        private readonly ProcessorInterface $persistProcessor,
        private readonly Security $security,
        private readonly EntityManagerInterface $em,
        private readonly MessageBusInterface $messageBus,
        private readonly NotificationService $notificationService,
        private readonly ConversationRepository $conversations,
    ) {
    }

    public function process(mixed $data, Operation $operation, array $uriVariables = [], array $context = []): mixed
    {
        if ($data instanceof Message) {
            $user = $this->security->getUser();

            if (!$user instanceof User) {
                throw new AccessDeniedHttpException('Authentification requise.');
            }
            if (!$user->isActif()) {
                throw new AccessDeniedHttpException('Votre compte ne peut pas envoyer de messages.');
            }

            $data->setExpediteur($user);

            $conversation = $data->getConversation();

            if ($data->getConsultation() instanceof Consultation) {
                $conversation = $this->prepareFromConsultation($data, $data->getConsultation(), $user);
            }

            if (!$conversation instanceof Conversation) {
                throw new BadRequestHttpException('La conversation est obligatoire.');
            }

            if (!$conversation->getParticipants()->contains($user)) {
                throw new AccessDeniedHttpException('Vous ne participez pas à cette conversation.');
            }

            if ($conversation->getParticipants()->count() !== 2) {
                throw new BadRequestHttpException('Cette conversation ne respecte pas le format patient-médecin.');
            }
            $participants = $conversation->getParticipants()->toArray();
            if (
                count(array_filter($participants, static fn (User $participant): bool => $participant instanceof Patient)) !== 1
                || count(array_filter($participants, static fn (User $participant): bool => $participant instanceof Medecin)) !== 1
            ) {
                throw new BadRequestHttpException('Une conversation doit associer un patient et un médecin.');
            }

            $media = $data->getMedia();
            if (trim((string) $data->getContenu()) === '' && $media === null) {
                throw new BadRequestHttpException('Un message doit contenir du texte ou un média.');
            }

            if ($media !== null && $media->getUploadedBy() !== $user && !$this->security->isGranted('ROLE_ADMIN')) {
                throw new AccessDeniedHttpException('Vous ne pouvez pas joindre un média téléversé par un autre utilisateur.');
            }

            $parent = $data->getMessageParent();
            if ($parent !== null && $parent->getConversation() !== $conversation) {
                throw new BadRequestHttpException('Le message cité doit appartenir à la même conversation.');
            }

            $data->setConversation($conversation);
            $data->setStatut(Message::STATUT_ENVOYE);

            $conversation->setUpdatedAt(new \DateTimeImmutable());
        }

        $result = $this->persistProcessor->process($data, $operation, $uriVariables, $context);

        if ($result instanceof Message) {
            $conv = $result->getConversation();
            $conv?->setDernierMessage($result);
            foreach ($conv?->getParticipants() ?? [] as $participant) {
                if ($participant !== $result->getExpediteur()) {
                    $messageLink = $participant instanceof Medecin
                        ? '/medecin/messages?conversation=' . $conv?->getId()
                        : '/patient/messages?conversation=' . $conv?->getId();
                    $senderName = trim(sprintf(
                        '%s %s',
                        (string) $result->getExpediteur()?->getPrenom(),
                        (string) $result->getExpediteur()?->getNom(),
                    ));
                    $this->notificationService->create(
                        $participant,
                        'message_received',
                        $senderName !== '' ? 'Message de ' . $senderName : 'Nouveau message',
                        $this->messagePreview($result),
                        $messageLink,
                    );
                }
            }
            $this->em->flush();
            $this->notifyWebSocket($result);
        }

        return $result;
    }

    private function messagePreview(Message $message): string
    {
        $content = preg_replace('/\s+/u', ' ', trim((string) $message->getContenu())) ?? '';
        if ($content !== '') {
            return mb_strlen($content) > 180
                ? mb_substr($content, 0, 177) . '...'
                : $content;
        }

        return match ($message->getTypeMessage()) {
            Message::TYPE_VOIX => 'Vous avez reçu un message vocal.',
            Message::TYPE_IMAGE => 'Vous avez reçu une image.',
            Message::TYPE_VIDEO => 'Vous avez reçu une vidéo.',
            Message::TYPE_FICHIER => 'Vous avez reçu un fichier.',
            default => 'Vous avez reçu un nouveau message.',
        };
    }

    private function notifyWebSocket(Message $message): void
    {
        $conv = $message->getConversation();
        if (!$conv) return;

        $targetUserIds = array_values(array_map(
            static fn (User $participant): string => (string) $participant->getId(),
            array_filter(
                $conv->getParticipants()->toArray(),
                static fn (User $participant): bool => $participant !== $message->getExpediteur(),
            ),
        ));

        $this->messageBus->dispatch(new WebSocketNotification(
            event: 'new_message',
            payload: [
                'id' => $message->getId(),
                'contenu' => $message->getContenu(),
                'typeMessage' => $message->getTypeMessage(),
                'statut' => $message->getStatut(),
                'createdAt' => $message->getCreatedAt()?->format('c'),
                'expediteur' => [
                    'id' => $message->getExpediteur()?->getId(),
                    'nom' => $message->getExpediteur()?->getNom(),
                    'prenom' => $message->getExpediteur()?->getPrenom(),
                ],
                'conversation' => '/api/conversations/' . $conv->getId(),
                'conversationId' => (string) $conv->getId(),
                'media' => $message->getMedia() ? [
                    '@id' => '/api/media_objects/' . $message->getMedia()->getId(),
                    'contentUrl' => '/api/media_objects/' . $message->getMedia()->getId() . '/download',
                    'originalName' => $message->getMedia()->getOriginalName(),
                    'mimeType' => $message->getMedia()->getMimeType(),
                    'size' => $message->getMedia()->getSize(),
                ] : null,
                'dureeVoix' => $message->getDureeVoix(),
            ],
            targetUserIds: $targetUserIds,
        ));
    }

    private function prepareFromConsultation(Message $message, Consultation $consultation, User $user): ?Conversation
    {
        $patient = $consultation->getPatient();
        $medecin = $consultation->getMedecin();

        if (!$patient instanceof Patient || !$medecin instanceof Medecin) {
            throw new BadRequestHttpException('La consultation doit avoir un patient et un médecin.');
        }

        if ($user !== $patient && $user !== $medecin) {
            throw new AccessDeniedHttpException('Vous ne participez pas à cette consultation.');
        }

        return $this->findOrCreateConversation($patient, $medecin);
    }

    private function findOrCreateConversation(Patient $patient, Medecin $doctor): Conversation
    {
        $pairKey = ConversationRepository::pairKey($patient, $doctor);
        $this->conversations->acquirePairLock($pairKey);

        try {
            $existing = $this->conversations->findOneBy(['pairKey' => $pairKey])
                ?? $this->conversations->findExactParticipants($patient, $doctor);

            if ($existing instanceof Conversation) {
                if ($existing->getPairKey() === null) {
                    $existing->setPairKey($pairKey);
                    $this->em->flush();
                }

                return $existing;
            }

            $conversation = new Conversation();
            $conversation
                ->addParticipant($patient)
                ->addParticipant($doctor)
                ->setPairKey($pairKey);
            $this->em->persist($conversation);
            $this->em->flush();

            return $conversation;
        } finally {
            $this->conversations->releasePairLock($pairKey);
        }
    }
}
