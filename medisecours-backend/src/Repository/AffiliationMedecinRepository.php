<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\AffiliationMedecin;
use App\Entity\Medecin;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<AffiliationMedecin>
 */
class AffiliationMedecinRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, AffiliationMedecin::class);
    }

    /**
     * Affiliations validées (ACCEPTEE) d'un établissement —
     * utilisées pour la fiche publique.
     *
     * @return AffiliationMedecin[]
     */
    public function findValidatedByEtablissement(int $etablissementId): array
    {
        return $this->createQueryBuilder('a')
            ->where('a.etablissement = :etablissement')
            ->setParameter('etablissement', $etablissementId)
            ->andWhere('a.statut = :statut')
            ->setParameter('statut', 'ACCEPTEE')
            ->orderBy('a.createdAt', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Affiliations actives d'un médecin (tous statuts).
     *
     * @return AffiliationMedecin[]
     */
    public function findByMedecin(Medecin $medecin): array
    {
        return $this->createQueryBuilder('a')
            ->where('a.medecin = :medecin')
            ->setParameter('medecin', $medecin)
            ->orderBy('a.createdAt', 'DESC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Vérifie qu'il n'existe pas déjà d'affiliation EN_ATTENTE ou ACCEPTEE
     * pour le même couple (médecin, établissement).
     */
    public function hasPendingOrActive(int $etablissementId, string $medecinId): bool
    {
        $count = (int) $this->createQueryBuilder('a')
            ->select('COUNT(a.id)')
            ->where('a.etablissement = :etablissement')
            ->andWhere('a.medecin = :medecin')
            ->andWhere('a.statut IN (:statuts)')
            ->setParameters([
                'etablissement' => $etablissementId,
                'medecin' => $medecinId,
                'statuts' => ['EN_ATTENTE', 'ACCEPTEE'],
            ])
            ->getQuery()
            ->getSingleScalarResult();

        return $count > 0;
    }
}