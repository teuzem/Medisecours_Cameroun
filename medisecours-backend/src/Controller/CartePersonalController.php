<?php

declare(strict_types=1);

namespace App\Controller;

use App\Entity\CarteCollection;
use App\Entity\CarteHistory;
use App\Entity\CarteSavedPlace;
use App\Entity\CentreDeSante;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;

final class CartePersonalController extends AbstractController
{
    private function user(): User
    {
        $user = $this->getUser();
        if (!$user instanceof User) {
            throw $this->createAccessDeniedException('Authentification requise.');
        }

        return $user;
    }

    #[Route('/api/carte/collections', methods: ['GET'])]
    public function collections(EntityManagerInterface $em): JsonResponse
    {
        $items = $em->getRepository(CarteCollection::class)->findBy(['user' => $this->user()], ['updatedAt' => 'DESC']);

        return new JsonResponse(['items' => array_map(fn (CarteCollection $item) => $this->collectionPayload($item), $items)]);
    }

    #[Route('/api/carte/collections', methods: ['POST'])]
    public function createCollection(Request $request, EntityManagerInterface $em): JsonResponse
    {
        $user = $this->user();
        $body = $request->toArray();
        $name = trim((string) ($body['name'] ?? ''));
        if ($name === '' || mb_strlen($name) > 80) {
            return new JsonResponse(['error' => 'Le nom de collection est invalide.'], Response::HTTP_UNPROCESSABLE_ENTITY);
        }
        $collection = (new CarteCollection())->setUser($user)->setName($name)->setNote(isset($body['note']) ? (string) $body['note'] : null)->setPlaces((array) ($body['places'] ?? []));
        $em->persist($collection);
        $em->flush();

        return new JsonResponse($this->collectionPayload($collection), Response::HTTP_CREATED);
    }

    #[Route('/api/carte/collections/{id}', methods: ['PATCH'])]
    public function updateCollection(int $id, Request $request, EntityManagerInterface $em): JsonResponse
    {
        $collection = $em->getRepository(CarteCollection::class)->findOneBy(['id' => $id, 'user' => $this->user()]);
        if (!$collection) {
            return new JsonResponse(['error' => 'Collection introuvable.'], Response::HTTP_NOT_FOUND);
        }
        $body = $request->toArray();
        if (array_key_exists('name', $body)) $collection->setName((string) $body['name']);
        if (array_key_exists('note', $body)) $collection->setNote($body['note'] !== null ? (string) $body['note'] : null);
        if (array_key_exists('places', $body)) $collection->setPlaces((array) $body['places']);
        $em->flush();

        return new JsonResponse($this->collectionPayload($collection));
    }

    #[Route('/api/carte/collections/{id}', methods: ['DELETE'])]
    public function deleteCollection(int $id, EntityManagerInterface $em): Response
    {
        $collection = $em->getRepository(CarteCollection::class)->findOneBy(['id' => $id, 'user' => $this->user()]);
        if (!$collection) return new JsonResponse(['error' => 'Collection introuvable.'], Response::HTTP_NOT_FOUND);
        $em->remove($collection);
        $em->flush();

        return new Response(null, Response::HTTP_NO_CONTENT);
    }

    #[Route('/api/carte/saved', methods: ['GET'])]
    public function saved(EntityManagerInterface $em): JsonResponse
    {
        $items = $em->getRepository(CarteSavedPlace::class)->findBy(['user' => $this->user()], ['createdAt' => 'DESC']);

        return new JsonResponse(['ids' => array_values(array_filter(array_map(fn (CarteSavedPlace $item) => $item->getCentre()?->getId(), $items)))]);
    }

    #[Route('/api/carte/saved/{centreId}', methods: ['PUT', 'DELETE'])]
    public function toggleSaved(int $centreId, Request $request, EntityManagerInterface $em): Response
    {
        $user = $this->user();
        $centre = $em->getRepository(CentreDeSante::class)->find($centreId);
        if (!$centre) return new JsonResponse(['error' => 'Etablissement introuvable.'], Response::HTTP_NOT_FOUND);
        $repo = $em->getRepository(CarteSavedPlace::class);
        $saved = $repo->findOneBy(['user' => $user, 'centre' => $centre]);
        if ($request->isMethod('DELETE')) {
            if ($saved) $em->remove($saved);
            $em->flush();
            return new Response(null, Response::HTTP_NO_CONTENT);
        }
        if (!$saved) {
            $em->persist((new CarteSavedPlace())->setUser($user)->setCentre($centre));
            $em->flush();
        }

        return new JsonResponse(['saved' => true], Response::HTTP_CREATED);
    }

    #[Route('/api/carte/history', methods: ['GET', 'POST'])]
    public function history(Request $request, EntityManagerInterface $em): JsonResponse
    {
        $user = $this->user();
        if ($request->isMethod('POST')) {
            $body = $request->toArray();
            $type = (string) ($body['type'] ?? 'search');
            if (!in_array($type, ['search', 'route'], true)) return new JsonResponse(['error' => 'Type invalide.'], Response::HTTP_UNPROCESSABLE_ENTITY);
            $centre = null;
            if (!empty($body['centre'])) $centre = $em->getRepository(CentreDeSante::class)->find((int) $body['centre']);
            $item = (new CarteHistory())->setUser($user)->setType($type)->setQuery(isset($body['query']) ? (string) $body['query'] : null)->setCentre($centre)->setMetadata((array) ($body['metadata'] ?? []));
            $em->persist($item);
            $em->flush();
        }
        $type = $request->query->get('type');
        $criteria = ['user' => $user];
        if (in_array($type, ['search', 'route'], true)) $criteria['type'] = $type;
        $items = $em->getRepository(CarteHistory::class)->findBy($criteria, ['createdAt' => 'DESC'], 50);

        return new JsonResponse(['items' => array_map(fn (CarteHistory $item) => [
            'id' => $item->getId(), 'type' => $item->getType(), 'query' => $item->getQuery(),
            'centre' => $item->getCentre()?->getId(), 'metadata' => $item->getMetadata(), 'createdAt' => $item->getCreatedAt()->format(DATE_ATOM),
        ], $items)]);
    }

    private function collectionPayload(CarteCollection $collection): array
    {
        return ['id' => $collection->getId(), 'name' => $collection->getName(), 'note' => $collection->getNote(), 'places' => $collection->getPlaces(), 'createdAt' => $collection->getCreatedAt()->format(DATE_ATOM), 'updatedAt' => $collection->getUpdatedAt()->format(DATE_ATOM)];
    }
}
