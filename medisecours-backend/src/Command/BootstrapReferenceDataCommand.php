<?php

declare(strict_types=1);

namespace App\Command;

use Doctrine\DBAL\Connection;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\ArrayInput;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(
    name: 'app:bootstrap-reference-data',
    description: 'Charge une version determinee des catalogues maladies et premiers secours.',
)]
final class BootstrapReferenceDataCommand extends Command
{
    private const DATASET = 'medical_catalogs';
    private const DEFAULT_VERSION = '2026-08-07.1';
    private const LOCK_ID = 202608071;

    public function __construct(private readonly Connection $connection)
    {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->addOption('catalog-version', null, InputOption::VALUE_REQUIRED, 'Version du catalogue a appliquer.', self::DEFAULT_VERSION)
            ->addOption('force', null, InputOption::VALUE_NONE, 'Recharge la version meme si elle est deja appliquee.')
            ->addOption('check', null, InputOption::VALUE_NONE, 'Verifie uniquement les volumes actuellement presents.');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $version = trim((string) $input->getOption('catalog-version'));
        if ($version === '' || mb_strlen($version) > 80) {
            $io->error('La version du catalogue est vide ou trop longue.');

            return Command::INVALID;
        }

        if ((bool) $input->getOption('check')) {
            return $this->verifyCatalogs($io);
        }

        $this->connection->executeQuery('SELECT pg_advisory_lock(:lock_id)', ['lock_id' => self::LOCK_ID]);

        try {
            $currentVersion = $this->connection->fetchOne(
                'SELECT catalog_version FROM reference_data_version WHERE dataset = :dataset',
                ['dataset' => self::DATASET]
            );

            if (!(bool) $input->getOption('force') && $currentVersion === $version) {
                $io->success(sprintf('Catalogue %s deja charge. Aucune modification.', $version));

                return $this->verifyCatalogs($io);
            }

            $io->title(sprintf('Chargement du catalogue de reference %s', $version));

            $commands = [
                ['app:load-maladies', ['--update' => true]],
                ['app:build-symptom-index', []],
                ['app:build-patient-disease-catalog', []],
                ['app:generate-first-aid-catalog', []],
            ];

            foreach ($commands as [$name, $arguments]) {
                $command = $this->getApplication()?->find($name);
                if ($command === null) {
                    $io->error(sprintf('Commande de bootstrap introuvable : %s', $name));

                    return Command::FAILURE;
                }

                $commandInput = new ArrayInput(['command' => $name] + $arguments);
                $commandInput->setInteractive(false);
                $exitCode = $command->run($commandInput, $output);
                if ($exitCode !== Command::SUCCESS) {
                    $io->error(sprintf('Le bootstrap a echoue pendant %s.', $name));

                    return Command::FAILURE;
                }
            }

            if ($this->verifyCatalogs($io) !== Command::SUCCESS) {
                return Command::FAILURE;
            }

            $this->connection->executeStatement(
                <<<'SQL'
                    INSERT INTO reference_data_version (dataset, catalog_version, applied_at)
                    VALUES (:dataset, :catalog_version, CURRENT_TIMESTAMP)
                    ON CONFLICT (dataset) DO UPDATE
                    SET catalog_version = EXCLUDED.catalog_version,
                        applied_at = EXCLUDED.applied_at
                SQL,
                ['dataset' => self::DATASET, 'catalog_version' => $version]
            );

            $io->success(sprintf('Catalogue %s charge et enregistre.', $version));

            return Command::SUCCESS;
        } finally {
            $this->connection->executeQuery('SELECT pg_advisory_unlock(:lock_id)', ['lock_id' => self::LOCK_ID]);
        }
    }

    private function verifyCatalogs(SymfonyStyle $io): int
    {
        $diseases = (int) $this->connection->fetchOne('SELECT COUNT(*) FROM maladie');
        $patientDiseases = (int) $this->connection->fetchOne('SELECT COUNT(*) FROM maladie WHERE patient_visible = TRUE');
        $protocols = (int) $this->connection->fetchOne(
            <<<'SQL'
                SELECT COUNT(*)
                FROM protocole_premiers_gestes p
                WHERE p.statut != 'RETIRE'
                  AND EXISTS (
                      SELECT 1
                      FROM protocole_etape e
                      WHERE e.protocole_id = p.id
                  )
            SQL
        );

        $io->table(
            ['Catalogue', 'Volume'],
            [
                ['Maladies stockees', (string) $diseases],
                ['Maladies visibles aux patients', (string) $patientDiseases],
                ['Fiches de premiers secours', (string) $protocols],
            ]
        );

        if ($diseases < 200 || $patientDiseases !== 200 || $protocols < 500) {
            $io->error('Les volumes minimaux des catalogues ne sont pas atteints.');

            return Command::FAILURE;
        }

        return Command::SUCCESS;
    }
}
