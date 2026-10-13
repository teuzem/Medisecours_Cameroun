<?php

declare(strict_types=1);

namespace App\Controller\Api;

use App\Entity\DossierEvenement;
use App\Entity\DossierMedical;
use App\Entity\Patient;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

/**
 * Lecture seule du dossier médical par le patient lui-même.
 *
 * Chaque établissement ouvre un dossier par patient (couple centre/patient).
 * Le patient ne voit que ses propres dossiers et leurs événements
 * horodatés (accueil, signes vitaux, consultations, soins, ordonnances,
 * pharmacie). Aucune écriture n'est exposée ici : le circuit d'écriture
 * reste réservé au personnel via /api/personnel/dossiers.
 */
final class PatientDossierController extends AbstractController
{
    #[Route(
        '/api/patient/dossiers',
        name: 'api_patient_dossiers_list',
        methods: ['GET'],
        priority: 20,
    )]
    #[IsGranted('ROLE_PATIENT')]
    public function list(EntityManagerInterface $em): JsonResponse
    {
        $patient = $this->getUser();
        if (!$patient instanceof Patient) {
            return new JsonResponse(
                ['error' => 'Utilisateur patient non authentifie.'],
                JsonResponse::HTTP_UNAUTHORIZED,
            );
        }

        $dossiers = $em->getRepository(DossierMedical::class)->findBy(
            ['patient' => $patient],
            ['createdAt' => 'DESC']
        );

        return new JsonResponse([
            'dossiers' => array_map(
                fn (DossierMedical $dossier): array => $this->serializeDossier($dossier, $em, false),
                $dossiers
            ),
            'total' => count($dossiers),
        ]);
    }

    #[Route(
        '/api/patient/dossiers/{id}',
        name: 'api_patient_dossiers_detail',
        methods: ['GET'],
        requirements: ['id' => '\d+'],
        priority: 20,
    )]
    #[IsGranted('ROLE_PATIENT')]
    public function detail(int $id, EntityManagerInterface $em): JsonResponse
    {
        $patient = $this->getUser();
        if (!$patient instanceof Patient) {
            return new JsonResponse(
                ['error' => 'Utilisateur patient non authentifie.'],
                JsonResponse::HTTP_UNAUTHORIZED,
            );
        }

        $dossier = $em->getRepository(DossierMedical::class)->find($id);
        if (!$dossier instanceof DossierMedical || $dossier->getPatient() !== $patient) {
            return new JsonResponse(
                ['error' => 'Dossier introuvable.'],
                JsonResponse::HTTP_NOT_FOUND,
            );
        }

        return new JsonResponse(['dossier' => $this->serializeDossier($dossier, $em, true)]);
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeDossier(DossierMedical $dossier, EntityManagerInterface $em, bool $withEvents): array
    {
        $centre = $dossier->getCentre();
        $events = $em->getRepository(DossierEvenement::class)->findBy(
            ['dossier' => $dossier],
            ['createdAt' => 'DESC', 'id' => 'DESC'],
            $withEvents ? 200 : 1
        );

        $data = [
            'id' => $dossier->getId(),
            'numero' => $dossier->getNumero(),
            'statut' => $dossier->getStatut(),
            'createdAt' => $dossier->getCreatedAt()->format('c'),
            'closedAt' => $dossier->getClosedAt()?->format('c'),
            'centre' => $centre ? [
                'id' => $centre->getId(),
                'nom' => $centre->getNom(),
                'ville' => $centre->getVille(),
                'type' => $centre->getType(),
            ] : null,
            'evenementsTotal' => $withEvents
                ? count($events)
                : (int) $em->createQueryBuilder()
                    ->select('COUNT(e.id)')
                    ->from(DossierEvenement::class, 'e')
                    ->where('e.dossier = :dossier')
                    ->setParameter('dossier', $dossier)
                    ->getQuery()
                    ->getSingleScalarResult(),
            'dernierEvenementAt' => isset($events[0]) ? $events[0]->getCreatedAt()->format('c') : null,
        ];

        if ($withEvents) {
            $data['evenements'] = array_map(
                static fn (DossierEvenement $event): array => [
                    'id' => $event->getId(),
                    'type' => $event->getType(),
                    'titre' => $event->getTitre(),
                    'details' => $event->getDetails(),
                    'auteurNom' => $event->getAuteur()
                        ? trim(sprintf('%s %s', (string) $event->getAuteur()->getPrenom(), (string) $event->getAuteur()->getNom())) ?: $event->getAuteur()->getEmail()
                        : null,
                    'signe' => $event->getSignatureHash() !== null,
                    'createdAt' => $event->getCreatedAt()->format('c'),
                ],
                $events
            );
        }

        return $data;
    }
}
