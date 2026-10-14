<?php

declare(strict_types=1);

namespace App\Controller;

use App\Entity\AvisEtablissement;
use App\Entity\AvisJaime;
use App\Entity\User;
use App\Repository\AvisJaimeRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\Routing\Annotation\Route;

/**
 * Vote « J'aime » sur un avis d'établissement.
 *
 * Un avis n'est aimé qu'une seule fois par utilisateur : la contrainte
 * d'unicité (avis_id, user_id) fait foi, et l'endpoint renvoie toujours
 * l'état absolu demandé + le compteur recalculé, afin que l'interface
 * converge même après un double-clic ou une réponse perdue.
 *
 * Réservé aux utilisateurs connectés : lisent et écrivent un avis public
 * n'implique pas de pouvoir voter anonymously.
 */
final class AvisJaimeController extends AbstractController
{
    #[Route(
        '/api/avis/{id}/jaime',
        name: 'api_avis_jaime',
        methods: ['POST', 'DELETE'],
        requirements: ['id' => '\d+']
    )]
    public function __invoke(
        int $id,
        Request $request,
        EntityManagerInterface $em,
        AvisJaimeRepository $jaimes,
        Security $security,
    ): JsonResponse {
        $user = $security->getUser();
        if (!$user instanceof User) {
            throw new AccessDeniedHttpException('Vous devez être connecté pour aimer un avis.');
        }

        $avis = $em->getRepository(AvisEtablissement::class)->find($id);
        if ($avis === null) {
            return new JsonResponse(['error' => 'Avis introuvable.'], Response::HTTP_NOT_FOUND);
        }
        // On ne vote pas sur un avis modéré/retiré : le compteur doit refléter
        // la liste réellement affichée par la lecture publique.
        if ($avis->getStatut() !== 'PUBLIE' && !$this->isGranted('ROLE_ADMIN')) {
            return new JsonResponse(['error' => 'Cet avis n’est pas publié.'], Response::HTTP_NOT_FOUND);
        }

        // DELETE retire, POST pose (ou retire si le corps demande explicitement
        // l'absence) : l'état envoyé fait foi, le client reste maître du résultat.
        $souhaite = $request->isMethod('DELETE')
            ? false
            : $this->decodeAime($request);

        $existant = $jaimes->findOneByAvisAndUser($avis, $user);
        if ($souhaite && $existant === null) {
            $em->persist(new AvisJaime($avis, $user));
        } elseif (!$souhaite && $existant !== null) {
            $em->remove($existant);
        }
        $em->flush();

        $response = new JsonResponse([
            'aime' => $souhaite,
            'nbJaime' => $jaimes->countForAvis($avis),
        ]);
        $response->headers->set('Cache-Control', 'no-store, must-revalidate');

        return $response;
    }

    /**
     * Body attendu : {"aime": true|false}. Absent ou illisible → vote positif
     * (un clic sur « J'aime » n'a pas à envoyer de corps).
     */
    private function decodeAime(Request $request): bool
    {
        $payload = json_decode($request->getContent() ?: 'null', true);
        if (!is_array($payload) || !array_key_exists('aime', $payload)) {
            return true;
        }

        return filter_var($payload['aime'], FILTER_VALIDATE_BOOLEAN);
    }
}