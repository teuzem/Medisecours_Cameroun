<?php

declare(strict_types=1);

namespace App\Controller;

use App\Entity\AvisEtablissement;
use App\Entity\CentreDeSante;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;

/**
 * Lecture publique des avis d'un établissement — voie explicite et stable.
 *
 * Contrairement à la collection API Platform générique, cette route :
 * - ne dépend d'aucun provider/filtre implicite : requête Doctrine directe
 *   sur l'entité établissement (jamais un simple entier),
 * - ne retourne que des avis PUBLIE, triés par création décroissante,
 * - renvoie une enveloppe stable {items, total, page},
 * - interdit toute mise en cache HTTP (no-store) pour que chaque avis
 *   publié apparaisse immédiatement dans les fiches.
 *
 * Lecture seule et publique : aucune authentification requise.
 */
final class AvisEtablissementListeController extends AbstractController
{
    #[Route(
        '/api/etablissements/{id}/avis',
        name: 'api_etablissement_avis_liste',
        methods: ['GET'],
        requirements: ['id' => '\d+']
    )]
    public function __invoke(Request $request, int $id, EntityManagerInterface $em): JsonResponse
    {
        $centre = $em->getRepository(CentreDeSante::class)->find($id);
        if (!$centre) {
            return new JsonResponse(['error' => 'Établissement introuvable.'], Response::HTTP_NOT_FOUND);
        }

        $noteParam = $request->query->get('note');
        $note = null;
        if ($noteParam !== null && $noteParam !== '') {
            $filtered = filter_var($noteParam, FILTER_VALIDATE_INT, [
                'options' => ['min_range' => 1, 'max_range' => 5],
            ]);
            $note = $filtered === false ? null : $filtered;
        }
        $page = max(1, (int) $request->query->get('page', 1));
        $perPage = min(100, max(1, (int) $request->query->get('itemsPerPage', 50)));

        $avisRepository = $em->getRepository(AvisEtablissement::class);
        $total = $avisRepository->countPublic($centre, $note);
        $items = $avisRepository->findPublicList($centre, $note, ($page - 1) * $perPage, $perPage);

        $response = new JsonResponse([
            'items' => array_map(
                static fn (AvisEtablissement $avis): array => CarteController::serializeAvis($avis),
                $items
            ),
            'total' => $total,
            'page' => $page,
        ]);
        $response->headers->set('Cache-Control', 'no-store, must-revalidate');
        $response->headers->set('Pragma', 'no-cache');

        return $response;
    }
}
