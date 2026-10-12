<?php

declare(strict_types=1);

namespace App\Controller\Api;

use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

/**
 * Disponibilité opérationnelle de l'utilisateur connecté.
 *
 * - GET   /api/me/disponibilite : { sosAlertesActive, enService }.
 * - PATCH /api/me/disponibilite : body { sosAlertesActive?: bool,
 *   enService?: bool }. Le commutateur « Me signaler les incidents SOS »
 *   rend (ou non) le médecin éligible aux alertes ; `enService` pilote les
 *   relais vers les équipages (ambulanciers) disponibles.
 */
#[Route('/api/me', name: 'api_me_disponibilite_')]
#[IsGranted('ROLE_USER')]
class DisponibiliteController extends AbstractController
{
    public function __construct(
        private readonly EntityManagerInterface $em,
    ) {
    }

    #[Route('/disponibilite', name: 'show', methods: ['GET'])]
    public function show(): JsonResponse
    {
        return new JsonResponse($this->serialize($this->requireUser()));
    }

    #[Route('/disponibilite', name: 'update', methods: ['PATCH'])]
    public function update(Request $request): JsonResponse
    {
        $user = $this->requireUser();
        $data = $request->toArray();

        if (array_key_exists('sosAlertesActive', $data)) {
            if (!is_bool($data['sosAlertesActive'])) {
                throw new BadRequestHttpException('sosAlertesActive doit être un booléen.');
            }
            $user->setSosAlertesActive($data['sosAlertesActive']);
        }
        if (array_key_exists('enService', $data)) {
            if (!is_bool($data['enService'])) {
                throw new BadRequestHttpException('enService doit être un booléen.');
            }
            $user->setEnService($data['enService']);
        }

        $this->em->flush();

        return new JsonResponse($this->serialize($user));
    }

    private function requireUser(): User
    {
        $user = $this->getUser();
        if (!$user instanceof User) {
            throw new AccessDeniedHttpException('Authentification requise.');
        }

        return $user;
    }

    /**
     * @return array<string, bool>
     */
    private function serialize(User $user): array
    {
        return [
            'sosAlertesActive' => $user->isSosAlertesActive(),
            'enService' => $user->isEnService(),
        ];
    }
}
