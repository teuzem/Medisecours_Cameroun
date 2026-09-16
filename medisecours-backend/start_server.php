<?php
// Quick test to check for errors without starting a server
require __DIR__ . '/vendor/autoload.php';

// Boot Symfony kernel
$kernel = new \App\Kernel('dev', true);
$kernel->boot();

// Try to get the Message resource's collection
$container = $kernel->getContainer();
$doctrine = $container->get('doctrine');
$repo = $doctrine->getRepository(\App\Entity\Message::class);
try {
    $messages = $repo->findAll();
    echo "Messages found: " . count($messages) . "\n";
} catch (\Exception $e) {
    echo "Error fetching messages: " . $e->getMessage() . "\n";
}

// Try Conversation repository
$convRepo = $doctrine->getRepository(\App\Entity\Conversation::class);
try {
    $convs = $convRepo->findAll();
    echo "Conversations found: " . count($convs) . "\n";
} catch (\Exception $e) {
    echo "Error fetching conversations: " . $e->getMessage() . "\n";
}

// Check schema validation
$em = $doctrine->getManager();
$schemaTool = new \Doctrine\ORM\Tools\SchemaValidator($em);
$errors = $schemaTool->validateMapping();
if (empty($errors)) {
    echo "Mapping OK\n";
} else {
    foreach ($errors as $class => $classErrors) {
        echo "Errors in $class:\n";
        foreach ($classErrors as $e) {
            echo "  - $e\n";
        }
    }
}

$kernel->shutdown();
