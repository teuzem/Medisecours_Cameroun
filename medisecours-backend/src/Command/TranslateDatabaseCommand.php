<?php

declare(strict_types=1);

namespace App\Command;

use App\Entity\Categorie;
use App\Entity\Maladie;
use App\Entity\PremierSoin;
use App\Entity\ProtocolePremiersGestes;
use Doctrine\ORM\EntityManagerInterface;
use Stichoza\GoogleTranslate\GoogleTranslate;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(
    name: 'app:translate-database',
    description: 'Traduit les champs français en anglais dans la base de données'
)]
final class TranslateDatabaseCommand extends Command
{
    private GoogleTranslate $translator;
    private int $apiCalls = 0;

    public function __construct(private readonly EntityManagerInterface $em)
    {
        parent::__construct();
        $this->translator = new GoogleTranslate('en', 'fr', [
            'verify' => false,
        ]);
    }

    protected function configure(): void
    {
        $this->addOption('force', null, InputOption::VALUE_NONE, 'Force la re-traduction même si le champ existe déjà');
        $this->addOption('skip-premiers-soins', null, InputOption::VALUE_NONE, 'Ignore la traduction des premiers soins (long)');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $force = $input->getOption('force');
        $skipPremiersSoins = $input->getOption('skip-premiers-soins');

        $io->title('Traduction de la base de données vers l\'anglais');

        $this->translateCategories($io, $force);
        $this->translateMaladies($io, $force);
        if (!$skipPremiersSoins) {
            $this->translatePremiersSoins($io, $force);
        }
        $this->translateProtocoles($io, $force);

        $io->success("Traduction terminée. {$this->apiCalls} appels Google Translate effectués.");

        return Command::SUCCESS;
    }

    private function trans(?string $text): ?string
    {
        $text = trim((string) $text);
        if ($text === '') {
            return null;
        }

        try {
            usleep(30_000);
            $this->apiCalls++;
            return $this->translator->translate($text);
        } catch (\Exception) {
            return null;
        }
    }

    private function translateCategories(SymfonyStyle $io, bool $force): void
    {
        $io->section('Catégories');
        $categories = $this->em->getRepository(Categorie::class)->findAll();

        $count = 0;
        foreach ($categories as $i => $cat) {
            if ($force || empty($cat->getNomEn())) {
                $cat->setNomEn($this->trans($cat->getNom()));
                $cat->setDescriptionEn($this->trans($cat->getDescription()));
                $count++;
            }
            if ($i % 20 === 0) {
                $this->em->flush();
            }
        }
        $this->em->flush();
        $io->success("$count catégories traduites.");
    }

    private function translateMaladies(SymfonyStyle $io, bool $force): void
    {
        $io->section('Maladies (visibles patient)');
        $maladies = $this->em->getRepository(Maladie::class)->findBy(['patientVisible' => true]);

        $count = 0;
        $total = count($maladies);
        $io->progressStart($total);
        foreach ($maladies as $maladie) {
            if ($force || empty($maladie->getNomEn())) {
                $maladie->setNomEn($this->trans($maladie->getNom()));
                $maladie->setDescriptionEn($this->trans($maladie->getDescription()));
                $maladie->setSymptomesEn($this->trans($maladie->getSymptomes()));
                $maladie->setPrecautionsEn($this->trans($maladie->getPrecautions()));
                $maladie->setTraitementEn($this->trans($maladie->getTraitement()));
                $maladie->setCausesEn($this->trans($maladie->getCauses()));
                $maladie->setTypeAccidentEn($this->trans($maladie->getTypeAccident()));
                $count++;
            }
            if ($count % 50 === 0) {
                $this->em->flush();
            }
            $io->progressAdvance();
        }
        $this->em->flush();
        $io->progressFinish();
        $io->success("$count maladies traduites.");
    }

    private function translatePremiersSoins(SymfonyStyle $io, bool $force): void
    {
        $io->section('Premiers Soins (liés aux maladies visibles)');

        $qb = $this->em->createQueryBuilder();
        $qb->select('ps')
            ->from(PremierSoin::class, 'ps')
            ->join('ps.maladie', 'm')
            ->where('m.patientVisible = true');

        $premiersSoins = $qb->getQuery()->getResult();
        $count = 0;
        $total = count($premiersSoins);
        $io->text("$total premiers soins à traiter.");
        $io->progressStart($total);
        foreach ($premiersSoins as $soin) {
            if ($force || empty($soin->getTitreEn())) {
                $soin->setTitreEn($this->trans($soin->getTitre()));
                $soin->setDescriptionEn($this->trans($soin->getDescription()));
                $soin->setSymptomesEn($this->trans($soin->getSymptomes()));
                $count++;
            }
            if ($count % 50 === 0) {
                $this->em->flush();
            }
            $io->progressAdvance();
        }
        $this->em->flush();
        $io->progressFinish();
        $io->success("$count premiers soins traduits.");
    }

    private function translateProtocoles(SymfonyStyle $io, bool $force): void
    {
        $io->section('Protocoles premiers gestes');
        $protocoles = $this->em->getRepository(ProtocolePremiersGestes::class)->createQueryBuilder('p')
            ->where('p.statut != :retired')
            ->setParameter('retired', ProtocolePremiersGestes::STATUT_RETIRE)
            ->getQuery()
            ->getResult();

        $count = 0;
        $total = count($protocoles);
        $io->progressStart($total);
        foreach ($protocoles as $protocole) {
            if ($force || empty($protocole->getTitreEn())) {
                $protocole->setTitreEn($this->trans($protocole->getTitre()));
                $protocole->setRestrictionsPopulationsEn($this->trans($protocole->getRestrictionsPopulations()));
                $protocole->setSourceCliniqueEn($this->trans($protocole->getSourceClinique()));

                foreach ($protocole->getEtapes() as $etape) {
                    if ($force || empty($etape->getInstructionEn())) {
                        $etape->setTitreEn($this->trans($etape->getTitre()));
                        $etape->setInstructionEn($this->trans($etape->getInstruction()));
                    }
                }
                $count++;
            }
            if ($count % 20 === 0) {
                $this->em->flush();
            }
            $io->progressAdvance();
        }
        $this->em->flush();
        $io->progressFinish();
        $io->success("$count protocoles traduits.");
    }
}
