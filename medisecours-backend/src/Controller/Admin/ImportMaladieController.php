<?php
// src/Controller/Admin/ImportMaladieController.php

namespace App\Controller\Admin;

use App\Entity\Categorie;
use App\Service\MaladieImportService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/admin/import')]
#[IsGranted('ROLE_ADMIN')]
class ImportMaladieController extends AbstractController
{
    public function __construct(
        private readonly MaladieImportService $importService,
        private readonly EntityManagerInterface $entityManager
    ) {}

    #[Route('/maladies', name: 'admin_import_maladies', methods: ['POST'])]
    public function importMaladies(Request $request): JsonResponse
    {
        /** @var UploadedFile $file */
        $file = $request->files->get('file');

        if (!$file) {
            return $this->json(['error' => 'Aucun fichier fourni'], 400);
        }

        // Validation du fichier
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
            $result = $this->importService->importMaladies($file, $updateExisting);

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

    #[Route('/maladies/template', name: 'admin_import_maladies_template', methods: ['GET'])]
    public function downloadTemplate(): JsonResponse
    {
        $template = [
            [
                'nom', 'description', 'symptomes', 'niveauGravite',
                'urgence', 'contagieux', 'categorie_nom',
                'premier_soin_etapes', 'premier_soin_precautions'
            ],
            [
                'Infarctus du myocarde',
                'Arrêt brutal de la circulation sanguine vers le cœur',
                'Douleur thoracique intense, essoufflement, sueurs, nausées',
                'CRITIQUE',
                'true',
                'false',
                'Cardiologie',
                "1. Appeler immédiatement le SAMU\n2. Allonger le patient en position demi-assise\n3. Donner de l'aspirine si prescrite par le médecin\n4. Détacher les vêtements serrés",
                "Ne pas faire marcher le patient\nNe pas donner à boire ou à manger\nNe pas masser la poitrine"
            ],
            [
                'Grippe saisonnière',
                'Infection virale respiratoire aiguë',
                'Fièvre élevée, courbatures intenses, maux de tête, toux sèche',
                'MODÉRÉE',
                'false',
                'true',
                'Infectiologie',
                "1. Repos au lit\n2. Hydratation abondante\n3. Prise d'antipyrétiques pour faire baisser la fièvre\n4. Alimentation légère",
                "Éviter tout contact avec les personnes fragiles\nSe laver les mains régulièrement\nAérer la pièce"
            ],
            [
                'Fracture du poignet',
                'Rupture de l\'os du poignet suite à une chute',
                'Douleur intense, gonflement, déformation visible, incapacité de bouger le poignet',
                'SÉVÈRE',
                'true',
                'false',
                'Orthopédie',
                "1. Immobiliser le poignet avec une attelle de fortune\n2. Appliquer de la glace pour réduire l'œdème\n3. Surélever le membre pour limiter l'enflure\n4. Consulter un médecin immédiatement",
                "Ne pas tenter de remettre l'os en place\nNe pas appliquer de chaleur\nNe pas masser"
            ]
        ];

        $filename = 'template_import_maladies.csv';
        $handle = fopen('php://memory', 'r+');

        foreach ($template as $row) {
            fputcsv($handle, $row);
        }

        rewind($handle);
        $content = stream_get_contents($handle);
        fclose($handle);

        return $this->json([
            'template' => $content,
            'filename' => $filename
        ]);
    }

    #[Route('/maladies/categories', name: 'admin_import_maladies_categories', methods: ['GET'])]
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
