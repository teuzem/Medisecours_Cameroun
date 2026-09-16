<?php

declare(strict_types=1);

namespace App\Command;

use Doctrine\DBAL\Connection;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;

#[AsCommand(
    name: 'app:build-patient-disease-catalog',
    description: 'Selectionne exactement 200 fiches pour le catalogue patient.',
)]
final class BuildPatientDiseaseCatalogCommand extends Command
{
    private const TARGET_SIZE = 200;

    public function __construct(private readonly Connection $connection)
    {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $diseaseCount = (int) $this->connection->fetchOne('SELECT COUNT(*) FROM maladie');
        if ($diseaseCount < self::TARGET_SIZE) {
            $output->writeln(sprintf('<error>Seulement %d maladies disponibles. Il en faut au moins %d.</error>', $diseaseCount, self::TARGET_SIZE));
            return Command::FAILURE;
        }

        $this->connection->executeStatement(
            'UPDATE maladie SET patient_visible = FALSE, patient_priority = NULL'
        );
        $this->connection->executeStatement(
            <<<'SQL'
                WITH scored AS (
                    SELECT
                        m.id,
                        (
                            CASE WHEN EXISTS (SELECT 1 FROM maladie_symptome ms WHERE ms.maladie_id = m.id) THEN 40 ELSE 0 END
                            + CASE WHEN EXISTS (SELECT 1 FROM premier_soin ps WHERE ps.maladie_id = m.id) THEN 25 ELSE 0 END
                            + CASE WHEN NULLIF(BTRIM(m.symptomes), '') IS NOT NULL THEN 15 ELSE 0 END
                            + CASE WHEN NULLIF(BTRIM(m.description), '') IS NOT NULL THEN 10 ELSE 0 END
                            + CASE WHEN NULLIF(BTRIM(m.causes), '') IS NOT NULL THEN 5 ELSE 0 END
                            + CASE WHEN m.is_accident = TRUE THEN 5 ELSE 0 END
                        ) AS score
                    FROM maladie m
                ),
                ranked AS (
                    SELECT
                        s.id,
                        ROW_NUMBER() OVER (
                            ORDER BY s.score DESC, s.id ASC
                        ) AS priority
                    FROM scored s
                    ORDER BY s.score DESC, s.id ASC
                    LIMIT 200
                )
                UPDATE maladie m
                SET patient_visible = TRUE,
                    patient_priority = ranked.priority
                FROM ranked
                WHERE m.id = ranked.id
            SQL
        );
        $output->writeln('<info>200 fiches sont maintenant visibles dans le catalogue patient.</info>');
        $output->writeln('<comment>Cette selection repose sur la qualite et la completude des donnees disponibles.</comment>');

        return Command::SUCCESS;
    }
}
