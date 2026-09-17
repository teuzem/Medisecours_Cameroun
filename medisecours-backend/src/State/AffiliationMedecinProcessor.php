<?php

declare(strict_types=1);

namespace App\State;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProcessorInterface;
use App\Entity\AffiliationMedecin;
use App\Entity\Medecin;
use App\Repository\AffiliationMedecinRepository;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

/**
 * Demande d'affiliation d'un médecin à un établissement.
 *
 * - Seul un médecin au profil validé peut s'affilier.
 * - La demande part en statut EN_ATTENTE, validée ensuite par un manager
 *   ou un admin (PATCH statut → ACCEPTEE / REFUSEE / SUSPENDUE).
 * - Empêche les doublons (affiliation en attente ou active sur le même centre).
 */
class AffiliationMedecinProcessor implements ProcessorInterface
{
    public function __construct(
        #[Autowire(service: 'api_platform.doctrine.orm.state.persist_processor')]
        private readonly ProcessorInterface $persistProcessor,
        private readonly Security $security,
        private readonly AffiliationMedecinRepository $repository
    ) {
    }

    public function process(mixed $data, Operation $operation, array $uriVariables = [], array $context = []): mixed
    {
        if ($data instanceof AffiliationMedecin) {
            $user = $this->security->getUser();
            if (!$user instanceof Medecin) {
                throw new AccessDeniedHttpException('Seul un médecin peut demander une affiliation.');
            }

            if (!$user->isEstValide()) {
                throw new AccessDeniedHttpException(
                    'Votre profil médecin doit être validé avant de joindre un établissement.'
                );
            }

            $etablissement = $data->getEtablissement();
            if (!$etablissement) {
                throw new BadRequestHttpException("L'établissement cible est obligatoire.");
            }

            if ($this->repository->hasPendingOrActive($etablissement->getId(), (string) $user->getId())) {
                throw new ConflictHttpException(
                    'Une affiliation est déjà en attente ou active pour cet établissement.'
                );
            }

            $data->setMedecin($user);
            $data->setCreatedBy($user);
            $data->setStatut('EN_ATTENTE');
            $data->setUpdatedAt(new \DateTimeImmutable());
        }

        return $this->persistProcessor->process($data, $operation, $uriVariables, $context);
    }
}