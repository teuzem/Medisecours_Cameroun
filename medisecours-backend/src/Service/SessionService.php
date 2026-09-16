<?php

declare(strict_types=1);

namespace App\Service;

use App\Entity\RefreshToken;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\Cookie;

final class SessionService
{
    private const ACCESS_COOKIE = 'medisecours_access';
    private const REFRESH_COOKIE = 'medisecours_refresh';

    public function __construct(
        private readonly EntityManagerInterface $entityManager,
        #[Autowire('%kernel.environment%')] private readonly string $environment,
    )
    {
    }

    /** @return array{token: string, cookie: Cookie} */
    public function createRefreshSession(User $user, ?string $family = null): array
    {
        $plainToken = bin2hex(random_bytes(48));
        $refreshToken = (new RefreshToken())
            ->setUser($user)
            ->setTokenHash(hash('sha256', $plainToken))
            ->setFamily($family ?? bin2hex(random_bytes(32)))
            ->setExpiresAt(new \DateTimeImmutable('+30 days'));

        $this->entityManager->persist($refreshToken);

        return [
            'token' => $plainToken,
            'cookie' => $this->refreshCookie($plainToken),
        ];
    }

    public function findUsableRefreshToken(?string $plainToken): ?RefreshToken
    {
        $token = $this->findRefreshToken($plainToken);

        return $token instanceof RefreshToken && $token->isUsable() ? $token : null;
    }

    public function findRefreshToken(?string $plainToken): ?RefreshToken
    {
        if (!$plainToken) {
            return null;
        }

        $token = $this->entityManager->getRepository(RefreshToken::class)->findOneBy([
            'tokenHash' => hash('sha256', $plainToken),
        ]);

        return $token instanceof RefreshToken ? $token : null;
    }

    public function revokeFamily(string $family): void
    {
        $tokens = $this->entityManager->getRepository(RefreshToken::class)->findBy(['family' => $family]);
        foreach ($tokens as $token) {
            $token->revoke();
        }
    }

    public function revokeUserSessions(User $user): void
    {
        $tokens = $this->entityManager->getRepository(RefreshToken::class)->findBy([
            'user' => $user,
            'revokedAt' => null,
        ]);
        foreach ($tokens as $token) {
            $token->revoke();
        }
    }

    public function accessCookie(string $jwt): Cookie
    {
        return Cookie::create(self::ACCESS_COOKIE)
            ->withValue($jwt)
            ->withPath('/')
            ->withHttpOnly(true)
            ->withSecure($this->environment === 'prod')
            ->withSameSite(Cookie::SAMESITE_LAX)
            ->withExpires(new \DateTimeImmutable('+15 minutes'));
    }

    public function clearCookies(): array
    {
        return [
            Cookie::create(self::ACCESS_COOKIE)->withPath('/')->withHttpOnly(true)->withSecure($this->environment === 'prod')->withSameSite(Cookie::SAMESITE_LAX)->withExpires(1),
            Cookie::create(self::REFRESH_COOKIE)->withPath('/api/auth')->withHttpOnly(true)->withSecure($this->environment === 'prod')->withSameSite(Cookie::SAMESITE_LAX)->withExpires(1),
        ];
    }

    private function refreshCookie(string $token): Cookie
    {
        return Cookie::create(self::REFRESH_COOKIE)
            ->withValue($token)
            ->withPath('/api/auth')
            ->withHttpOnly(true)
            ->withSecure($this->environment === 'prod')
            ->withSameSite(Cookie::SAMESITE_LAX)
            ->withExpires(new \DateTimeImmutable('+30 days'));
    }
}
