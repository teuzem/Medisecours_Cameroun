<?php
// src/Service/MaladieImportService.php

namespace App\Service;

use App\DTO\MaladieImportDTO;
use App\Entity\Categorie;
use App\Entity\Maladie;
use App\Entity\PremierSoin;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\Validator\Validator\ValidatorInterface;

class MaladieImportService
{
    private int $imported = 0;
    private int $updated = 0;
    private int $errors = 0;
    private array $errorLog = [];
    private array $warnings = [];
    private array $categoryCache = [];

    public function __construct(
        private readonly EntityManagerInterface $entityManager,
        private readonly ValidatorInterface $validator
    ) {}

    public function importMaladies(UploadedFile $file, bool $updateExisting = false): array
    {
        $this->resetCounters();
        $this->categoryCache = [];

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
            // Détection du séparateur
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

            // Convertir les booléens
            if (is_string($value)) {
                $lowerValue = strtolower($value);
                if (in_array($lowerValue, ['true', '1', 'oui', 'yes', 'vrai'])) {
                    $value = true;
                } elseif (in_array($lowerValue, ['false', '0', 'non', 'no', 'faux'])) {
                    $value = false;
                }
            }

            $sanitized[$key] = $value;
        }
        return $sanitized;
    }

    private function mapColumns(array $row): array
    {
        $mapping = [
            'nom' => ['nom', 'name', 'maladie', 'maladie_nom'],
            'description' => ['description', 'desc', 'descriptif'],
            'symptomes' => ['symptomes', 'symptômes', 'symptome', 'signes', 'symptoms'],
            'niveauGravite' => ['niveaugravite', 'niveau_gravite', 'gravite', 'gravité', 'severite', 'severity'],
            'urgence' => ['urgence', 'urgent', 'emergency'],
            'contagieux' => ['contagieux', 'contagieuse', 'contagious'],
            'categorieNom' => ['categorie_nom', 'categorie', 'categorie_nom', 'category', 'catégorie'],
            'premierSoinEtapes' => ['premier_soin_etapes', 'premiersoins', 'premier_soin', 'etapes', 'steps'],
            'premierSoinPrecautions' => ['premier_soin_precautions', 'precautions', 'precautions', 'recommandations']
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

            // Vérification des champs obligatoires
            $requiredFields = ['nom', 'niveauGravite', 'categorieNom'];
            foreach ($requiredFields as $field) {
                if (empty($mappedRow[$field])) {
                    throw new \Exception("Le champ '$field' est obligatoire");
                }
            }

            $dto = new MaladieImportDTO();
            $dto->nom = $mappedRow['nom'];
            $dto->description = $mappedRow['description'] ?? null;
            $dto->symptomes = $mappedRow['symptomes'] ?? null;
            $dto->niveauGravite = strtoupper($mappedRow['niveauGravite']);
            $dto->urgence = $mappedRow['urgence'] ?? false;
            $dto->contagieux = $mappedRow['contagieux'] ?? false;
            $dto->categorieNom = $mappedRow['categorieNom'];
            $dto->premierSoinEtapes = $mappedRow['premierSoinEtapes'] ?? null;
            $dto->premierSoinPrecautions = $mappedRow['premierSoinPrecautions'] ?? null;

            // Validation
            $violations = $this->validator->validate($dto);

            if ($violations->count() > 0) {
                $errors = [];
                foreach ($violations as $violation) {
                    $errors[] = $violation->getPropertyPath() . ': ' . $violation->getMessage();
                }
                throw new \Exception('Validation échouée: ' . implode(', ', $errors));
            }

            // Recherche ou création de la catégorie
            $categorie = $this->findOrCreateCategory($dto->categorieNom);

            if (!$categorie) {
                throw new \Exception("Impossible de créer la catégorie '{$dto->categorieNom}'");
            }

            // Vérification si la maladie existe déjà
            $existingMaladie = $this->entityManager->getRepository(Maladie::class)
                ->findOneBy([
                    'nom' => $dto->nom,
                    'categorie' => $categorie
                ]);

            if ($existingMaladie) {
                if ($updateExisting) {
                    $this->updateMaladie($existingMaladie, $dto, $categorie);
                    $this->updated++;
                } else {
                    $this->warnings[] = [
                        'row' => $rowIndex + 1,
                        'message' => "Maladie '{$dto->nom}' existe déjà dans la catégorie '{$categorie->getNom()}' (ignoré)",
                        'data' => $row
                    ];
                }
                return;
            }

            // Création de la maladie
            $maladie = $this->createMaladie($dto, $categorie);
            $this->entityManager->persist($maladie);
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

    private function findOrCreateCategory(string $categorieNom): ?Categorie
    {
        // Vérifier le cache
        if (isset($this->categoryCache[$categorieNom])) {
            return $this->categoryCache[$categorieNom];
        }

        // Rechercher la catégorie
        $categorie = $this->entityManager->getRepository(Categorie::class)
            ->findOneBy(['nom' => $categorieNom]);

        // Créer la catégorie si elle n'existe pas
        if (!$categorie) {
            $categorie = new Categorie();
            $categorie->setNom($categorieNom);
            $categorie->setDescription("Catégorie importée: $categorieNom");
            $categorie->setIcone('stethoscope'); // Icône par défaut

            $this->entityManager->persist($categorie);
            $this->entityManager->flush();

            // Ajouter un warning
            $this->warnings[] = [
                'row' => 0,
                'message' => "Catégorie '{$categorieNom}' créée automatiquement",
                'data' => []
            ];
        }

        // Mettre en cache
        $this->categoryCache[$categorieNom] = $categorie;

        return $categorie;
    }

    private function mapGraviteToUrgence(string $niveauGravite): string
    {
        return match ($niveauGravite) {
            'LÉGÈRE' => 'FAIBLE',
            'MODÉRÉE' => 'MOYEN',
            'SÉVÈRE' => 'ÉLEVÉ',
            'CRITIQUE' => 'CRITIQUE',
            default => 'MOYEN',
        };
    }

    private function createMaladie(MaladieImportDTO $dto, Categorie $categorie): Maladie
    {
        $maladie = new Maladie();
        $maladie->setNom($dto->nom);
        $maladie->setDescription($dto->description);
        $maladie->setSymptomes($dto->symptomes);
        $maladie->setNiveauGravite($dto->niveauGravite);
        $maladie->setUrgence($dto->urgence);
        $maladie->setContagieux($dto->contagieux);
        $maladie->setCategorie($categorie);

        if ($dto->premierSoinEtapes) {
            $premierSoin = new PremierSoin();
            $premierSoin->setTitre('Premiers soins - ' . $dto->nom);
            $description = $dto->premierSoinEtapes;
            if ($dto->premierSoinPrecautions) {
                $description .= "\n\nPrécautions:\n" . $dto->premierSoinPrecautions;
            }
            $premierSoin->setDescription($description);
            $premierSoin->setNiveauUrgence($this->mapGraviteToUrgence($dto->niveauGravite));
            $premierSoin->setMaladie($maladie);
            $this->entityManager->persist($premierSoin);
        }

        return $maladie;
    }

    private function updateMaladie(Maladie $maladie, MaladieImportDTO $dto, Categorie $categorie): void
    {
        $maladie->setDescription($dto->description ?? $maladie->getDescription());
        $maladie->setSymptomes($dto->symptomes ?? $maladie->getSymptomes());
        $maladie->setNiveauGravite($dto->niveauGravite);
        $maladie->setUrgence($dto->urgence);
        $maladie->setContagieux($dto->contagieux);
        $maladie->setCategorie($categorie);

        if ($dto->premierSoinEtapes) {
            foreach ($maladie->getPremiersSoins() as $premierSoin) {
                $this->entityManager->remove($premierSoin);
            }

            $premierSoin = new PremierSoin();
            $premierSoin->setTitre('Premiers soins - ' . $dto->nom);
            $description = $dto->premierSoinEtapes;
            if ($dto->premierSoinPrecautions) {
                $description .= "\n\nPrécautions:\n" . $dto->premierSoinPrecautions;
            }
            $premierSoin->setDescription($description);
            $premierSoin->setNiveauUrgence($this->mapGraviteToUrgence($dto->niveauGravite));
            $premierSoin->setMaladie($maladie);
            $this->entityManager->persist($premierSoin);
        }

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
    }
}
