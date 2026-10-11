<?php

declare(strict_types=1);

namespace App\State;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProcessorInterface;
use App\Entity\DossierEvenement;
use App\Entity\Medecin;
use App\Entity\OrdonnancePharmacie;
use App\Entity\Prescription;
use App\Repository\OrdonnancePharmacieRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;

class PrescriptionSendProcessor implements ProcessorInterface
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly Security $security,
        private readonly OrdonnancePharmacieRepository $ordonnancePharmacieRepository,
    ) {
    }

    public function process(mixed $data, Operation $operation, array $uriVariables = [], array $context = []): mixed
    {
        $user = $this->security->getUser();
        if (!$user instanceof Medecin) {
            throw new AccessDeniedHttpException('Seul un médecin peut transmettre une ordonnance.');
        }

        /** @var Prescription|null $prescription */
        $prescription = isset($uriVariables['id'])
            ? $this->em->find(Prescription::class, $uriVariables['id'])
            : $data;
        if (!$prescription) {
            throw new BadRequestHttpException('Ordonnance introuvable.');
        }

        if ($prescription->getMedecin() !== $user) {
            throw new AccessDeniedHttpException('Vous ne pouvez transmettre que vos propres ordonnances.');
        }

        if ($prescription->getStatut() !== Prescription::STATUT_SIGNEE) {
            throw new BadRequestHttpException('Seules les ordonnances signées peuvent être transmises au patient.');
        }

        $prescription->setStatut(Prescription::STATUT_TRANSMISE);

        // Circuit pharmacie : si la consultation est rattachée à un établissement,
        // l'ordonnance entre automatiquement dans la file de la pharmacie (RECUE).
        $etablissement = $prescription->getConsultation()?->getEtablissement();
        if ($etablissement && !$this->ordonnancePharmacieRepository->findOneByPrescription($prescription)) {
            $ordonnance = (new OrdonnancePharmacie())
                ->setPrescription($prescription)
                ->setCentre($etablissement)
                ->setPatient($prescription->getPatient())
                ->setStatut(OrdonnancePharmacie::STATUT_RECUE);
            $this->em->persist($ordonnance);

            $dossier = $prescription->getPatient()
                ? $this->em->getRepository(\App\Entity\DossierMedical::class)
                    ->findOneByCentrePatient($etablissement, $prescription->getPatient())
                : null;
            if ($dossier) {
                $this->em->persist((new DossierEvenement())
                    ->setDossier($dossier)
                    ->setPatient($prescription->getPatient())
                    ->setCentre($etablissement)
                    ->setType(DossierEvenement::TYPE_ORDONNANCE)
                    ->setTitre('Ordonnance transmise à la pharmacie')
                    ->setDetails(['prescriptionId' => $prescription->getId(), 'statut' => OrdonnancePharmacie::STATUT_RECUE])
                    ->setAuteur($user));
            }
        }

        $this->em->flush();

        return $prescription;
    }
}
