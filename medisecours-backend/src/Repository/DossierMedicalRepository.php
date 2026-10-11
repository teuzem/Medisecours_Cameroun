<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\CentreDeSante;
use App\Entity\DossierMedical;
use App\Entity\Patient;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<DossierMedical>
 */
class DossierMedicalRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, DossierMedical::class);
    }

    public function findOneByCentrePatient(CentreDeSante $centre, Patient $patient): ?DossierMedical
    {
        return $this->findOneBy(['centre' => $centre, 'patient' => $patient]);
    }

    /**
     * Dossiers ouverts d'un établissement, recherche par nom / email / téléphone
     * du patient ou numéro de dossier.
     *
     * @return array<int, array{dossier: DossierMedical, patient: Patient}>
     */
    public function searchByCentre(CentreDeSante $centre, ?string $query, int $limit = 20): array
    {
        $qb = $this->createQueryBuilder('d')
            ->leftJoin('d.patient', 'p')
            ->addSelect('p')
            ->where('d.centre = :centre')
            ->setParameter('centre', $centre)
            ->orderBy('d.createdAt', 'DESC')
            ->setMaxResults($limit);

        if ($query !== null && trim($query) !== '') {
            $qb->andWhere('d.numero LIKE :q OR p.nom LIKE :q OR p.prenom LIKE :q OR p.email LIKE :q OR p.telephone LIKE :q')
                ->setParameter('q', '%'.trim($query).'%');
        }

        return array_map(
            static fn (array $row): array => ['dossier' => $row[0], 'patient' => $row[1]],
            $qb->getQuery()->getResult()
        );
    }
}
