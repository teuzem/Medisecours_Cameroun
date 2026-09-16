<?php

declare(strict_types=1);

namespace App\State;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\Metadata\Post;
use ApiPlatform\Metadata\Patch;
use ApiPlatform\State\ProcessorInterface;
use App\Entity\Consultation;
use App\Entity\Medecin;
use App\Entity\Prescription;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;

class PrescriptionProcessor implements ProcessorInterface
{
    public function __construct(
        #[Autowire(service: 'api_platform.doctrine.orm.state.persist_processor')]
        private readonly ProcessorInterface $persistProcessor,
        private readonly Security $security,
    ) {
    }

    public function process(mixed $data, Operation $operation, array $uriVariables = [], array $context = []): mixed
    {
        if (!$data instanceof Prescription) {
            return $this->persistProcessor->process($data, $operation, $uriVariables, $context);
        }

        $user = $this->security->getUser();
        if (!$user instanceof Medecin) {
            throw new AccessDeniedHttpException('Seul un médecin peut prescrire.');
        }

        $consultation = $data->getConsultation();
        if (!$consultation) {
            throw new BadRequestHttpException('La consultation est obligatoire.');
        }

        if ($consultation->getMedecin() !== $user) {
            throw new AccessDeniedHttpException('Vous ne pouvez prescrire que pour une consultation dont vous êtes responsable.');
        }

        if ($operation instanceof Post) {
            if ($consultation->getStatut() !== Consultation::STATUT_EN_COURS) {
                throw new BadRequestHttpException(
                    'Une ordonnance ne peut être créée que depuis une consultation en cours.'
                );
            }
            $data->setMedecin($user);
            $data->setPatient($consultation->getPatient());
            $data->setStatut(Prescription::STATUT_BROUILLON);
            if (!$data->getPatient()) {
                throw new BadRequestHttpException('La consultation doit avoir un patient.');
            }
        } else {
            if ($data->getMedecin() !== $user) {
                throw new AccessDeniedHttpException('Le prescripteur ne peut pas être modifié.');
            }
            if ($data->getPatient() !== $consultation->getPatient()) {
                throw new AccessDeniedHttpException('Le patient associé à une prescription ne peut pas être modifié.');
            }
            if (!$data->isEditable()) {
                throw new BadRequestHttpException('Seules les ordonnances en brouillon peuvent être modifiées.');
            }
        }

        return $this->persistProcessor->process($data, $operation, $uriVariables, $context);
    }
}
