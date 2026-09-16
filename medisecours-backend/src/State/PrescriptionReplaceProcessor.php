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

class PrescriptionReplaceProcessor implements ProcessorInterface
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
            throw new AccessDeniedHttpException('Seul un médecin peut remplacer une ordonnance.');
        }

        /** @var Prescription|null $original */
        $original = isset($uriVariables['id'])
            ? $this->em->find(Prescription::class, $uriVariables['id'])
            : $data;
        if (!$original) {
            throw new BadRequestHttpException('Ordonnance introuvable.');
        }

        if ($original->getMedecin() !== $user) {
            throw new AccessDeniedHttpException('Vous ne pouvez remplacer que vos propres ordonnances.');
        }

        $remplaçables = [Prescription::STATUT_SIGNEE, Prescription::STATUT_TRANSMISE, Prescription::STATUT_ANNULEE];
        if (!in_array($original->getStatut(), $remplaçables, true)) {
            throw new BadRequestHttpException(
                'Seules les ordonnances signées, transmises ou annulées peuvent être remplacées.'
            );
        }

        $newPrescription = new Prescription();
        $newPrescription->setConsultation($original->getConsultation());
        $newPrescription->setMedecin($original->getMedecin());
        $newPrescription->setPatient($original->getPatient());
        $newPrescription->setDiagnostic($original->getDiagnostic());
        
        foreach ($original->getMedicaments() as $item) {
            $newItem = new \App\Entity\PrescriptionItem();
            $newItem->setNom($item->getNom());
            $newItem->setPosologie($item->getPosologie());
            $newItem->setDuree($item->getDuree());
            $newItem->setForme($item->getForme());
            $newItem->setDosage($item->getDosage());
            $newItem->setUnite($item->getUnite());
            $newItem->setVoieAdministration($item->getVoieAdministration());
            $newItem->setFrequence($item->getFrequence());
            $newItem->setMomentPrise($item->getMomentPrise());
            $newItem->setDureeJours($item->getDureeJours());
            $newItem->setQuantite($item->getQuantite());
            $newItem->setInstructions($item->getInstructions());
            $newItem->setSiBesoin($item->isSiBesoin());
            $newPrescription->addMedicament($newItem);
            $this->em->persist($newItem);
        }

        $newPrescription->setRecommandations($original->getRecommandations());
        $newPrescription->setVersion($original->getVersion() + 1);

        $this->em->persist($newPrescription);

        $original->setStatut(Prescription::STATUT_REMPLACEE);
        $original->setSupersededBy($newPrescription);

        $this->em->flush();

        return $newPrescription;
    }
}
