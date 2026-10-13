<?php

declare(strict_types=1);

namespace App\Command;

use App\Entity\CentreDeSante;
use App\Repository\AvisEtablissementRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

/**
 * Recalcule la note moyenne et le total d'avis publiés de chaque
 * établissement à partir des lignes réellement en base.
 *
 * Usage : php bin/console app:avis:refresh-aggregates [--centre=ID]
 *
 * À lancer après un déploiement ou toute intervention manuelle en base,
 * afin que les fiches n'affichent jamais des compteurs divergents de la
 * liste des avis publiés.
 */
#[AsCommand(name: 'app:avis:refresh-aggregates', description: 'Recalcule note moyenne et total des avis publiés par établissement')]
final class RefreshAvisAggregatesCommand extends Command
{
    public function __construct(
        private readonly EntityManagerInterface $entityManager,
        private readonly AvisEtablissementRepository $avisRepository,
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->addOption('centre', null, InputOption::VALUE_REQUIRED, 'Recalcule uniquement cet établissement (ID)');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $centreOption = $input->getOption('centre');

        if ($centreOption !== null && $centreOption !== '') {
            $centres = [$this->entityManager->getRepository(CentreDeSante::class)->find((int) $centreOption)];
            if ($centres[0] === null) {
                $io->error(sprintf('Établissement %s introuvable.', $centreOption));

                return Command::FAILURE;
            }
        } else {
            $centres = $this->entityManager->getRepository(CentreDeSante::class)->findAll();
        }

        $fixed = 0;
        foreach ($centres as $centre) {
            if (!$centre instanceof CentreDeSante) {
                continue;
            }
            $beforeNote = $centre->getNoteMoyenne();
            $beforeTotal = $centre->getTotalAvis();
            $this->avisRepository->refreshAggregates($centre);
            if ($beforeNote !== $centre->getNoteMoyenne() || $beforeTotal !== $centre->getTotalAvis()) {
                $fixed++;
                $io->text(sprintf(
                    '#%d %s : %.1f (%d avis) → %.1f (%d avis)',
                    $centre->getId(),
                    $centre->getNom(),
                    (float) $beforeNote,
                    (int) $beforeTotal,
                    (float) $centre->getNoteMoyenne(),
                    (int) $centre->getTotalAvis()
                ));
            }
        }

        $io->success(sprintf(
            '%d établissement(s) contrôlé(s), %d corrigé(s).',
            count($centres),
            $fixed
        ));

        return Command::SUCCESS;
    }
}
