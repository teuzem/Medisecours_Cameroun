<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Post;
use App\Entity\User;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use Symfony\Component\Routing\RouterInterface;

final class SecurityHardeningTest extends KernelTestCase
{
    public function testPublicApiPlatformUserCreationIsNotExposed(): void
    {
        $reflection = new \ReflectionClass(User::class);
        $resource = $reflection->getAttributes(ApiResource::class)[0]->newInstance();

        foreach ($resource->getOperations() ?? [] as $operation) {
            self::assertNotInstanceOf(Post::class, $operation);
        }
    }

    public function testSensitiveAndVerificationRoutesExist(): void
    {
        self::bootKernel();
        $routes = static::getContainer()->get(RouterInterface::class)->getRouteCollection();

        self::assertNotNull($routes->get('api_auth_change_password'));
        self::assertNotNull($routes->get('api_auth_change_email'));
        self::assertNotNull($routes->get('api_auth_resend_verification'));
        self::assertNotNull($routes->get('api_public_conditions'));
        self::assertNotNull($routes->get('api_public_condition_detail'));
        self::assertNotNull($routes->get('api_patient_symptom_orientation'));
        self::assertNotNull($routes->get('api_root'));
        self::assertNotNull($routes->get('api_health'));
    }

    public function testAdminUserRoutesAreNotDuplicated(): void
    {
        self::bootKernel();
        $routes = static::getContainer()->get(RouterInterface::class)->getRouteCollection();
        $matches = [];

        foreach ($routes as $route) {
            if (str_starts_with($route->getPath(), '/api/admin/users')) {
                $key = implode(',', $route->getMethods()) . ' ' . $route->getPath();
                $matches[$key] = ($matches[$key] ?? 0) + 1;
            }
        }

        foreach ($matches as $count) {
            self::assertSame(1, $count);
        }
    }
}
