<?php

namespace App\Controller;

use App\Service\MedecinImportService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;

#[Route('/api/admin/import')]
class ImportMedecinController extends AbstractController
{
    public function __construct(
        private readonly MedecinImportService $importService,
    ) {}

    #[Route('/medecins', name: 'admin_import_medecins', methods: ['POST'])]
    public function importMedecins(Request $request): JsonResponse
    {
        $this->denyAccessUnlessGranted('ROLE_ADMIN');

        $file = $request->files->get('file');

        if (!$file) {
            return $this->json(['error' => 'Aucun fichier fourni.'], Response::HTTP_BAD_REQUEST);
        }

        $allowedExtensions = ['csv', 'xlsx', 'xls'];
        $ext = strtolower($file->getClientOriginalExtension());
        if (!in_array($ext, $allowedExtensions, true)) {
            return $this->json(['error' => 'Format non supporté. Utilisez CSV ou Excel (.xlsx, .xls).'], Response::HTTP_BAD_REQUEST);
        }

        if ($file->getSize() > 10 * 1024 * 1024) {
            return $this->json(['error' => 'Fichier trop volumineux (max 10 MB).'], Response::HTTP_BAD_REQUEST);
        }

        try {
            $result = $this->importService->import($file);
            return $this->json([
                'success' => true,
                'message' => "Import terminé : {$result['imported']} médecin(s) créé(s), {$result['errors']} erreur(s).",
                'data'    => $result,
            ]);
        } catch (\Throwable $e) {
            return $this->json(['error' => 'Erreur lors de l\'import : ' . $e->getMessage()], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    #[Route('/medecins/template', name: 'admin_import_medecins_template', methods: ['GET'])]
    public function downloadTemplate(): Response
    {
        $this->denyAccessUnlessGranted('ROLE_ADMIN');

        $headers = ['email', 'password', 'nom', 'prenom', 'telephone', 'specialite', 'numeroOrdre', 'quartier'];
        $example = ['dr.exemple@email.com', 'MotDePasse1!', 'Dupont', 'Jean', '+237 6XXXXXXXX', 'Cardiologie', 'CM-ORD-12345', 'Bastos'];

        $handle = fopen('php://memory', 'r+');
        fputcsv($handle, $headers);
        fputcsv($handle, $example);
        rewind($handle);
        $content = stream_get_contents($handle);
        fclose($handle);

        return new Response(
            $content,
            Response::HTTP_OK,
            [
                'Content-Type'        => 'text/csv; charset=utf-8',
                'Content-Disposition' => 'attachment; filename="template_import_medecins.csv"',
            ]
        );
    }
}
