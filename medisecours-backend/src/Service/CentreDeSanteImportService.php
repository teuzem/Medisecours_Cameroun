<?php

namespace App\Service;

use App\DTO\CentreDeSanteImportDTO;
use App\Entity\CentreDeSante;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\Validator\Validator\ValidatorInterface;

class CentreDeSanteImportService
{
    private int $imported = 0;
    private int $updated = 0;
    private int $errors = 0;
    private array $errorLog = [];
    private array $warnings = [];

    private const TYPE_MAP = [
        'Hôpital'              => 'hopital_general',
        'Hôpital général'      => 'hopital_general',
        'Hôpital de district'  => 'hopital_de_district',
        'CHU'                  => 'chu',
        'CMA'                  => 'cma',
        'CSI'                  => 'csi',
        'Clinique'             => 'clinique_privee',
        'Clinique privée'      => 'clinique_privee',
        'Pharmacie'            => 'pharmacie',
        'Laboratoire'          => 'laboratoire',
        'Centre spécialisé'    => 'centre_specialise',
        'Centre de santé'      => 'csi',
    ];

    public function __construct(
        private readonly EntityManagerInterface $entityManager,
        private readonly ValidatorInterface $validator
    ) {}

    public function importCentres(UploadedFile $file, bool $updateExisting = false): array
    {
        $this->resetCounters();
        $data = $this->parseFile($file);

        foreach ($data as $rowIndex => $row) {
            $this->processRow($row, $rowIndex, $updateExisting);
        }

        try {
            $this->entityManager->flush();
        } catch (\Throwable $e) {
            $this->errors++;
            $this->errorLog[] = ['row' => 0, 'error' => 'Erreur de persistance : ' . $e->getMessage()];
        }

        return [
            'imported' => $this->imported,
            'updated'  => $this->updated,
            'errors'   => $this->errors,
            'warnings' => $this->warnings,
            'errorLog' => $this->errorLog,
            'total'    => count($data),
        ];
    }

    private function parseFile(UploadedFile $file): array
    {
        $ext = strtolower($file->getClientOriginalExtension());
        return match ($ext) {
            'csv'        => $this->parseCSV($file),
            'xlsx', 'xls' => $this->parseExcel($file),
            default      => throw new \InvalidArgumentException("Format non supporté : {$ext}"),
        };
    }

    private function parseCSV(UploadedFile $file): array
    {
        $data = [];
        $handle = fopen($file->getPathname(), 'r');
        if (!$handle) {
            return $data;
        }

        $firstLine = fgets($handle);
        rewind($handle);

        $delimiter = ',';
        foreach ([',', ';', "\t"] as $d) {
            if (str_contains($firstLine, $d)) {
                $delimiter = $d;
                break;
            }
        }

        $headers = fgetcsv($handle, 0, $delimiter);
        if (!$headers) {
            fclose($handle);
            return $data;
        }
        $headers = array_map('trim', $headers);

        while (($row = fgetcsv($handle, 0, $delimiter)) !== false) {
            $row = array_map('trim', $row);
            if (count($row) === count($headers) && !empty(array_filter($row, fn($v) => $v !== ''))) {
                $combined = array_combine($headers, $row);
                if ($combined) {
                    $data[] = $this->sanitizeRow($combined);
                }
            }
        }

        fclose($handle);
        return $data;
    }

    private function parseExcel(UploadedFile $file): array
    {
        if (!class_exists(\PhpOffice\PhpSpreadsheet\IOFactory::class)) {
            throw new \RuntimeException('PhpSpreadsheet n\'est pas installé.');
        }

        $spreadsheet = \PhpOffice\PhpSpreadsheet\IOFactory::load($file->getPathname());
        $worksheet = $spreadsheet->getActiveSheet();
        $data = [];
        $headers = [];

        foreach ($worksheet->getRowIterator() as $rowIndex => $row) {
            $cellIterator = $row->getCellIterator();
            $cellIterator->setIterateOnlyExistingCells(false);

            $values = [];
            foreach ($cellIterator as $cell) {
                $v = $cell->getValue();
                if ($v instanceof \DateTime) {
                    $v = $v->format('Y-m-d');
                }
                $values[] = is_string($v) ? trim($v) : $v;
            }

            if ($rowIndex === 1) {
                $headers = array_map('trim', $values);
            } elseif (!empty(array_filter($values, fn($v) => $v !== ''))) {
                $combined = array_combine($headers, $values);
                if ($combined) {
                    $data[] = $this->sanitizeRow($combined);
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
            if (is_string($value)) {
                $lower = strtolower($value);
                if ($lower === 'true' || $lower === '1') {
                    $value = true;
                } elseif ($lower === 'false' || $lower === '0') {
                    $value = false;
                }
            }
            $sanitized[$key] = $value;
        }
        return $sanitized;
    }

    private function processRow(array $row, int $rowIndex, bool $updateExisting): void
    {
        try {
            $mappedRow = $this->mapColumns($row);

            $dto = new CentreDeSanteImportDTO();
            $dto->nom = $mappedRow['nom'] ?? '';
            $dto->type = $this->mapType((string) ($mappedRow['type'] ?? ''));
            $dto->region = $mappedRow['region'] ?? '';
            $dto->ville = $mappedRow['ville'] ?? '';
            $dto->quartier = !empty($mappedRow['quartier']) ? $mappedRow['quartier'] : null;
            $dto->adresse = $mappedRow['adresse'] ?? '';
            $dto->telephone = $this->normalizePhone((string) ($mappedRow['telephone'] ?? ''));
            $dto->email = !empty($mappedRow['email']) ? $mappedRow['email'] : null;
            $dto->siteWeb = !empty($mappedRow['siteWeb']) ? $mappedRow['siteWeb'] : null;
            $dto->latitude = isset($mappedRow['latitude']) ? (float) $mappedRow['latitude'] : 0;
            $dto->longitude = isset($mappedRow['longitude']) ? (float) $mappedRow['longitude'] : 0;
            $dto->horaires = !empty($mappedRow['horaires']) ? $mappedRow['horaires'] : null;
            $dto->description = !empty($mappedRow['description']) ? $mappedRow['description'] : null;
            $dto->statut = !empty($mappedRow['statut']) ? $mappedRow['statut'] : 'prive';
            $dto->estActif = isset($mappedRow['estActif']) ? (bool) $mappedRow['estActif'] : true;
            $dto->specialites = !empty($mappedRow['specialites']) ? $mappedRow['specialites'] : null;

            $violations = $this->validator->validate($dto);
            if ($violations->count() > 0) {
                $msgs = [];
                foreach ($violations as $v) {
                    $msgs[] = $v->getPropertyPath() . ' : ' . $v->getMessage();
                }
                throw new \InvalidArgumentException('Validation échouée : ' . implode(', ', $msgs));
            }

            $existingCentre = $this->entityManager->getRepository(CentreDeSante::class)
                ->findOneBy(['nom' => $dto->nom, 'ville' => $dto->ville]);

            if ($existingCentre) {
                if ($updateExisting) {
                    $this->updateCentre($existingCentre, $dto);
                    $this->updated++;
                } else {
                    $this->warnings[] = [
                        'row'     => $rowIndex + 1,
                        'message' => "Centre '{$dto->nom}' à {$dto->ville} existe déjà (ignoré)",
                        'data'    => $row,
                    ];
                }
                return;
            }

            $centre = $this->createCentre($dto);
            $this->entityManager->persist($centre);
            $this->imported++;
        } catch (\Throwable $e) {
            $this->errors++;
            $this->errorLog[] = [
                'row'   => $rowIndex + 1,
                'error' => $e->getMessage(),
                'data'  => $row,
            ];
        }
    }

    private function mapRow(array $row): array
    {
        $mapping = [
            'nom'         => ['nom', 'name', 'nom_centre', 'centre_nom', 'établissement'],
            'type'        => ['type', 'type_centre', 'catégorie', 'categorie'],
            'region'      => ['region', 'région', 'province'],
            'ville'       => ['ville', 'city', 'localite', 'localité'],
            'quartier'    => ['quartier', 'neighborhood', 'secteur'],
            'adresse'     => ['adresse', 'address', 'lieu', 'emplacement'],
            'telephone'   => ['telephone', 'téléphone', 'phone', 'contact', 'tel'],
            'email'       => ['email', 'mail', 'courriel'],
            'siteWeb'     => ['siteweb', 'site_web', 'website', 'url'],
            'latitude'    => ['latitude', 'lat', 'coord_lat'],
            'longitude'   => ['longitude', 'lng', 'long', 'coord_lng'],
            'horaires'    => ['horaires', 'horaire', 'heures', 'schedule'],
            'description' => ['description', 'desc', 'présentation', 'presentation'],
            'statut'      => ['statut', 'status', 'type_structure'],
            'estActif'    => ['estactif', 'est_actif', 'active', 'actif'],
            'specialites' => ['specialites', 'spécialités', 'specialties', 'services'],
        ];

        $mapped = [];
        foreach ($row as $key => $value) {
            $keyLower = strtolower(trim($key));
            foreach ($mapping as $target => $aliases) {
                if (in_array($keyLower, $aliases, true)) {
                    $mapped[$target] = $value;
                    break;
                }
            }
        }
        return $mapped;
    }

    private function mapColumns(array $row): array { return $this->mapRow($row); }

    private function mapType(string $type): string
    {
        $lower = strtolower(trim($type));

        // Déjà un slug ?
        if (in_array($lower, [
            'hopital_general', 'hopital_de_district', 'chu', 'cma', 'csi',
            'clinique_privee', 'pharmacie', 'laboratoire', 'centre_specialise',
        ], true)) {
            return $lower;
        }

        return self::TYPE_MAP[$type] ?? self::TYPE_MAP[$lower] ?? throw new \InvalidArgumentException(
            "Type de centre invalide : '{$type}'. Valeurs acceptées : " . implode(', ', array_keys(self::TYPE_MAP))
        );
    }

    private function createCentre(CentreDeSanteImportDTO $dto): CentreDeSante
    {
        $centre = new CentreDeSante();
        $centre->setNom($dto->nom);
        $centre->setType($dto->type);
        $centre->setRegion($dto->region);
        $centre->setVille($dto->ville);
        $centre->setQuartier($dto->quartier);
        $centre->setAdresse($dto->adresse);
        $centre->setTelephone($dto->telephone);
        $centre->setEmail($dto->email);
        $centre->setSiteWeb($dto->siteWeb);
        $centre->setLatitude($dto->latitude);
        $centre->setLongitude($dto->longitude);
        $centre->setHoraires($dto->horaires ?? 'Non renseigné');
        $centre->setDescription($dto->description);
        $centre->setStatut($dto->statut ?? 'prive');
        $centre->setEstActif($dto->estActif ?? true);
        $centre->setServices([]);

        if ($dto->specialites) {
            $centre->setSpecialites(array_map('trim', explode(',', $dto->specialites)));
        }

        return $centre;
    }

    private function updateCentre(CentreDeSante $centre, CentreDeSanteImportDTO $dto): void
    {
        if ($dto->nom) $centre->setNom($dto->nom);
        if ($dto->type) $centre->setType($dto->type);
        if ($dto->region) $centre->setRegion($dto->region);
        if ($dto->ville) $centre->setVille($dto->ville);
        if ($dto->quartier) $centre->setQuartier($dto->quartier);
        if ($dto->adresse) $centre->setAdresse($dto->adresse);
        if ($dto->telephone) $centre->setTelephone($dto->telephone);
        if ($dto->email) $centre->setEmail($dto->email);
        if ($dto->siteWeb) $centre->setSiteWeb($dto->siteWeb);
        if ($dto->latitude) $centre->setLatitude($dto->latitude);
        if ($dto->longitude) $centre->setLongitude($dto->longitude);
        if ($dto->horaires) $centre->setHoraires($dto->horaires);
        if ($dto->description) $centre->setDescription($dto->description);
        if ($dto->statut) $centre->setStatut($dto->statut);
        if ($dto->estActif !== null) $centre->setEstActif($dto->estActif);
        if ($dto->specialites) {
            $centre->setSpecialites(array_map('trim', explode(',', $dto->specialites)));
        }
    }

    private function normalizePhone(string $phone): string
    {
        $digits = preg_replace('/[^0-9]/', '', $phone);

        if (strlen($digits) === 12 && str_starts_with($digits, '237')) {
            return '+237 ' . substr($digits, 3);
        }
        if (strlen($digits) === 9 && str_starts_with($digits, '0')) {
            return '+237 ' . substr($digits, 1);
        }
        if (strlen($digits) === 9) {
            return '+237 ' . $digits;
        }
        return $phone;
    }

    private function resetCounters(): void
    {
        $this->imported = 0;
        $this->updated = 0;
        $this->errors = 0;
        $this->errorLog = [];
        $this->warnings = [];
    }
}
