<?php

declare(strict_types=1);

namespace App\State;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProviderInterface;
use App\Entity\User;
use App\Repository\AvisEtablissementRepository;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\RequestStack;

/**
 * Lecture des avis d'établissement.
 *
 * - Utilisateur anonyme / lambda : seuls les avis PUBLIE sont exposés.
 * - Administrateur : accès à tout (modération : EN_ATTENTE / REJETE aussi).
 */
class AvisEtablissementCollectionProvider implements ProviderInterface
{
    public function __construct(
        private AvisEtablissementRepository $repository,
        private Security $security,
        private RequestStack $requestStack
    ) {
    }

    public function provide(Operation $operation, array $uriVariables = [], array $context = []): object|array|null
    {
        $request = $this->requestStack->getCurrentRequest();
        $etablissement = $request->query->get('etablissement');
        $note = $request->query->get('note');
        $etablissementId = $etablissement !== null && $etablissement !== '' ? (int) $etablissement : null;
        $noteValue = $note !== null && $note !== '' ? (int) $note : null;

        $user = $this->security->getUser();
        if ($user instanceof User && in_array('ROLE_ADMIN', $user->getRoles(), true)) {
            $qb = $this->repository->createQueryBuilder('a')
                ->orderBy('a.createdAt', 'DESC');

            if ($etablissementId !== null) {
                $qb->andWhere('a.etablissement = :etablissement')
                    ->setParameter('etablissement', $etablissementId);
            }
            if ($noteValue !== null) {
                $qb->andWhere('a.note = :note')
                    ->setParameter('note', $noteValue);
            }

            return $qb->getQuery()->getResult();
        }

        return $this->repository->findPublicByEtablissement($etablissementId, $noteValue);
    }
}