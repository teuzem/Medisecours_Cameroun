<?php

declare(strict_types=1);

namespace App\State;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProviderInterface;
use App\Repository\CentreDeSanteRepository;
use Symfony\Component\HttpFoundation\RequestStack;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;

/**
 * Moteur de recherche de la carte Santé.
 *
 * GET /api/carte/etablissements?q=&type=&region=&ville=&lat=&lng=&rayon=&limit=
 * - Sans coordonnées : recherche textuelle + filtres (ordre alphabétique).
 * - Avec coordonnées : établissements dans le rayon, triés par distance.
 */
class CentreDeSanteCarteProvider implements ProviderInterface
{
    public function __construct(
        private CentreDeSanteRepository $repository,
        private RequestStack $requestStack
    ) {
    }

    public function provide(Operation $operation, array $uriVariables = [], array $context = []): object|array|null
    {
        $request = $this->requestStack->getCurrentRequest();

        $lat    = $request->query->get('lat');
        $lng    = $request->query->get('lng');
        $q      = $request->query->get('q');
        $type   = $request->query->get('type');
        $region = $request->query->get('region');
        $ville  = $request->query->get('ville');
        $rayon  = (float) $request->query->get('rayon', 50);
        $limit  = (int) $request->query->get('limit', 200);

        if ($lat !== null && $lat !== '' && $lng !== null && $lng !== '') {
            if (!is_numeric($lat) || !is_numeric($lng)) {
                throw new BadRequestHttpException('Les coordonnées doivent être des nombres valides.');
            }

            return $this->repository->findProches(
                (float) $lat,
                (float) $lng,
                max(1, $rayon),
                min(500, max(1, $limit)),
                $type,
                $ville
            );
        }

        return $this->repository->search($q, $type, $region, $ville, min(500, max(1, $limit)));
    }
}