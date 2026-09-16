<?php

declare(strict_types=1);

namespace App\State;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProcessorInterface;
use App\Entity\Medecin;
use App\Entity\User;
use App\Service\WebSocketNotifier;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\RequestStack;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;

class UserProfileProcessor implements ProcessorInterface
{
    public function __construct(
        #[Autowire(service: 'api_platform.doctrine.orm.state.persist_processor')]
        private readonly ProcessorInterface $persistProcessor,
        private readonly WebSocketNotifier $wsNotifier,
        private readonly EntityManagerInterface $em,
        private readonly RequestStack $requestStack,
    ) {
    }

    public function process(mixed $data, Operation $operation, array $uriVariables = [], array $context = []): mixed
    {
        $oldPhoto = null;
        if ($data instanceof User) {
            $original = $this->em->getUnitOfWork()->getOriginalEntityData($data);
            $oldPhoto = $original['photoProfil'] ?? $data->getPhotoProfil();
            $requestData = json_decode($this->requestStack->getCurrentRequest()?->getContent() ?? '', true);

            if (is_array($requestData) && array_key_exists('password', $requestData)) {
                throw new UnprocessableEntityHttpException(
                    'Utilisez la route sécurisée de changement de mot de passe.'
                );
            }

            if (
                is_array($requestData)
                && array_key_exists('email', $requestData)
                && isset($original['email'])
                && strtolower(trim((string) $requestData['email'])) !== $original['email']
            ) {
                throw new UnprocessableEntityHttpException(
                    'Utilisez la route sécurisée de changement d’adresse email.'
                );
            }

            if (
                $data instanceof Medecin
                && is_array($requestData)
                && array_key_exists('disponibilites', $requestData)
            ) {
                $data->setDisponibilites($this->normalizeDisponibilites($requestData['disponibilites']));
            }
        }

        $result = $this->persistProcessor->process($data, $operation, $uriVariables, $context);

        if ($result instanceof User && $oldPhoto !== $result->getPhotoProfil()) {
            $this->wsNotifier->broadcast([
                'event' => 'profile_photo_changed',
                'payload' => [
                    'userId' => (string) $result->getId(),
                    'photoProfil' => $result->getPhotoProfil(),
                ],
            ]);
        }

        return $result;
    }

    /**
     * @return array<array{jour: string, debut: string, fin: string}>
     */
    private function normalizeDisponibilites(mixed $value): array
    {
        if (!is_array($value)) {
            throw new UnprocessableEntityHttpException('Les disponibilités doivent être une liste de créneaux.');
        }

        $allowedDays = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
        $normalized = [];
        $seenDays = [];

        foreach ($value as $slot) {
            if (!is_array($slot)) {
                throw new UnprocessableEntityHttpException('Chaque disponibilité doit être un créneau valide.');
            }

            $day = mb_strtolower(trim((string) ($slot['jour'] ?? '')));
            $start = trim((string) ($slot['debut'] ?? ''));
            $end = trim((string) ($slot['fin'] ?? ''));

            if (!in_array($day, $allowedDays, true)) {
                throw new UnprocessableEntityHttpException(sprintf('Jour de disponibilité invalide : %s.', $day));
            }
            if (isset($seenDays[$day])) {
                throw new UnprocessableEntityHttpException(sprintf('Le jour %s est présent plusieurs fois.', $day));
            }
            if (
                preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/', $start) !== 1
                || preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/', $end) !== 1
            ) {
                throw new UnprocessableEntityHttpException(
                    sprintf('Les horaires du %s doivent utiliser le format HH:MM.', $day)
                );
            }
            if ($start >= $end) {
                throw new UnprocessableEntityHttpException(
                    sprintf('L’heure de fin du %s doit suivre l’heure de début.', $day)
                );
            }

            $seenDays[$day] = true;
            $normalized[] = [
                'jour' => $day,
                'debut' => $start,
                'fin' => $end,
            ];
        }

        return $normalized;
    }
}
