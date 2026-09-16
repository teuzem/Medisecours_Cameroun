<?php

namespace App\Controller\Admin;

use App\Entity\Maladie;
use App\Entity\PremierSoin;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;
use Symfony\Component\Serializer\SerializerInterface;
use Symfony\Component\Validator\Validator\ValidatorInterface;

#[Route('/api/admin')]
#[IsGranted('ROLE_ADMIN')]
class PremierSoinController extends AbstractController
{
    #[Route('/maladies/{id}/premiers-soins', name: 'admin_create_premier_soin', methods: ['POST'])]
    public function create(Maladie $maladie, Request $request, EntityManagerInterface $em, SerializerInterface $serializer, ValidatorInterface $validator): JsonResponse
    {
        try {
            $data = json_decode($request->getContent(), true);
            if (!$data) {
                return $this->json(['error' => 'Données invalides.'], Response::HTTP_BAD_REQUEST);
            }

            $ps = new PremierSoin();
            $ps->setTitre($data['titre'] ?? '');
            $ps->setDescription($data['description'] ?? '');
            $ps->setSymptomes($data['symptomes'] ?? null);
            $ps->setNiveauUrgence($data['niveauUrgence'] ?? 'MOYEN');
            $ps->setMaladie($maladie);

            $errors = $validator->validate($ps);
            if ($errors->count() > 0) {
                $violations = [];
                foreach ($errors as $e) {
                    $violations[] = ['field' => $e->getPropertyPath(), 'message' => $e->getMessage()];
                }
                return $this->json(['error' => 'Validation échouée', 'violations' => $violations], Response::HTTP_BAD_REQUEST);
            }

            $em->persist($ps);
            $em->flush();

            return $this->json(
                $serializer->normalize($ps, null, ['groups' => ['premier_soin:read', 'maladie:read']]),
                Response::HTTP_CREATED
            );
        } catch (\Throwable $e) {
            return $this->json(['error' => $e->getMessage()], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    #[Route('/premiers-soins/{id}', name: 'admin_update_premier_soin', methods: ['PATCH'])]
    public function update(PremierSoin $ps, Request $request, EntityManagerInterface $em, SerializerInterface $serializer, ValidatorInterface $validator): JsonResponse
    {
        try {
            $data = json_decode($request->getContent(), true);
            if (!$data) {
                return $this->json(['error' => 'Données invalides.'], Response::HTTP_BAD_REQUEST);
            }

            if (isset($data['titre'])) $ps->setTitre($data['titre']);
            if (isset($data['description'])) $ps->setDescription($data['description']);
            if (array_key_exists('symptomes', $data)) $ps->setSymptomes($data['symptomes']);
            if (isset($data['niveauUrgence'])) $ps->setNiveauUrgence($data['niveauUrgence']);

            $errors = $validator->validate($ps);
            if ($errors->count() > 0) {
                $violations = [];
                foreach ($errors as $e) {
                    $violations[] = ['field' => $e->getPropertyPath(), 'message' => $e->getMessage()];
                }
                return $this->json(['error' => 'Validation échouée', 'violations' => $violations], Response::HTTP_BAD_REQUEST);
            }

            $em->flush();

            return $this->json(
                $serializer->normalize($ps, null, ['groups' => ['premier_soin:read', 'maladie:read']])
            );
        } catch (\Throwable $e) {
            return $this->json(['error' => $e->getMessage()], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    #[Route('/premiers-soins/{id}', name: 'admin_delete_premier_soin', methods: ['DELETE'])]
    public function delete(PremierSoin $ps, EntityManagerInterface $em): JsonResponse
    {
        try {
            $em->remove($ps);
            $em->flush();
            return $this->json(['success' => true]);
        } catch (\Throwable $e) {
            return $this->json(['error' => $e->getMessage()], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }
}
