<?php

namespace App\Controller\Admin;

use App\Service\CentreDeSanteImportService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/admin/import')]
#[IsGranted('ROLE_ADMIN')]
class ImportCentreController extends AbstractController
{
    public function __construct(
        private readonly CentreDeSanteImportService $importService
    ) {}

    #[Route('/centres', name: 'admin_import_centres', methods: ['POST'])]
    public function importCentres(Request $request): JsonResponse
    {
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

        $updateExisting = $request->query->get('updateExisting', 'false') === 'true';

        try {
            $result = $this->importService->importCentres($file, $updateExisting);
            return $this->json([
                'success' => true,
                'message' => "Import terminé : {$result['imported']} centre(s) créé(s), {$result['updated']} mis à jour, {$result['errors']} erreur(s).",
                'data'    => $result,
            ]);
        } catch (\Throwable $e) {
            return $this->json(['error' => 'Erreur lors de l\'import : ' . $e->getMessage()], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    #[Route('/centres/template', name: 'admin_import_centres_template', methods: ['GET'])]
    public function downloadTemplate(): Response
    {
        $headers = ['nom', 'type', 'region', 'ville', 'quartier', 'adresse', 'telephone', 'email', 'siteWeb', 'latitude', 'longitude', 'horaires', 'description', 'statut', 'estActif', 'specialites'];
        $example = ['Hôpital Central de Yaoundé', 'Hôpital', 'Centre', 'Yaoundé', 'Mvog-Mbi', 'Avenue Charles de Gaulle', '+237 690000001', 'contact@hcy.cm', 'www.hcy.cm', '3.863', '11.516', 'Lun-Ven 8h-18h, Sam 8h-13h', 'Hôpital de référence', 'public', 'true', 'Cardiologie, Pédiatrie, Orthopédie'];

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
                'Content-Disposition' => 'attachment; filename="template_import_centres.csv"',
            ]
        );
    }
}
