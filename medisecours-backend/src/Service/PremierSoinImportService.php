<?php

namespace App\Service;

use App\DTO\PremierSoinImportDTO;
use App\Entity\Categorie;
use App\Entity\Maladie;
use App\Entity\PremierSoin;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\Validator\Validator\ValidatorInterface;

class PremierSoinImportService
{
    private int $imported = 0;
    private int $updated = 0;
    private int $errors = 0;
    private array $errorLog = [];
    private array $warnings = [];
    private array $categoryCache = [];
    private array $maladieCache = [];

    public function __construct(
        private readonly EntityManagerInterface $entityManager,
        private readonly ValidatorInterface $validator
    ) {}

    public function importPremiersSoins(UploadedFile $file, bool $updateExisting = false): array
    {
        $this->resetCounters();
        $this->categoryCache = [];
        $this->maladieCache = [];

        $data = $this->parseFile($file);

        foreach ($data as $rowIndex => $row) {
            $this->processRow($row, $rowIndex, $updateExisting);
        }

        return [
            'imported' => $this->imported,
            'updated' => $this->updated,
            'errors' => $this->errors,
            'warnings' => $this->warnings,
            'errorLog' => $this->errorLog,
            'total' => count($data)
        ];
    }

    private function parseFile(UploadedFile $file): array
    {
        $extension = strtolower($file->getClientOriginalExtension());
        $data = [];

        if ($extension === 'csv') {
            $data = $this->parseCSV($file);
        } elseif (in_array($extension, ['xlsx', 'xls'])) {
            $data = $this->parseExcel($file);
        }

        return $data;
    }

    private function parseCSV(UploadedFile $file): array
    {
        $data = [];

        if (($handle = fopen($file->getPathname(), 'r')) !== false) {
            $firstLine = fgets($handle);
            rewind($handle);

            $delimiters = [',', ';', "\t"];
            $delimiter = ',';
            foreach ($delimiters as $d) {
                if (strpos($firstLine, $d) !== false) {
                    $delimiter = $d;
                    break;
                }
            }

            $headers = fgetcsv($handle, 0, $delimiter);
            $headers = array_map('trim', $headers);

            while (($row = fgetcsv($handle, 0, $delimiter)) !== false) {
                if (count($row) === count($headers)) {
                    $rowData = array_combine($headers, $row);
                    if ($rowData) {
                        $data[] = $this->sanitizeRow($rowData);
                    }
                }
            }
            fclose($handle);
        }

        return $data;
    }

    private function parseExcel(UploadedFile $file): array
    {
        if (!class_exists('PhpOffice\PhpSpreadsheet\IOFactory')) {
            throw new \Exception('PhpSpreadsheet n\'est pas installé. Exécutez: composer require phpoffice/phpspreadsheet');
        }

        $spreadsheet = \PhpOffice\PhpSpreadsheet\IOFactory::load($file->getPathname());
        $worksheet = $spreadsheet->getActiveSheet();
        $data = [];
        $headers = [];

        foreach ($worksheet->getRowIterator() as $rowIndex => $row) {
            $cellIterator = $row->getCellIterator();
            $cellIterator->setIterateOnlyExistingCells(false);

            $rowData = [];
            foreach ($cellIterator as $cell) {
                $value = $cell->getValue();
                if ($value instanceof \DateTime) {
                    $value = $value->format('Y-m-d');
                }
                $rowData[] = $value;
            }

            if ($rowIndex === 1) {
                $headers = array_map('trim', $rowData);
            } else {
                if (!empty($rowData) && array_filter($rowData)) {
                    if (count($rowData) === count($headers)) {
                        $rowData = array_combine($headers, $rowData);
                        if ($rowData) {
                            $data[] = $this->sanitizeRow($rowData);
                        }
                    }
                }
            }
        }

        return $data;
    }

    private function sanitizeRow(array $row): array
    {
        $sanitized = [];
        foreach ($row as $key => $value) {
            $key = trim($key);
            $value = is_string($value) ? trim($value) : $value;
            $sanitized[$key] = $value;
        }
        return $sanitized;
    }

    private function mapColumns(array $row): array
    {
        $mapping = [
            'titre' => ['titre', 'title', 'nom', 'name', 'premier_soin', 'etapes'],
            'description' => ['description', 'desc', 'etapes_detail', 'instructions', 'contenu'],
            'symptomes' => ['symptomes', 'symptômes', 'symptome', 'signes', 'symptoms'],
            'niveauUrgence' => ['niveau_urgence', 'urgence', 'niveau_gravite', 'gravite', 'gravité', 'severity', 'niveaurgence', 'niveauurgence'],
            'maladieNom' => ['maladie', 'maladie_nom', 'maladienom', 'disease', 'disease_name', 'nom_maladie'],
            'categorieNom' => ['categorie', 'categorie_nom', 'categorienom', 'category', 'catégorie'],
            'maladieDescription' => ['maladie_description', 'description_maladie', 'disease_description']
        ];

        $mapped = [];
        foreach ($row as $key => $value) {
            $keyLower = strtolower(trim($key));
            foreach ($mapping as $target => $aliases) {
                if (in_array($keyLower, $aliases)) {
                    $mapped[$target] = $value;
                    break;
                }
            }
        }

        return $mapped;
    }

    private function processRow(array $row, int $rowIndex, bool $updateExisting): void
    {
        try {
            $mappedRow = $this->mapColumns($row);

            if (empty($mappedRow['titre'])) {
                throw new \Exception("Le champ 'titre' est obligatoire");
            }

            if (empty($mappedRow['maladieNom'])) {
                throw new \Exception("Le champ 'maladieNom' (maladie liée) est obligatoire");
            }

            if (empty($mappedRow['niveauUrgence'])) {
                throw new \Exception("Le champ 'niveauUrgence' est obligatoire");
            }

            $dto = new PremierSoinImportDTO();
            $dto->titre = $mappedRow['titre'];
            $dto->description = $mappedRow['description'] ?? null;
            $dto->symptomes = $mappedRow['symptomes'] ?? null;
            $dto->niveauUrgence = strtoupper($mappedRow['niveauUrgence']);
            $dto->maladieNom = $mappedRow['maladieNom'];
            $dto->categorieNom = $mappedRow['categorieNom'] ?? 'Non classée';
            $dto->maladieDescription = $mappedRow['maladieDescription'] ?? null;

            $violations = $this->validator->validate($dto);

            if ($violations->count() > 0) {
                $errors = [];
                foreach ($violations as $violation) {
                    $errors[] = $violation->getPropertyPath() . ': ' . $violation->getMessage();
                }
                throw new \Exception('Validation échouée: ' . implode(', ', $errors));
            }

            $maladie = $this->findOrCreateMaladie($dto);

            if (!$maladie) {
                throw new \Exception("Impossible de trouver ou créer la maladie '{$dto->maladieNom}'");
            }

            $existingPS = $this->entityManager->getRepository(PremierSoin::class)
                ->findOneBy([
                    'titre' => $dto->titre,
                    'maladie' => $maladie
                ]);

            if ($existingPS) {
                if ($updateExisting) {
                    $this->updatePremierSoin($existingPS, $dto, $maladie);
                    $this->updated++;
                } else {
                    $this->warnings[] = [
                        'row' => $rowIndex + 1,
                        'message' => "Premier soin '{$dto->titre}' existe déjà pour la maladie '{$dto->maladieNom}' (ignoré)",
                        'data' => $row
                    ];
                }
                return;
            }

            $premierSoin = $this->createPremierSoin($dto, $maladie);
            $this->entityManager->persist($premierSoin);
            $this->entityManager->flush();

            $this->imported++;

        } catch (\Exception $e) {
            $this->errors++;
            $this->errorLog[] = [
                'row' => $rowIndex + 1,
                'error' => $e->getMessage(),
                'data' => $row
            ];
        }
    }

    private function findOrCreateMaladie(PremierSoinImportDTO $dto): ?Maladie
    {
        $cacheKey = strtolower(trim($dto->maladieNom));

        if (isset($this->maladieCache[$cacheKey])) {
            return $this->maladieCache[$cacheKey];
        }

        $maladie = $this->entityManager->getRepository(Maladie::class)
            ->createQueryBuilder('m')
            ->where('LOWER(m.nom) = LOWER(:nom)')
            ->setParameter('nom', $dto->maladieNom)
            ->getQuery()
            ->getOneOrNullResult();

        if (!$maladie) {
            $categorie = $this->findOrCreateCategory($dto->categorieNom ?? 'Non classée');

            if (!$categorie) {
                return null;
            }

            $maladie = new Maladie();
            $maladie->setNom($dto->maladieNom);
            $maladie->setDescription($dto->maladieDescription ?? "Maladie importée: {$dto->maladieNom}");
            $maladie->setNiveauGravite('VARIABLE');
            $maladie->setUrgence(false);
            $maladie->setContagieux(false);
            $maladie->setCategorie($categorie);

            $this->entityManager->persist($maladie);
            $this->entityManager->flush();

            $this->warnings[] = [
                'row' => 0,
                'message' => "Maladie '{$dto->maladieNom}' créée automatiquement dans la catégorie '{$categorie->getNom()}'",
                'data' => []
            ];
        }

        $this->maladieCache[$cacheKey] = $maladie;

        return $maladie;
    }

    private function findOrCreateCategory(string $categorieNom): ?Categorie
    {
        if (isset($this->categoryCache[$categorieNom])) {
            return $this->categoryCache[$categorieNom];
        }

        $categorie = $this->entityManager->getRepository(Categorie::class)
            ->findOneBy(['nom' => $categorieNom]);

        if (!$categorie) {
            $categorie = new Categorie();
            $categorie->setNom($categorieNom);
            $categorie->setDescription("Catégorie importée: $categorieNom");
            $categorie->setIcone('stethoscope');

            $this->entityManager->persist($categorie);
            $this->entityManager->flush();

            $this->warnings[] = [
                'row' => 0,
                'message' => "Catégorie '{$categorieNom}' créée automatiquement",
                'data' => []
            ];
        }

        $this->categoryCache[$categorieNom] = $categorie;

        return $categorie;
    }

    private function createPremierSoin(PremierSoinImportDTO $dto, Maladie $maladie): PremierSoin
    {
        $premierSoin = new PremierSoin();
        $premierSoin->setTitre($dto->titre);
        $premierSoin->setDescription($dto->description ?? '');
        $premierSoin->setSymptomes($dto->symptomes);
        $premierSoin->setNiveauUrgence($dto->niveauUrgence);
        $premierSoin->setMaladie($maladie);

        return $premierSoin;
    }

    private function updatePremierSoin(PremierSoin $premierSoin, PremierSoinImportDTO $dto, Maladie $maladie): void
    {
        $premierSoin->setDescription($dto->description ?? $premierSoin->getDescription());
        $premierSoin->setSymptomes($dto->symptomes ?? $premierSoin->getSymptomes());
        $premierSoin->setNiveauUrgence($dto->niveauUrgence);
        $premierSoin->setMaladie($maladie);

        $this->entityManager->flush();
    }

    private function resetCounters(): void
    {
        $this->imported = 0;
        $this->updated = 0;
        $this->errors = 0;
        $this->errorLog = [];
        $this->warnings = [];
        $this->categoryCache = [];
        $this->maladieCache = [];
    }
}
