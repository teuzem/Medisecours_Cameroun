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

            if (is_array($requestData) && (
                array_key_exists('regionCode', $requestData)
                || array_key_exists('departementCode', $requestData)
                || array_key_exists('arrondissementCode', $requestData)
            )) {
                $geography = $this->validateCameroonGeography($requestData);
                if ($geography === null) {
                    throw new UnprocessableEntityHttpException(
                        'La région, le département et l’arrondissement doivent être cohérents.'
                    );
                }
                $data
                    ->setRegion($geography['region'])
                    ->setRegionCode($geography['regionCode'])
                    ->setDepartement($geography['departement'])
                    ->setDepartementCode($geography['departementCode'])
                    ->setArrondissement($geography['arrondissement'])
                    ->setArrondissementCode($geography['arrondissementCode'])
                    ->setLatitude($geography['latitude'])
                    ->setLongitude($geography['longitude']);
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

    private function validateCameroonGeography(array $data): ?array
    {
        $reference = json_decode(
            (string) @file_get_contents(dirname(__DIR__) . '/Data/cameroon-administrative-divisions.json'),
            true
        );
        if (!is_array($reference)) {
            return null;
        }
        $regionCode = trim((string) ($data['regionCode'] ?? ''));
        $departementCode = trim((string) ($data['departementCode'] ?? ''));
        $arrondissementCode = trim((string) ($data['arrondissementCode'] ?? ''));
        $regions = array_column($reference['regions'] ?? [], null, 'id');
        $departments = array_column($reference['departments'] ?? [], null, 'id');
        $arrondissements = array_column($reference['arrondissements'] ?? [], null, 'id');
        $region = $regions[$regionCode] ?? null;
        $department = $departments[$departementCode] ?? null;
        $arrondissement = $arrondissements[$arrondissementCode] ?? null;
        if (!is_array($region) || !is_array($department) || !is_array($arrondissement)
            || ($department['regionId'] ?? null) !== $regionCode
            || ($arrondissement['regionId'] ?? null) !== $regionCode
            || ($arrondissement['departmentId'] ?? null) !== $departementCode) {
            return null;
        }
        $latitude = $data['latitude'] ?? null;
        $longitude = $data['longitude'] ?? null;
        if ($latitude === '' && $longitude === '') {
            $latitude = $longitude = null;
        }
        if ($latitude !== null || $longitude !== null) {
            if (!is_numeric($latitude) || !is_numeric($longitude)
                || (float) $latitude < 1.5 || (float) $latitude > 13.5
                || (float) $longitude < 8.0 || (float) $longitude > 16.5) {
                return null;
            }
        }
        return [
            'region' => (string) $region['nameLocal'],
            'regionCode' => $regionCode,
            'departement' => (string) $department['nameLocal'],
            'departementCode' => $departementCode,
            'arrondissement' => (string) $arrondissement['nameLocal'],
            'arrondissementCode' => $arrondissementCode,
            'latitude' => $latitude === null ? null : (float) $latitude,
            'longitude' => $longitude === null ? null : (float) $longitude,
        ];
    }
}
