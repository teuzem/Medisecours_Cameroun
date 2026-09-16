<?php

declare(strict_types=1);

namespace App\Service;

use Psr\Log\LoggerInterface;
use Symfony\Contracts\HttpClient\HttpClientInterface;

class WebSocketNotifier
{
    private string $publishUrl;

    public function __construct(
        private readonly HttpClientInterface $httpClient,
        private readonly LoggerInterface $logger,
        string $wsPublishUrl = 'http://127.0.0.1:8082',
        private readonly string $wsPublishSecret = '',
    ) {
        $normalizedUrl = trim($wsPublishUrl);
        if (!str_contains($normalizedUrl, '://')) {
            $normalizedUrl = 'http://' . $normalizedUrl;
        }

        $this->publishUrl = rtrim($normalizedUrl, '/') . '/publish';
    }

    public function broadcast(array $data): int
    {
        try {
            $response = $this->httpClient->request('POST', $this->publishUrl, [
                'json' => $data + ['broadcast' => true],
                'headers' => ['X-WS-Publish-Secret' => $this->wsPublishSecret],
                'timeout' => 2,
            ]);
            $status = $response->getStatusCode();
            $this->logger->debug('WS broadcast sent', ['status' => $status, 'event' => $data['event'] ?? 'unknown']);
            return (int) ($response->toArray(false)['sent'] ?? 0);
        } catch (\Throwable $e) {
            $this->logger->warning('WS broadcast failed', ['error' => $e->getMessage()]);
            return 0;
        }
    }

    public function notifyConversation(string $conversationId, string $event, array $payload, array $targetUserIds = []): int
    {
        try {
            $response = $this->httpClient->request('POST', $this->publishUrl, [
                'json' => [
                    'conversationId' => $conversationId,
                    'event' => $event,
                    'payload' => $payload,
                    'targetUserIds' => $targetUserIds,
                ],
                'headers' => ['X-WS-Publish-Secret' => $this->wsPublishSecret],
                'timeout' => 2,
            ]);
            return (int) ($response->toArray(false)['sent'] ?? 0);
        } catch (\Throwable $e) {
            $this->logger->warning('WS notifyConversation failed', ['error' => $e->getMessage()]);
            return 0;
        }
    }
}
