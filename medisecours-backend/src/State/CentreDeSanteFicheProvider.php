<?php

declare(strict_types=1);

namespace App\State;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProviderInterface;
use App\Repository\AffiliationMedecinRepository;
use App\Repository\CentreDeSanteRepository;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Fiche détaillée d'un établissement.
 *
 * GET /api/centre_de_santes/{id}/fiche
 * Le provider enrichit le CentreDeSante de :
 *  - la liste des médecins affiliés (statut ACCEPTEE uniquement),
 *  - les agrégats déja persistés (noteMoyenne / totalAvis) exposés via les groupes.
 */
class CentreDeSanteFicheProvider implements ProviderInterface
{
    public function __construct(
        private CentreDeSanteRepository $repository,
        private AffiliationMedecinRepository $affiliationRepository
    ) {
    }

    public function provide(Operation $operation, array $uriVariables = [], array $context = []): object|array|null
    {
        $id = $uriVariables['id'] ?? null;

        $centre = $id !== null ? $this->repository->find($id) : null;
        if (!$centre) {
            throw new NotFoundHttpException('Établissement introuvable.');
        }

        $medecins = [];
        foreach ($this->affiliationRepository->findValidatedByEtablissement($centre->getId()) as $affiliation) {
            $medecin = $affiliation->getMedecin();
            if (!$medecin) {
                continue;
            }

            $medecins[] = [
                'id' => $affiliation->getId(),
                'medecinId' => (string) $medecin->getId(),
                'fonction' => $affiliation->getFonction(),
                'salle' => $affiliation->getSalle(),
                'planning' => $affiliation->getPlanning(),
                'teleconsultation' => $affiliation->isTeleconsultation(),
                'nom' => $medecin->getNom(),
                'prenom' => $medecin->getPrenom(),
                'specialite' => $medecin->getSpecialite(),
                'disponibilites' => $medecin->getDisponibilites(),
            ];
        }

        $centre->setMedecins($medecins);

        return $centre;
    }
}