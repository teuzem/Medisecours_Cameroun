<?php

declare(strict_types=1);

namespace App\Command;

use App\Entity\Maladie;
use App\Entity\MaladieSymptome;
use App\Entity\Symptome;
use App\Repository\MaladieRepository;
use App\Repository\SymptomeRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(
    name: 'app:build-symptom-index',
    description: 'Construit les symptomes structures a partir du champ texte des maladies.'
)]
final class BuildSymptomIndexCommand extends Command
{
    private const BATCH_SIZE = 25;
    private const SYNONYMS = [
        'fievre' => ['temperature elevee', 'fièvre', 'etat febrile'],
        'maux de tete' => ['mal de tete', 'cephalee', 'céphalée'],
        'fatigue' => ['asthenie', 'faiblesse'],
        'toux' => ['tousser'],
        'diarrhee' => ['diarrhee liquide', 'diarrhée'],
        'vomissements' => ['vomir', 'nausees', 'nausées'],
        'frissons' => ['tremblements', 'chair de poule'],
        'sueurs' => ['transpiration', 'sueurs nocturnes'],
        'douleur abdominale' => ['mal de ventre', 'douleurs abdominales'],
        'douleur thoracique' => ['mal poitrine', 'douleur poitrine'],
    ];

    public function __construct(
        private readonly MaladieRepository $maladieRepository,
        private readonly SymptomeRepository $symptomeRepository,
        private readonly EntityManagerInterface $entityManager,
    ) {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $createdSymptoms = 0;
        $createdLinks = 0;

        $processed = 0;
        $symptomCache = [];
        /** @var iterable<Maladie> $maladies */
        $maladies = $this->maladieRepository->createQueryBuilder('m')
            ->orderBy('m.id', 'ASC')
            ->getQuery()
            ->toIterable();
        foreach ($maladies as $maladie) {
            if ($maladie->getSymptomesStructures()->count() > 0) {
                ++$processed;
                if (($processed % self::BATCH_SIZE) === 0) {
                    $this->entityManager->clear();
                    $symptomCache = [];
                }
                continue;
            }

            $terms = array_slice($this->extractTerms($maladie->getSymptomes() ?? ''), 0, 12);
            foreach ($terms as $index => $term) {
                $slug = $this->slug($term);
                if ($slug === '') {
                    continue;
                }

                $symptom = $symptomCache[$slug] ?? $this->symptomeRepository->findOneBy(['slug' => $slug]);
                if (!$symptom) {
                    $symptom = (new Symptome())
                        ->setNom($term)
                        ->setSlug($slug)
                        ->setSynonymes(self::SYNONYMS[$slug] ?? [])
                        ->setOrdre($createdSymptoms + 1);
                    $this->entityManager->persist($symptom);
                    ++$createdSymptoms;
                }
                $symptomCache[$slug] = $symptom;

                $link = (new MaladieSymptome())
                    ->setMaladie($maladie)
                    ->setSymptome($symptom)
                    ->setPoids($index < 2 ? 5 : ($index < 5 ? 4 : 3))
                    ->setFrequence($index < 3 ? MaladieSymptome::FREQUENCE_TRES_FREQUENT : MaladieSymptome::FREQUENCE_FREQUENT)
                    ->setObligatoire($index === 0);

                $maladie->addSymptomeStructure($link);
                $this->entityManager->persist($link);
                ++$createdLinks;
            }

            ++$processed;
            if (($processed % self::BATCH_SIZE) === 0) {
                $this->entityManager->flush();
                $this->entityManager->clear();
                $symptomCache = [];
            }
        }

        $this->entityManager->flush();
        $io->success(sprintf('%d symptomes crees, %d associations maladie-symptome creees.', $createdSymptoms, $createdLinks));

        return Command::SUCCESS;
    }

    /** @return string[] */
    private function extractTerms(string $text): array
    {
        $parts = preg_split('/[,;\n\r]+|\s+-\s+|\s+\/\s+/u', $text) ?: [];
        $terms = [];
        foreach ($parts as $part) {
            $part = trim(strip_tags($part));
            $part = preg_replace('/\s+/', ' ', $part) ?? '';
            if (mb_strlen($part) >= 3 && mb_strlen($part) <= 80) {
                $terms[$this->slug($part)] = $part;
            }
        }
        return array_values($terms);
    }

    private function slug(string $value): string
    {
        $value = trim(mb_strtolower($value));
        $ascii = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);
        $value = $ascii !== false ? $ascii : $value;
        $value = preg_replace('/[^a-z0-9]+/i', ' ', $value) ?? '';
        return trim(preg_replace('/\s+/', ' ', $value) ?? '');
    }
}
