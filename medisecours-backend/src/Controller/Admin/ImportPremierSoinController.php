<?php

namespace App\Controller\Admin;

use App\Entity\Categorie;
use App\Service\PremierSoinImportService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/admin/import')]
#[IsGranted('ROLE_ADMIN')]
class ImportPremierSoinController extends AbstractController
{
    public function __construct(
        private readonly PremierSoinImportService $importService,
        private readonly EntityManagerInterface $entityManager
    ) {}

    #[Route('/premiers-soins', name: 'admin_import_premiers_soins', methods: ['POST'])]
    public function importPremiersSoins(Request $request): JsonResponse
    {
        /** @var UploadedFile $file */
        $file = $request->files->get('file');

        if (!$file) {
            return $this->json(['error' => 'Aucun fichier fourni'], 400);
        }

        $allowedMimeTypes = [
            'text/csv',
            'text/plain',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ];

        if (!in_array($file->getMimeType(), $allowedMimeTypes)) {
            return $this->json([
                'error' => 'Format non supporté. Utilisez CSV ou Excel (.xlsx)'
            ], 400);
        }

        if ($file->getSize() > 10 * 1024 * 1024) {
            return $this->json(['error' => 'Fichier trop volumineux (max 10MB)'], 400);
        }

        $updateExisting = $request->query->get('updateExisting', 'false') === 'true';

        try {
            $result = $this->importService->importPremiersSoins($file, $updateExisting);

            return $this->json([
                'success' => true,
                'message' => 'Import terminé avec succès',
                'data' => $result
            ]);
        } catch (\Exception $e) {
            return $this->json([
                'error' => 'Erreur lors de l\'import: ' . $e->getMessage()
            ], 500);
        }
    }

    #[Route('/premiers-soins/template', name: 'admin_import_premiers_soins_template', methods: ['GET'])]
    public function downloadTemplate(): JsonResponse
    {
        $template = [
            [
                'titre', 'description', 'symptomes', 'niveauUrgence',
                'maladieNom', 'categorieNom', 'maladieDescription'
            ],
            [
                'Massage cardiaque externe',
                '1. Placer le patient sur une surface dure\n2. Placer les mains au centre de la poitrine\n3. Appuyer fort et rapidement (100-120 compressions/min)\n4. Alterner 30 compressions pour 2 insufflations',
                'Arrêt cardiaque, inconscience, absence de respiration',
                'CRITIQUE',
                'Infarctus du myocarde',
                'Cardiologie',
                'Urgence vitale nécessitant une intervention immédiate'
            ],
            [
                'Pose d\'un pansement',
                '1. Nettoyer la plaie avec du sérum physiologique\n2. Désinfecter autour de la plaie\n3. Appliquer une compresse stérile\n4. Fixer avec du sparadrap',
                'Coupure, saignement modéré, plaie superficielle',
                'FAIBLE',
                'Fracture du poignet',
                'Orthopédie',
                'Traumatisme courant suite à une chute'
            ],
            [
                'Traitement de la fièvre',
                '1. Prendre la température\n2. Donner du paracétamol si T° > 38.5°C\n3. Hydrater abondamment\n4. Découvrir le patient',
                'Fièvre élevée, frissons, courbatures, maux de tête',
                'MOYEN',
                'Grippe saisonnière',
                'Infectiologie',
                'Infection virale respiratoire aiguë'
            ]
        ];

        $filename = 'template_import_premiers_soins.csv';
        $handle = fopen('php://memory', 'r+');

        foreach ($template as $row) {
            fputcsv($handle, $row, ',');
        }

        rewind($handle);
        $content = stream_get_contents($handle);
        fclose($handle);

        return $this->json([
            'template' => $content,
            'filename' => $filename
        ]);
    }

    #[Route('/premiers-soins/categories', name: 'admin_import_premiers_soins_categories', methods: ['GET'])]
    public function getCategories(): JsonResponse
    {
        $categories = $this->entityManager->getRepository(Categorie::class)
            ->findAll();

        $data = array_map(function($categorie) {
            return [
                'id' => $categorie->getId(),
                'nom' => $categorie->getNom(),
                'icone' => $categorie->getIcone()
            ];
        }, $categories);

        return $this->json($data);
    }
}
