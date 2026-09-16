<?php

declare(strict_types=1);

namespace App\State;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProcessorInterface;
use App\Entity\Medecin;
use App\Entity\Prescription;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;

class PrescriptionSignProcessor implements ProcessorInterface
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly Security $security,
    ) {
    }

    public function process(mixed $data, Operation $operation, array $uriVariables = [], array $context = []): mixed
    {
        $user = $this->security->getUser();
        if (!$user instanceof Medecin) {
            throw new AccessDeniedHttpException('Seul un médecin peut signer une ordonnance.');
        }

        /** @var Prescription|null $prescription */
        $prescription = isset($uriVariables['id'])
            ? $this->em->find(Prescription::class, $uriVariables['id'])
            : $data;

        if (!$prescription) {
            throw new BadRequestHttpException('Ordonnance introuvable.');
        }

        if ($prescription->getMedecin() !== $user) {
            throw new AccessDeniedHttpException('Vous ne pouvez signer que vos propres ordonnances.');
        }

        if ($prescription->getStatut() !== Prescription::STATUT_BROUILLON) {
            throw new BadRequestHttpException('Seules les ordonnances en brouillon peuvent être signées.');
        }

        $medicaments = $prescription->getMedicaments();
        if ($medicaments->isEmpty()) {
            throw new BadRequestHttpException('Au moins un médicament est requis pour signer l\'ordonnance.');
        }

        foreach ($medicaments as $med) {
            if (empty($med->getNom()) || empty($med->getPosologie())) {
                throw new BadRequestHttpException('Chaque médicament doit avoir un nom et une posologie.');
            }
        }

        $prescription->setStatut(Prescription::STATUT_SIGNEE);
        $this->em->flush();

        return $prescription;
    }
}
