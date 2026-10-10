<?php

declare(strict_types=1);

namespace App\State;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProviderInterface;
use App\Entity\EtablissementPreference;
use App\Repository\AffiliationMedecinRepository;
use App\Repository\CentreDeSanteRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Fiche détaillée d'un établissement.
 *
 * GET /api/centre_de_santes/{id}/fiche
 * Le provider enrichit le CentreDeSante de :
 *  - la liste des médecins affiliés (statut ACCEPTEE uniquement),
 *    masquée si la structure a désactivé son profil public,
 *  - les agrégats déja persistés (noteMoyenne / totalAvis) exposés via les groupes.
 */
class CentreDeSanteFicheProvider implements ProviderInterface
{
    public function __construct(
        private CentreDeSanteRepository $repository,
        private AffiliationMedecinRepository $affiliationRepository,
        private EntityManagerInterface $em
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
        if ($this->isPublicProfileEnabled($centre->getId())) {
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
        }

        $centre->setMedecins($medecins);

        return $centre;
    }

    /**
     * Le profil public est visible par défaut ; seule une préférence
     * explicitement désactivée masque l'équipe de la fiche.
     */
    private function isPublicProfileEnabled(int $centreId): bool
    {
        $preference = $this->em->find(EtablissementPreference::class, $centreId);
        if (!$preference instanceof EtablissementPreference) {
            return true;
        }

        $stored = $preference->getData();

        return !isset($stored['publicProfile']) || $stored['publicProfile'] !== false;
    }
}