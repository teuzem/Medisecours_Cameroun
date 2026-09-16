<?php

namespace App\Command;

use App\Entity\CentreDeSante;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(
    name: 'app:load-centres',
    description: 'Charge les centres de santé depuis le fichier JSON data/centres_sante.json.'
)]
class LoadCentresFromJsonCommand extends Command
{
    private const JSON_PATH = __DIR__ . '/../../data/centres_sante.json';

    public function __construct(
        private readonly EntityManagerInterface $entityManager,
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->addOption('update', null, InputOption::VALUE_NONE, 'Met à jour les centres existants')
            ->addOption('dry-run', null, InputOption::VALUE_NONE, 'Simulation sans écriture');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $updateExisting = (bool) $input->getOption('update');
        $dryRun = (bool) $input->getOption('dry-run');

        if (!file_exists(self::JSON_PATH)) {
            $io->error('Fichier introuvable : ' . self::JSON_PATH);
            return Command::FAILURE;
        }

        $json = file_get_contents(self::JSON_PATH);
        $data = json_decode($json, true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            $io->error('Erreur JSON : ' . json_last_error_msg());
            return Command::FAILURE;
        }

        $io->title('Importation des centres de santé');
        $io->info(sprintf('%d centres trouvés dans le fichier JSON.', count($data)));

        if ($dryRun) {
            $io->note('Mode dry-run : aucune écriture en base.');
        }

        $imported = 0;
        $updated = 0;
        $skipped = 0;
        $errors = 0;

        $regionsCount = [];
        $typesCount = [];

        foreach ($data as $index => $item) {
            $nom = trim($item['nom'] ?? '');
            $ville = trim($item['ville'] ?? '');
            $region = trim($item['region'] ?? '');
            $type = trim($item['type'] ?? '');

            if (empty($nom) || empty($ville) || empty($region)) {
                $errors++;
                $io->warning("Ligne $index : nom, ville ou région manquant.");
                continue;
            }

            $validTypes = [
                'hopital_general', 'hopital_de_district', 'chu', 'cma', 'csi',
                'clinique_privee', 'pharmacie', 'laboratoire', 'centre_specialise',
            ];
            if (!in_array($type, $validTypes, true)) {
                $errors++;
                $io->warning("Ligne $index : type '$type' invalide pour '$nom'.");
                continue;
            }

            $validRegions = [
                'Adamaoua', 'Centre', 'Est', 'Extrême-Nord', 'Littoral',
                'Nord', 'Nord-Ouest', 'Ouest', 'Sud', 'Sud-Ouest'
            ];
            if (!in_array($region, $validRegions, true)) {
                $errors++;
                $io->warning("Ligne $index : région '$region' invalide pour '$nom'.");
                continue;
            }

            $existing = $this->entityManager->getRepository(CentreDeSante::class)
                ->findOneBy(['nom' => $nom, 'ville' => $ville]);

            if ($existing) {
                if ($updateExisting) {
                    $this->updateCentre($existing, $item);
                    $updated++;
                } else {
                    $skipped++;
                    continue;
                }
            } else {
                $centre = new CentreDeSante();
                $this->populateCentre($centre, $item);
                $this->entityManager->persist($centre);
                $imported++;
            }

            $regionsCount[$region] = ($regionsCount[$region] ?? 0) + 1;
            $typesCount[$type] = ($typesCount[$type] ?? 0) + 1;
        }

        if (!$dryRun) {
            $this->entityManager->flush();
        }

        $io->section('Résultats');
        $io->table(
            ['Indicateur', 'Valeur'],
            [
                ['Importés', (string) $imported],
                ['Mis à jour', (string) $updated],
                ['Ignorés (existants)', (string) $skipped],
                ['Erreurs', (string) $errors],
                ['Total traités', (string) count($data)],
            ]
        );

        if (!empty($regionsCount)) {
            $io->section('Par région');
            $rows = [];
            foreach ($regionsCount as $region => $count) {
                $rows[] = [$region, (string) $count];
            }
            $io->table(['Région', 'Nombre'], $rows);
        }

        if (!empty($typesCount)) {
            $io->section('Par type');
            $rows = [];
            foreach ($typesCount as $type => $count) {
                $rows[] = [$type, (string) $count];
            }
            $io->table(['Type', 'Nombre'], $rows);
        }

        if ($dryRun) {
            $io->success('Simulation terminée avec succès.');
        } else {
            $io->success('Importation terminée avec succès.');
        }

        return Command::SUCCESS;
    }

    private function populateCentre(CentreDeSante $centre, array $item): void
    {
        $centre->setNom($item['nom']);
        $centre->setType($item['type']);
        $centre->setAdresse($item['adresse'] ?? 'Non renseignée');
        $centre->setVille($item['ville']);
        $centre->setRegion($item['region']);
        $centre->setLatitude((float) ($item['latitude'] ?? 0));
        $centre->setLongitude((float) ($item['longitude'] ?? 0));
        $centre->setTelephone($item['telephone'] ?? null);
        $centre->setEmail($item['email'] ?? null);
        $centre->setSiteWeb($item['siteWeb'] ?? null);
        $centre->setImageUrl($item['imageUrl'] ?? null);
        $centre->setHoraires($item['horaires'] ?? 'Non renseigné');
        $centre->setStatut($item['statut'] ?? 'prive');
        $centre->setQuartier($item['quartier'] ?? null);
        $centre->setDescription($item['description'] ?? null);
        $centre->setEstActif($item['estActif'] ?? true);
        $centre->setUrgences24h($item['urgences24h'] ?? false);
        $centre->setSpecialites($item['specialites'] ?? []);
        $centre->setServices($item['services'] ?? []);
    }

    private function updateCentre(CentreDeSante $centre, array $item): void
    {
        if (!empty($item['nom'])) $centre->setNom($item['nom']);
        if (!empty($item['type'])) $centre->setType($item['type']);
        if (!empty($item['adresse'])) $centre->setAdresse($item['adresse']);
        if (!empty($item['ville'])) $centre->setVille($item['ville']);
        if (!empty($item['region'])) $centre->setRegion($item['region']);
        if (isset($item['latitude'])) $centre->setLatitude((float) $item['latitude']);
        if (isset($item['longitude'])) $centre->setLongitude((float) $item['longitude']);
        if (!empty($item['telephone'])) $centre->setTelephone($item['telephone']);
        if (!empty($item['email'])) $centre->setEmail($item['email']);
        if (!empty($item['siteWeb'])) $centre->setSiteWeb($item['siteWeb']);
        if (!empty($item['imageUrl'])) $centre->setImageUrl($item['imageUrl']);
        if (!empty($item['horaires'])) $centre->setHoraires($item['horaires']);
        if (!empty($item['statut'])) $centre->setStatut($item['statut']);
        if (!empty($item['quartier'])) $centre->setQuartier($item['quartier']);
        if (!empty($item['description'])) $centre->setDescription($item['description']);
        if (isset($item['estActif'])) $centre->setEstActif((bool) $item['estActif']);
        if (isset($item['urgences24h'])) $centre->setUrgences24h((bool) $item['urgences24h']);
        if (!empty($item['specialites'])) $centre->setSpecialites($item['specialites']);
        if (!empty($item['services'])) $centre->setServices($item['services']);
    }
}
