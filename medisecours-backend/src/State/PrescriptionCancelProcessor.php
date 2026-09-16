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

class PrescriptionCancelProcessor implements ProcessorInterface
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
            throw new AccessDeniedHttpException('Seul un médecin peut annuler une ordonnance.');
        }

        /** @var Prescription|null $prescription */
        $prescription = isset($uriVariables['id'])
            ? $this->em->find(Prescription::class, $uriVariables['id'])
            : $data;
        if (!$prescription) {
            throw new BadRequestHttpException('Ordonnance introuvable.');
        }

        if ($prescription->getMedecin() !== $user) {
            throw new AccessDeniedHttpException('Vous ne pouvez annuler que vos propres ordonnances.');
        }

        $annulables = [Prescription::STATUT_SIGNEE, Prescription::STATUT_TRANSMISE];
        if (!in_array($prescription->getStatut(), $annulables, true)) {
            throw new BadRequestHttpException('Seules les ordonnances signées ou transmises peuvent être annulées.');
        }

        $reason = null;
        if (is_array($data) && !empty($data['cancelReason'])) {
            $reason = $data['cancelReason'];
        } elseif ($data instanceof Prescription) {
            $reason = $data->getCancelReason();
        }
        if (!$reason || trim($reason) === '') {
            throw new BadRequestHttpException('Le motif d’annulation est obligatoire.');
        }

        $prescription->setStatut(Prescription::STATUT_ANNULEE);
        $prescription->setCancelReason(trim($reason));
        $this->em->flush();

        return $prescription;
    }
}
