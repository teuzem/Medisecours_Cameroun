<?php

declare(strict_types=1);

namespace App\Controller\Api;

use App\Entity\CentreDeSante;
use App\Entity\Medecin;
use App\Entity\SignatureNumerique;
use App\Entity\User;
use App\Repository\AffiliationMedecinRepository;
use App\Repository\CentreDeSanteRepository;
use App\Repository\EtablissementEquipeRepository;
use App\Repository\SignatureNumeriqueRepository;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\RequestStack;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

/**
 * Sceaux officiels des documents administratifs.
 *
 * Regroupe, pour un établissement (ou pour tous ceux du médecin connecté) :
 * logo, cachet officiel (data URI détouré), nom/grade du dirigeant et la
 * signature numérique de ce dirigeant — à injecter dans les ordonnances,
 * rapports de consultation et tout document généré.
 *
 * - GET /api/documents/seaux?centre={id} : sceaux d'un établissement.
 * - GET /api/documents/seaux             : sceaux de toutes les affiliations
 *   acceptées du médecin (ou de l'établissement géré par le manager).
 */
#[Route('/api/documents', name: 'api_documents_seaux_')]
#[IsGranted('ROLE_USER')]
class DocumentSealsController extends AbstractController
{
    public function __construct(
        private readonly CentreDeSanteRepository $centreRepository,
        private readonly AffiliationMedecinRepository $affiliationRepository,
        private readonly EtablissementEquipeRepository $equipeRepository,
        private readonly SignatureNumeriqueRepository $signatureRepository,
        private readonly RequestStack $requestStack,
    ) {
    }

    #[Route('/seaux', name: 'show', methods: ['GET'])]
    public function show(): JsonResponse
    {
        $user = $this->requireUser();
        $centreId = $this->requestStack->getCurrentRequest()?->query->get('centre');

        if ($centreId) {
            $centre = $this->centreRepository->find((int) $centreId);
            if (!$centre instanceof CentreDeSante) {
                throw new NotFoundHttpException('Établissement introuvable.');
            }

            return new JsonResponse(['seaux' => [$this->serializeSeal($centre)]]);
        }

        return new JsonResponse(['seaux' => $this->collectUserSeals($user)]);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function collectUserSeals(User $user): array
    {
        $centres = [];

        if ($user instanceof Medecin) {
            foreach ($this->affiliationRepository->findByMedecin($user) as $affiliation) {
                if ($affiliation->getStatut() === 'ACCEPTEE' && $affiliation->getEtablissement()) {
                    $centres[] = $affiliation->getEtablissement();
                }
            }
        }

        if ($centres === []) {
            $managed = $this->equipeRepository->findManagedCentre($user);
            if ($managed instanceof CentreDeSante) {
                $centres[] = $managed;
            }
        }

        $out = [];
        foreach ($centres as $centre) {
            $out[] = $this->serializeSeal($centre);
        }

        return $out;
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeSeal(CentreDeSante $centre): array
    {
        $dirigeant = $centre->getDirigeant();
        $signature = $dirigeant ? $this->signatureRepository->findOneActiveByUser($dirigeant) : null;

        return [
            'centreId' => $centre->getId(),
            'nom' => $centre->getNom(),
            'type' => $centre->getType(),
            'ville' => $centre->getVille(),
            'telephone' => $centre->getTelephone(),
            'logoUrl' => $centre->getLogoUrl(),
            'cachetUrl' => $centre->getCachetUrl(),
            'dirigeantNom' => $centre->getDirigeantNom(),
            'dirigeantGrade' => $centre->getDirigeantGrade(),
            'dirigeantSignature' => $signature instanceof SignatureNumerique ? [
                'imageData' => $signature->getImageData(),
                'hashShort' => substr($signature->getHashSha256(), 0, 12),
                'signedAt' => $signature->getSignedAt()->format(\DateTimeInterface::RFC3339),
            ] : null,
        ];
    }

    private function requireUser(): User
    {
        $user = $this->getUser();
        if (!$user instanceof User) {
            throw new AccessDeniedHttpException('Authentification requise.');
        }

        return $user;
    }
}
