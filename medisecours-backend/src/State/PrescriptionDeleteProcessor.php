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

class PrescriptionDeleteProcessor implements ProcessorInterface
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
            throw new AccessDeniedHttpException('Seul un médecin peut supprimer une ordonnance.');
        }

        /** @var Prescription|null $prescription */
        $prescription = isset($uriVariables['id'])
            ? $this->em->find(Prescription::class, $uriVariables['id'])
            : $data;
        if (!$prescription) {
            throw new BadRequestHttpException('Ordonnance introuvable.');
        }

        if ($prescription->getMedecin() !== $user) {
            throw new AccessDeniedHttpException('Vous ne pouvez supprimer que vos propres ordonnances.');
        }

        if ($prescription->getStatut() !== Prescription::STATUT_BROUILLON) {
            throw new BadRequestHttpException('Seules les ordonnances en brouillon peuvent être supprimées.');
        }

        $this->em->remove($prescription);
        $this->em->flush();

        return null;
    }
}
