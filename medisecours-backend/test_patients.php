<?php
use App\Entity\Patient;
use App\Entity\Medecin;

require_once __DIR__ . '/vendor/autoload.php';

$kernel = new \App\Kernel('dev', true);
$kernel->boot();

// Check Medecin users
$conn = $kernel->getContainer()->get('doctrine')->getConnection();
$rows = $conn->fetchAllAssociative('SELECT email, type FROM "user" WHERE type = \'medecin\'');
echo "Medecins:\n";
foreach ($rows as $r) {
    echo "  - {$r['email']} ({$r['type']})\n";
}

// Check Patient count
$count = $conn->fetchOne('SELECT COUNT(*) FROM "user" WHERE type = \'patient\'');
echo "Patient count: $count\n";

// Test the API endpoint using a test client
$client = $kernel->getContainer()->get('api_platform.core.credentials'); // doesn't exist, just simulate

// Serialize one patient to check groups
$em = $kernel->getContainer()->get('doctrine.orm.default_entity_manager');
$patient = $em->getRepository(Patient::class)->findOneBy([]);
if ($patient) {
    $serializer = $kernel->getContainer()->get('serializer');
    try {
        $json = $serializer->serialize($patient, 'json', ['groups' => ['user:search']]);
        echo "Serialized patient: $json\n";
    } catch (\Exception $e) {
        echo "Error serializing: " . $e->getMessage() . "\n";
    }
}
