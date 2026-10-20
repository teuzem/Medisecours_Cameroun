<?php

declare(strict_types=1);

namespace App\Controller;

use App\Entity\PersonnelSante;
use App\Repository\AvisPersonnelRepository;
use App\Repository\EtablissementEquipeRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\Routing\Annotation\Route;

/**
 * Profils publics des personnels de santé.
 *
 * Page de profil professionnelle (esprit LinkedIn) : couverture, identité,
 * établissement, notation par les patients et avis publiés.
 *
 * Lecture publique et sans authentification : la page doit être indexable et
 * partageable. Seules les informations professionnelles sont exposées (aucun
 * email, aucun téléphone).
 */
class PersonnelPublicController extends AbstractController
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly AvisPersonnelRepository $avis,
        private readonly EtablissementEquipeRepository $equipe,
    ) {
    }

    #[Route('/api/personnels-publics', name: 'api_personnels_publics_liste', methods: ['GET'])]
    public function liste(Request $request): JsonResponse
    {
        $centreId = $request->query->get('centre');
        $type = $request->query->get('type');
        $limite = min(100, max(1, (int) $request->query->get('limit', '40')));

        $qb = $this->em->createQueryBuilder()
            ->select('p')
            ->from(PersonnelSante::class, 'p')
            ->where('p.type = :typePerso')
            ->setParameter('typePerso', 'personnel')
            ->andWhere('p.banni = false')
            ->andWhere('p.statutValidation = :valide')
            ->setParameter('valide', PersonnelSante::VALIDATION_VALIDE)
            ->orderBy('p.nom', 'ASC')
            ->setMaxResults($limite);

        if ($centreId !== null && $centreId !== '') {
            $qb
                ->andWhere('p.etablissement = :centre')
                ->setParameter('centre', (int) $centreId);
        }
        if ($type !== null && $type !== '' && in_array($type, PersonnelSante::TYPES, true)) {
            $qb
                ->andWhere('p.typePersonnel = :type')
                ->setParameter('type', $type);
        }

        $items = array_map(
            fn (PersonnelSante $p): array => $this->serializeProfile($p, false),
            $qb->getQuery()->getResult()
        );

        return new JsonResponse(['items' => $items, 'total' => count($items)]);
    }

    #[Route('/api/personnels-publics/{id}', name: 'api_personnels_publics_detail', methods: ['GET'], requirements: ['id' => '[0-9a-fA-F-]{36}'])]
    public function detail(string $id): JsonResponse
    {
        $personnel = $this->em->getRepository(PersonnelSante::class)->find($id);
        if (!$personnel || $personnel->isBanni()) {
            throw new NotFoundHttpException('Personnel introuvable.');
        }

        $payload = $this->serializeProfile($personnel, true);
        $payload['avis'] = array_map(
            fn ($avis): array => [
                'id' => $avis->getId(),
                'note' => $avis->getNote(),
                'commentaire' => $avis->getCommentaire(),
                'createdAt' => $avis->getCreatedAt()->format('c'),
                'auteurNom' => $avis->getPatient()
                    ? trim(($avis->getPatient()->getPrenom() ?? '').' '.($avis->getPatient()->getNom() ?? ''))
                    : null,
                'auteurPhoto' => $avis->getPatient()?->getPhotoProfil(),
            ],
            $this->avis->findPublishedByPersonnel($personnel)
        );

        return new JsonResponse($payload);
    }

    private function serializeProfile(PersonnelSante $p, bool $detail): array
    {
        $centre = $p->getEtablissement();

        $payload = [
            'id' => (string) $p->getId(),
            'nom' => $p->getNom(),
            'prenom' => $p->getPrenom(),
            'photoProfil' => $p->getPhotoProfil(),
            'photoCouverture' => $p->getPhotoCouverture(),
            'typePersonnel' => $p->getTypePersonnel(),
            'fonction' => $p->getFonction(),
            'numeroOrdre' => $p->getNumeroOrdre(),
            'noteMoyenne' => $p->getNoteMoyenne(),
            'totalAvis' => $p->getTotalAvis(),
            'estValide' => $p->estValide(),
            'etablissement' => $centre ? [
                'id' => $centre->getId(),
                'nom' => $centre->getNom(),
                'type' => $centre->getType(),
                'ville' => $centre->getVille(),
                'logoUrl' => $centre->getLogoUrl(),
                'imageUrl' => $centre->getImageUrl(),
            ] : null,
        ];

        if ($detail) {
            $payload['distribution'] = $this->avis->getNoteDistribution($p);
        }

        return $payload;
    }
}
