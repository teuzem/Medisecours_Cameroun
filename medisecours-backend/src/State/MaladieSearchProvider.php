<?php

declare(strict_types=1);

namespace App\State;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProviderInterface;
use App\Repository\MaladieRepository;
use Symfony\Component\HttpFoundation\RequestStack;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Symfony\Bundle\SecurityBundle\Security;

/**
 * Provider pour la recherche full-text des maladies.
 *
 * Endpoint : GET /api/maladies/search?q=fièvre+paludisme&page=1&limit=30
 *
 * Utilise le moteur full-text PostgreSQL (tsvector/tsquery) au lieu de
 * LIKE '%terme%' qui ne fonctionne pas sur plusieurs colonnes simultanément.
 *
 * Exemple : "mal de tête fièvre" trouve le paludisme car les deux termes
 * apparaissent dans des colonnes différentes (symptomes, nom).
 */
class MaladieSearchProvider implements ProviderInterface
{
    public function __construct(
        private readonly MaladieRepository $repository,
        private readonly RequestStack $requestStack,
        private readonly Security $security,
    ) {
    }

    public function provide(Operation $operation, array $uriVariables = [], array $context = []): object|array|null
    {
        $request = $this->requestStack->getCurrentRequest();

        $q      = $request->query->get('q', '');
        $page   = max(1, (int) $request->query->get('page', 1));
        $limit  = min(50, max(1, (int) $request->query->get('limit', 30)));
        $offset = ($page - 1) * $limit;

        $categorie = $request->query->get('categorie');
        $categorieId = null;
        if (is_string($categorie) && $categorie !== '') {
            $categorieId = ctype_digit($categorie) ? (int) $categorie : (int) basename($categorie);
            $categorieId = $categorieId > 0 ? $categorieId : null;
        }

        $urgence = $request->query->has('urgence')
            ? filter_var($request->query->get('urgence'), FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE)
            : null;
        $contagieux = $request->query->has('contagieux')
            ? filter_var($request->query->get('contagieux'), FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE)
            : null;
        if (mb_strlen(trim($q)) < 2) {
            throw new BadRequestHttpException('Le terme de recherche doit contenir au moins 2 caractères.');
        }

        $patientOnly = !$this->security->isGranted('ROLE_ADMIN') && !$this->security->isGranted('ROLE_MEDECIN');

        return $this->repository->searchFullText(
            $q,
            $limit,
            $offset,
            $categorieId,
            $urgence,
            $contagieux,
            $patientOnly
        );
    }
}
