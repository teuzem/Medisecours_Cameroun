<?php

namespace App\Command;

use App\Entity\Categorie;
use App\Entity\Maladie;
use App\Entity\PremierSoin;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(
    name: 'app:load-maladies',
    description: 'Importe les maladies depuis data/maladies.json dans la base de données.'
)]
class LoadMaladiesFromJsonCommand extends Command
{
    private const JSON_PATH = __DIR__ . '/../../data/maladies.json';
    private const BATCH_SIZE = 25;

    public function __construct(
        private readonly EntityManagerInterface $entityManager,
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->addOption('update', null, InputOption::VALUE_NONE, 'Met à jour les maladies existantes')
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

        $io->title('Importation des maladies');
        $io->info(sprintf('%d maladies trouvées dans le fichier JSON.', count($data)));

        if ($dryRun) {
            $io->note('Mode dry-run : aucune écriture en base.');
        }

        $imported = 0;
        $updated = 0;
        $skipped = 0;
        $errors = 0;
        $categoryCache = [];
        $categoriesCount = [];

        foreach ($data as $index => $item) {
            $nom = trim($item['nom'] ?? '');
            $catName = trim($item['categorie'] ?? '');

            if (empty($nom) || empty($catName)) {
                $errors++;
                $io->warning("Ligne $index : nom ou catégorie manquant.");
                continue;
            }

            // Find or create category
            if (!isset($categoryCache[$catName])) {
                $cat = $this->entityManager->getRepository(Categorie::class)
                    ->findOneBy(['nom' => $catName]);
                if (!$cat) {
                    $cat = new Categorie();
                    $cat->setNom($catName);
                    $this->entityManager->persist($cat);
                }
                $categoryCache[$catName] = $cat;
            }
            $categorie = $categoryCache[$catName];

            // Check existing
            $existing = $this->entityManager->getRepository(Maladie::class)
                ->findOneBy(['nom' => $nom]);

            if ($existing) {
                if ($updateExisting) {
                    $this->updateMaladie($existing, $item, $categorie);
                    $updated++;
                } else {
                    $skipped++;
                    continue;
                }
            } else {
                $maladie = $this->createMaladie($item, $categorie);
                $this->entityManager->persist($maladie);
                $imported++;
            }

            $categoriesCount[$catName] = ($categoriesCount[$catName] ?? 0) + 1;

            if (!$dryRun && (($imported + $updated) % self::BATCH_SIZE) === 0) {
                $this->entityManager->flush();
                $this->entityManager->clear();
                $categoryCache = [];
            }
        }

        if (!$dryRun) {
            $this->entityManager->flush();
        }

        $io->section('Résultats');
        $io->table(
            ['Indicateur', 'Valeur'],
            [
                ['Importées', (string) $imported],
                ['Mises à jour', (string) $updated],
                ['Ignorées (existantes)', (string) $skipped],
                ['Erreurs', (string) $errors],
                ['Total traitées', (string) count($data)],
            ]
        );

        if (!empty($categoriesCount)) {
            $io->section('Par catégorie');
            $rows = [];
            foreach ($categoriesCount as $cat => $count) {
                $rows[] = [$cat, (string) $count];
            }
            $io->table(['Catégorie', 'Nombre'], $rows);
        }

        if ($dryRun) {
            $io->success('Simulation terminée.');
        } else {
            $io->success('Importation terminée.');
        }

        return Command::SUCCESS;
    }

    private function createMaladie(array $item, Categorie $categorie): Maladie
    {
        $maladie = new Maladie();
        $this->populateMaladie($maladie, $item, $categorie);
        return $maladie;
    }

    private function populateMaladie(Maladie $maladie, array $item, Categorie $categorie): void
    {
        $maladie->setNom($item['nom']);
        $maladie->setDescription($item['description'] ?? '');
        $maladie->setSymptomes($item['symptomes'] ?? null);
        $maladie->setCauses($item['causes'] ?? null);
        $maladie->setPrecautions($item['precautions'] ?? null);
        $maladie->setTraitement($item['traitement'] ?? null);
        $maladie->setNiveauGravite($item['niveauGravite'] ?? 'MODÉRÉE');
        $maladie->setContagieux($item['contagieux'] ?? false);
        $maladie->setUrgence($item['urgence'] ?? false);
        $maladie->setIsAccident($item['isAccident'] ?? false);
        $maladie->setImageUrl($item['imageUrl'] ?? null);
        $maladie->setCategorie($categorie);

        // Clear existing premiers soins if updating
        foreach ($maladie->getPremiersSoins()->toArray() as $ps) {
            $maladie->removePremierSoin($ps);
        }

        if (!empty($item['premiersSoins'])) {
            foreach ($item['premiersSoins'] as $psData) {
                $ps = new PremierSoin();
                $ps->setTitre($psData['titre'] ?? '');
                $ps->setDescription($psData['description'] ?? '');
                $ps->setSymptomes($psData['symptomes'] ?? null);
                $ps->setNiveauUrgence($psData['niveauUrgence'] ?? 'MOYEN');
                $maladie->addPremierSoin($ps);
            }
        }
    }

    private function updateMaladie(Maladie $maladie, array $item, Categorie $categorie): void
    {
        $this->populateMaladie($maladie, $item, $categorie);
    }
}
