<?php

declare(strict_types=1);

namespace App\Message;

final class WebSocketNotification
{
    public function __construct(
        private readonly string $event,
        private readonly array $payload,
        private readonly array $targetUserIds = [],
    ) {
    }

    public function getEvent(): string
    {
        return $this->event;
    }

    public function getPayload(): array
    {
        return $this->payload;
    }

    public function getTargetUserIds(): array
    {
        return $this->targetUserIds;
    }

    public function isBroadcast(): bool
    {
        return empty($this->targetUserIds);
    }
}
