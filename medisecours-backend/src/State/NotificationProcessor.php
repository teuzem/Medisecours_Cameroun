<?php

declare(strict_types=1);

namespace App\State;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProcessorInterface;
use App\Entity\Notification;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

final class NotificationProcessor implements ProcessorInterface
{
    public function __construct(
        #[Autowire(service: 'api_platform.doctrine.orm.state.persist_processor')]
        private readonly ProcessorInterface $persistProcessor,
    ) {
    }

    public function process(mixed $data, Operation $operation, array $uriVariables = [], array $context = []): mixed
    {
        if ($data instanceof Notification) {
            $data->setReadAt($data->getReadAt() ? new \DateTimeImmutable() : null);
        }

        return $this->persistProcessor->process($data, $operation, $uriVariables, $context);
    }
}
