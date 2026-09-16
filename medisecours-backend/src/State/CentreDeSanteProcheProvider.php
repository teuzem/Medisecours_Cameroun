<?php

namespace App\State;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProviderInterface;
use App\Repository\CentreDeSanteRepository;
use Symfony\Component\HttpFoundation\RequestStack;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;

class CentreDeSanteProcheProvider implements ProviderInterface
{
    public function __construct(
        private CentreDeSanteRepository $repository,
        private RequestStack $requestStack
    ) {
    }

    public function provide(Operation $operation, array $uriVariables = [], array $context = []): object|array|null
    {
        $request = $this->requestStack->getCurrentRequest();

        $lat = $request->query->get('lat');
        $lng = $request->query->get('lng');
        $rayon = (float) $request->query->get('rayon', 25);
        $limit = (int) $request->query->get('limit', 30);
        $type = $request->query->get('type');
        $ville = $request->query->get('ville');
        $specialite = $request->query->get('specialite');

        if ($lat === null || $lng === null) {
            throw new BadRequestHttpException('Les paramètres "lat" et "lng" sont obligatoires.');
        }

        if (!is_numeric($lat) || !is_numeric($lng)) {
            throw new BadRequestHttpException('Les coordonnées doivent être des nombres valides.');
        }

        return $this->repository->findProches(
            (float) $lat,
            (float) $lng,
            $rayon,
            $limit,
            $type,
            $ville,
            $specialite
        );
    }
}
