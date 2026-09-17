<?php

declare(strict_types=1);

namespace App\State;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProcessorInterface;
use App\Entity\CentreDeSante;
use App\Entity\DemandeSos;
use App\Entity\User;
use App\Repository\CentreDeSanteRepository;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;

/**
 * Envoi d'une alerte SOS.
 *
 * - Accessible sans authentification (SOS d'un visiteur).
 * - Si l'utilisateur est connecté, son compte, nom et téléphone sont pré-remplis.
 * - Calcule les 8 établissements les plus proches dans un rayon de 50 km
 *   et les retourne dans la réponse (champ `proches`) pour une action immédiate.
 */
class DemandeSosProcessor implements ProcessorInterface
{
    public function __construct(
        #[Autowire(service: 'api_platform.doctrine.orm.state.persist_processor')]
        private readonly ProcessorInterface $persistProcessor,
        private readonly Security $security,
        private readonly CentreDeSanteRepository $centreRepository
    ) {
    }

    public function process(mixed $data, Operation $operation, array $uriVariables = [], array $context = []): mixed
    {
        if ($data instanceof DemandeSos) {
            $lat = $data->getLatitude();
            $lng = $data->getLongitude();
            if ($lat === null || $lng === null) {
                throw new BadRequestHttpException('La position (lat/lng) est obligatoire.');
            }

            $user = $this->security->getUser();
            if ($user instanceof User) {
                $data->setUser($user);

                if (!$data->getNom() && ($user->getPrenom() || $user->getNom())) {
                    $data->setNom(trim(($user->getPrenom() ?? '') . ' ' . ($user->getNom() ?? '')));
                }

                if (!$data->getTelephone() && $user->getTelephone()) {
                    $data->setTelephone($user->getTelephone());
                }
            }

            $data->setStatut('EN_COURS');

            $proches = array_map(
                static function (CentreDeSante $centre): array {
                    return [
                        'id' => $centre->getId(),
                        'nom' => $centre->getNom(),
                        'distance' => $centre->getDistance() ?? 0,
                        'telephone' => $centre->getTelephone(),
                        'type' => $centre->getType(),
                        'ville' => $centre->getVille(),
                        'adresse' => $centre->getAdresse(),
                        'urgences24h' => $centre->isUrgences24h(),
                    ];
                },
                $this->centreRepository->findProches($lat, $lng, 50, 8)
            );

            $data->setProches($proches);
        }

        return $this->persistProcessor->process($data, $operation, $uriVariables, $context);
    }
}