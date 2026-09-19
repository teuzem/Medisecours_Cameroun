<?php

declare(strict_types=1);

namespace App\State;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProcessorInterface;
use App\Entity\SuggestionEtablissement;
use App\Entity\User;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

/**
 * Soumission d'une suggestion de correction d'établissement.
 *
 * - Injecte l'utilisateur connecté comme auteur.
 * - Place la suggestion en statut EN_ATTENTE en attendant l'approbation
 *   d'un manager / admin.
 */
class SuggestionEtablissementProcessor implements ProcessorInterface
{
    public function __construct(
        #[Autowire(service: 'api_platform.doctrine.orm.state.persist_processor')]
        private readonly ProcessorInterface $persistProcessor,
        private readonly Security $security
    ) {
    }

    public function process(mixed $data, Operation $operation, array $uriVariables = [], array $context = []): mixed
    {
        if ($data instanceof SuggestionEtablissement) {
            $user = $this->security->getUser();
            $data->setUser($user instanceof User ? $user : null);
            $data->setStatut('EN_ATTENTE');
            $data->setUpdatedAt(new \DateTimeImmutable());
        }

        return $this->persistProcessor->process($data, $operation, $uriVariables, $context);
    }
}
