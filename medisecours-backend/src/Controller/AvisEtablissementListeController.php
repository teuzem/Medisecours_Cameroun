<?php

declare(strict_types=1);

namespace App\Controller;

use App\Entity\AvisEtablissement;
use App\Entity\CentreDeSante;
use App\Entity\User;
use App\Repository\AvisJaimeRepository;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Bundle\SecurityBundle\Security;
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
 * - joint les compteurs de « J'aime » et la photo de l'auteur,
 * - indique si l'utilisateur connecté a déjà aimé chaque avis,
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
    public function __invoke(
        Request $request,
        int $id,
        EntityManagerInterface $em,
        AvisJaimeRepository $jaimes,
        Security $security,
        LoggerInterface $logger,
    ): JsonResponse {
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

        $avisIds = array_values(array_filter(array_map(
            static fn (AvisEtablissement $avis): ?int => $avis->getId(),
            $items
        )));

        // Le compteur de « J'aime » est un enrichissement : il ne doit jamais
        // empêcher l'affichage des avis (une erreur ici rendait la fiche vide
        // avec un 500). En cas de souci, on renvoie 0 plutôt qu'une erreur.
        $compteurs = array_fill_keys($avisIds, 0);
        $likes = [];
        $viewer = $security->getUser();
        try {
            $compteurs = $jaimes->countByAvis($avisIds) + $compteurs;
            if ($viewer instanceof User) {
                $likes = $jaimes->likedAvisIds($viewer, $avisIds);
            }
        } catch (\Throwable $erreur) {
            $this->logger->warning('Compteur de J\'aime indisponible sur les avis.', [
                'etablissement' => $id,
                'exception' => $erreur->getMessage(),
            ]);
        }

        $response = new JsonResponse([
            'items' => array_map(
                static function (AvisEtablissement $avis) use ($compteurs, $likes): array {
                    $id = (int) $avis->getId();
                    $item = CarteController::serializeAvis($avis);
                    $item['nbJaime'] = $compteurs[$id] ?? 0;
                    $item['aimeParMoi'] = in_array($id, $likes, true);

                    return $item;
                },
                $items
            ),
            'total' => $total,
            'page' => $page,
            'aggregates' => $avisRepository->aggregatesFor($centre),
        ]);
        $response->headers->set('Cache-Control', 'no-store, must-revalidate');
        $response->headers->set('Pragma', 'no-cache');

        return $response;
    }
}