<?php
use Symfony\Component\HttpFoundation\Request;

require_once __DIR__ . '/config/bootstrap.php';

$kernel = new \App\Kernel('dev', true);
$kernel->boot();
$container = $kernel->getContainer();

$router = $container->get('router');

try {
    $params = $router->match('/api/patients');
    echo "✓ /api/patients matches route: " . ($params['_route'] ?? 'unknown') . "\n";
    print_r($params);
} catch (\Exception $e) {
    echo "✗ /api/patients route match failed: " . $e->getMessage() . "\n";
}

try {
    $params = $router->match('/api/users');
    echo "✓ /api/users matches route: " . ($params['_route'] ?? 'unknown') . "\n";
} catch (\Exception $e) {
    echo "✗ /api/users route match failed: " . $e->getMessage() . "\n";
}

// Check resource metadata
$metadataFactory = $container->get('api_platform.metadata.resource.metadata_collection_factory');
try {
    $metadata = $metadataFactory->create(\App\Entity\Patient::class);
    echo "✓ Patient resource metadata found\n";
    foreach ($metadata as $name => $op) {
        echo "  Operation: $name\n";
        echo "  URI: " . ($op->getUriTemplate() ?? 'auto') . "\n";
        echo "  Route: " . ($op->getRouteName() ?? 'auto') . "\n";
        echo "  Security: " . ($op->getSecurity() ?? 'none') . "\n";
    }
} catch (\Exception $e) {
    echo "✗ Patient resource metadata: " . $e->getMessage() . "\n";
}

// Check User resource metadata to verify it still works
$metadata2 = $metadataFactory->create(\App\Entity\User::class);
echo "✓ User resource metadata found\n";
foreach ($metadata2 as $name => $op) {
    echo "  Operation: $name\n";
    echo "  URI: " . ($op->getUriTemplate() ?? 'auto') . "\n";
}
