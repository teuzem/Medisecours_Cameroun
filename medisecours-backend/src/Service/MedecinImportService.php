<?php

namespace App\Service;

use App\DTO\MedecinImportDTO;
use App\Entity\Medecin;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\Validator\Validator\ValidatorInterface;

class MedecinImportService
{
    private int $imported = 0;
    private int $errors = 0;
    private array $errorLog = [];

    public function __construct(
        private readonly EntityManagerInterface $entityManager,
        private readonly UserPasswordHasherInterface $passwordHasher,
        private readonly ValidatorInterface $validator,
    ) {}

    public function import(UploadedFile $file): array
    {
        $this->reset();

        $rows = $this->parse($file);

        foreach ($rows as $index => $row) {
            $this->process($row, $index + 2);
        }

        try {
            $this->entityManager->flush();
        } catch (\Throwable $e) {
            $this->errors++;
            $this->errorLog[] = ['row' => [], 'error' => 'Erreur de persistance : ' . $e->getMessage()];
        }

        return [
            'imported' => $this->imported,
            'errors'   => $this->errors,
            'errorLog' => $this->errorLog,
        ];
    }

    private function parse(UploadedFile $file): array
    {
        $ext = strtolower($file->getClientOriginalExtension());

        return match ($ext) {
            'csv'        => $this->parseCsv($file),
            'xlsx', 'xls' => $this->parseExcel($file),
            default      => throw new \InvalidArgumentException("Format de fichier non supporté : {$ext}"),
        };
    }

    private function parseCsv(UploadedFile $file): array
    {
        $rows = [];
        $handle = fopen($file->getPathname(), 'r');

        if (!$handle) {
            throw new \RuntimeException('Impossible de lire le fichier CSV.');
        }

        $headers = fgetcsv($handle);

        if (!$headers) {
            fclose($handle);
            throw new \RuntimeException('Le fichier CSV est vide ou ses en-têtes sont invalides.');
        }

        $headers = array_map('trim', $headers);

        while (($line = fgetcsv($handle)) !== false) {
            $line = array_map('trim', $line);

            if (count($headers) !== count($line)) {
                continue;
            }

            $row = array_combine($headers, $line);

            if ($row && !empty(array_filter($row, fn ($v) => $v !== ''))) {
                $rows[] = $row;
            }
        }

        fclose($handle);

        return $rows;
    }

    private function parseExcel(UploadedFile $file): array
    {
        if (!class_exists(\PhpOffice\PhpSpreadsheet\IOFactory::class)) {
            throw new \RuntimeException('PhpSpreadsheet n\'est pas installé. Exécutez : composer require phpoffice/phpspreadsheet');
        }

        $spreadsheet = \PhpOffice\PhpSpreadsheet\IOFactory::load($file->getPathname());
        $worksheet = $spreadsheet->getActiveSheet();
        $rows = [];
        $headers = [];

        foreach ($worksheet->getRowIterator() as $rowIndex => $row) {
            $cellIterator = $row->getCellIterator();
            $cellIterator->setIterateOnlyExistingCells(false);

            $values = [];
            foreach ($cellIterator as $cell) {
                $values[] = trim((string) $cell->getValue());
            }

            if ($rowIndex === 1) {
                $headers = $values;
            } else {
                if (!empty(array_filter($values, fn ($v) => $v !== ''))) {
                    $combined = array_combine($headers, $values);
                    if ($combined) {
                        $rows[] = $combined;
                    }
                }
            }
        }

        return $rows;
    }

    private function process(array $row, int $line): void
    {
        try {
            $dto = new MedecinImportDTO();
            $dto->email = trim($row['email'] ?? '');
            $dto->password = $row['password'] ?? null;
            $dto->nom = trim($row['nom'] ?? '');
            $dto->prenom = trim($row['prenom'] ?? '');
            $dto->telephone = $this->normalizePhone(trim($row['telephone'] ?? ''));
            $dto->specialite = trim($row['specialite'] ?? '');
            $dto->numeroOrdre = trim($row['numeroOrdre'] ?? $row['numero_ordre'] ?? '');
            $dto->quartier = trim($row['quartier'] ?? '') ?: null;

            $violations = $this->validator->validate($dto);

            if ($violations->count() > 0) {
                $messages = [];
                foreach ($violations as $v) {
                    $messages[] = $v->getPropertyPath() . ' : ' . $v->getMessage();
                }
                throw new \InvalidArgumentException('Validation échouée : ' . implode(', ', $messages));
            }

            $existing = $this->entityManager->getRepository(User::class)->findOneBy(['email' => $dto->email]);

            if ($existing) {
                throw new \InvalidArgumentException("L'email {$dto->email} existe déjà.");
            }

            $password = $dto->password ?? bin2hex(random_bytes(12));

            $medecin = new Medecin();
            $medecin->setEmail($dto->email);
            $medecin->setPassword($this->passwordHasher->hashPassword($medecin, $password));
            $medecin->setNom($dto->nom);
            $medecin->setPrenom($dto->prenom);
            $medecin->setTelephone($dto->telephone);
            $medecin->setSpecialite($dto->specialite);
            $medecin->setNumeroOrdre($dto->numeroOrdre);
            $medecin->setQuartier($dto->quartier);
            $medecin->setEstValide(false);
            $medecin->setEmailVerified(true);

            $this->entityManager->persist($medecin);
            $this->imported++;
        } catch (\Throwable $e) {
            $this->errors++;
            $this->errorLog[] = [
                'ligne' => $line,
                'email' => $row['email'] ?? '?',
                'error' => $e->getMessage(),
            ];
        }
    }

    private function normalizePhone(string $phone): string
    {
        // Supprime tout caractère non numérique
        $digits = preg_replace('/[^0-9]/', '', $phone);

        // Format camerounais : 6XX XXX XXX → 6XXXXXXXX
        // +237 6XXXXXXXX → 6XXXXXXXX
        if (strlen($digits) === 12 && str_starts_with($digits, '237')) {
            return '+237 ' . substr($digits, 3);
        }

        // 06XXXXXXXX → 6XXXXXXXX
        if (strlen($digits) === 9 && str_starts_with($digits, '0')) {
            return '+237 ' . substr($digits, 1);
        }

        // 6XXXXXXXX (déjà sans préfixe)
        if (strlen($digits) === 9) {
            return '+237 ' . $digits;
        }

        return $phone;
    }

    private function reset(): void
    {
        $this->imported = 0;
        $this->errors = 0;
        $this->errorLog = [];
    }
}
