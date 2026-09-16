<?php

declare(strict_types=1);

namespace App\State;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProcessorInterface;
use App\Entity\Avis;
use App\Entity\Patient;
use App\Repository\ConsultationRepository;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

/**
 * Injecte automatiquement le patient connecté comme auteur de l'avis.
 * Empêche un utilisateur de soumettre un avis au nom d'un autre.
 */
class AvisProcessor implements ProcessorInterface
{
    public function __construct(
        #[Autowire(service: 'api_platform.doctrine.orm.state.persist_processor')]
        private readonly ProcessorInterface $persistProcessor,
        private readonly Security $security,
        private readonly ConsultationRepository $consultationRepository,
    ) {
    }

    public function process(mixed $data, Operation $operation, array $uriVariables = [], array $context = []): mixed
    {
        if ($data instanceof Avis) {
            $user = $this->security->getUser();

            if (!$user instanceof Patient) {
                throw new AccessDeniedHttpException('Seul un patient peut laisser un avis.');
            }

            $medecin = $data->getMedecin();
            if (!$medecin || !$this->consultationRepository->hasCompletedConsultation($user, $medecin)) {
                throw new AccessDeniedHttpException(
                    'Un avis peut être publié après une consultation terminée avec ce médecin.'
                );
            }

            $data->setPatient($user);
            $data->setUpdatedAt(new \DateTimeImmutable());
        }

        return $this->persistProcessor->process($data, $operation, $uriVariables, $context);
    }
}
