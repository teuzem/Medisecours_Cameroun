<?php

declare(strict_types=1);

namespace App\State;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\Metadata\Post;
use ApiPlatform\State\ProcessorInterface;
use App\Entity\ProtocolePremiersGestes;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

final class ProtocoleProcessor implements ProcessorInterface
{
    public function __construct(
        #[Autowire(service: 'api_platform.doctrine.orm.state.persist_processor')]
        private readonly ProcessorInterface $persistProcessor,
    ) {
    }

    public function process(mixed $data, Operation $operation, array $uriVariables = [], array $context = []): mixed
    {
        if ($data instanceof ProtocolePremiersGestes && $operation instanceof Post) {
            $data->setStatut(ProtocolePremiersGestes::STATUT_BROUILLON);
        }

        return $this->persistProcessor->process($data, $operation, $uriVariables, $context);
    }
}
