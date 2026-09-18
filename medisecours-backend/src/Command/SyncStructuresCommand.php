<?php

declare(strict_types=1);

namespace App\Command;

use App\Service\StructureSyncService;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

/**
 * Synchronisation temps réel des structures de santé (Google Places).
 *
 *   php bin/console app:carte:sync-structures            # toutes les régions
 *   php bin/console app:carte:sync-structures --region=Centre --region=Littoral
 *   php bin/console app:carte:sync-structures --cap=1000
 *
 * Sans clé configurée (FORGE_API_KEY / GOOGLE_MAPS_API_KEY), la commande
 * termine proprement sans modifier la base.
 */
#[AsCommand(name: 'app:carte:sync-structures', description: 'Synchronise les structures de santé depuis Google Places (temps réel).')]
final class SyncStructuresCommand extends Command
{
    public function __construct(private readonly StructureSyncService $sync)
    {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->addOption('limit', null, InputOption::VALUE_REQUIRED, 'Traitements max par requête de recherche', '60')
            ->addOption('cap', null, InputOption::VALUE_REQUIRED, 'Arrêt total créés + mis à jour', '400')
            ->addOption('region', null, InputOption::VALUE_REQUIRED | InputOption::VALUE_IS_ARRAY, 'Région(s) à traiter (10 régions)')
        ;
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);

        $regions = $input->getOption('region');
        $stats = $this->sync->sync(
            is_array($regions) && $regions !== [] ? $regions : null,
            max(1, min(100, (int) $input->getOption('limit'))),
            max(1, (int) $input->getOption('cap'))
        );

        if (($stats['configured'] ?? false) === false) {
            $io->error((string) ($stats['error'] ?? 'Synchronisation non configurée.'));

            return Command::FAILURE;
        }

        $io->success(sprintf(
            'Synchronisation %s terminée : %d requêtes, %d créés, %d enrichis, %d ignorés (%d régions).',
            $stats['source'],
            $stats['queries'],
            $stats['created'],
            $stats['updated'],
            $stats['skipped'],
            $stats['regions']
        ));

        return Command::SUCCESS;
    }
}