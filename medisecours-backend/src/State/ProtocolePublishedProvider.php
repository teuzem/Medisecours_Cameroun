<?php

declare(strict_types=1);

namespace App\State;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProviderInterface;
use App\Repository\ProtocolePremiersGestesRepository;

final class ProtocolePublishedProvider implements ProviderInterface
{
    public function __construct(private readonly ProtocolePremiersGestesRepository $repository)
    {
    }

    public function provide(Operation $operation, array $uriVariables = [], array $context = []): object|array|null
    {
        if (isset($uriVariables['id'])) {
            return $this->repository->findPublicOneById((int) $uriVariables['id']);
        }

        return $this->repository->findAllPublic();
    }
}
