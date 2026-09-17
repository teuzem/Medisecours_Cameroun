<?php

declare(strict_types=1);

namespace App\State;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProviderInterface;
use App\Entity\User;
use App\Repository\AffiliationMedecinRepository;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\RequestStack;

/**
 * Lecture des affiliations médecins.
 *
 * Côté public : seules les affiliations ACCEPTEE sont exposées (fiche étab.).
 * Côté administrateur : tout (validation des demandes EN_ATTENTE…).
 */
class AffiliationMedecinCollectionProvider implements ProviderInterface
{
    public function __construct(
        private AffiliationMedecinRepository $repository,
        private Security $security,
        private RequestStack $requestStack
    ) {
    }

    public function provide(Operation $operation, array $uriVariables = [], array $context = []): object|array|null
    {
        $request = $this->requestStack->getCurrentRequest();
        $etablissement = $request->query->get('etablissement');

        $qb = $this->repository->createQueryBuilder('a');

        if ($etablissement !== null && $etablissement !== '') {
            $qb->andWhere('a.etablissement = :etablissement')
                ->setParameter('etablissement', (int) $etablissement);
        }

        $user = $this->security->getUser();
        if (!($user instanceof User) || !in_array('ROLE_ADMIN', $user->getRoles(), true)) {
            $qb->andWhere('a.statut = :statut')
                ->setParameter('statut', 'ACCEPTEE');
        }

        return $qb->orderBy('a.createdAt', 'DESC')->getQuery()->getResult();
    }
}