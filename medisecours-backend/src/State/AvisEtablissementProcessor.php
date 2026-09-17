<?php

declare(strict_types=1);

namespace App\State;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProcessorInterface;
use App\Entity\AvisEtablissement;
use App\Entity\User;
use App\Repository\AvisEtablissementRepository;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;

/**
 * Publication d'un avis sur un établissement.
 *
 * - Injecte l'utilisateur connecté comme auteur.
 * - Force le statut PUBLIE (les signaux modération arrivent ensuite).
 * - Recalcule la note moyenne et le total d'avis de l'établissement.
 */
class AvisEtablissementProcessor implements ProcessorInterface
{
    public function __construct(
        #[Autowire(service: 'api_platform.doctrine.orm.state.persist_processor')]
        private readonly ProcessorInterface $persistProcessor,
        private readonly Security $security,
        private readonly AvisEtablissementRepository $repository
    ) {
    }

    public function process(mixed $data, Operation $operation, array $uriVariables = [], array $context = []): mixed
    {
        if ($data instanceof AvisEtablissement) {
            $user = $this->security->getUser();
            if (!$user instanceof User) {
                throw new AccessDeniedHttpException('Un compte est requis pour laisser un avis.');
            }

            $etablissement = $data->getEtablissement();
            if (!$etablissement) {
                throw new BadRequestHttpException("L'établissement évalué est obligatoire.");
            }

            $data->setUser($user);
            $data->setStatut('PUBLIE');
            $data->setUpdatedAt(new \DateTimeImmutable());
        }

        $result = $this->persistProcessor->process($data, $operation, $uriVariables, $context);

        if ($result instanceof AvisEtablissement && $result->getEtablissement()) {
            $this->repository->refreshAggregates($result->getEtablissement());
        }

        return $result;
    }
}