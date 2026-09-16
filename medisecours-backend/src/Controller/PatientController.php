<?php

namespace App\Controller;

use App\Entity\Medecin;
use App\Repository\UserRepository;
use App\Service\UserSerializer;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

#[Route('/api/patients')]
class PatientController extends AbstractController
{
    #[Route('', methods: ['GET'])]
    public function index(
        Request $request,
        UserRepository $userRepository,
        UserSerializer $userSerializer
    ): JsonResponse
    {
        $this->denyAccessUnlessGranted('ROLE_MEDECIN');

        $medecin = $this->getUser();
        if (!$medecin instanceof Medecin) {
            throw $this->createAccessDeniedException('Accès réservé aux médecins.');
        }

        $patients = $userRepository->findActivePatientsForMedecin(
            $medecin,
            $request->query->getString('search')
        );
        $data = array_map(
            static fn($patient) => $userSerializer->serialize($patient),
            $patients
        );

        return $this->json($data);
    }
}
