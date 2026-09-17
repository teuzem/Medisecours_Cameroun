<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\EtablissementEquipe;
use App\Entity\CentreDeSante;
use App\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<EtablissementEquipe>
 */
class EtablissementEquipeRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, EtablissementEquipe::class);
    }

    /**
     * Membres (tous statuts) d'un établissement.
     *
     * @return EtablissementEquipe[]
     */
    public function findByCentreOrdered(int $centreId): array
    {
        return $this->createQueryBuilder('e')
            ->where('e.etablissement = :centre')
            ->setParameter('centre', $centreId)
            ->orderBy('e.createdAt', 'DESC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Membres ACTIF d'un établissement.
     *
     * @return EtablissementEquipe[]
     */
    public function findActiveByCentre(int $centreId): array
    {
        return $this->createQueryBuilder('e')
            ->where('e.etablissement = :centre')
            ->setParameter('centre', $centreId)
            ->andWhere('e.statut = :statut')
            ->setParameter('statut', 'ACTIF')
            ->getQuery()
            ->getResult();
    }

    /**
     * L'utilisateur a-t-il un rôle managérial actif sur l'établissement ?
     * (ou est-il lui-même administrateur de plateforme — vérifié par l'appelant)
     */
    public function canManage(User $user, ?CentreDeSante $centre): bool
    {
        if (!$centre) {
            return false;
        }

        $count = (int) $this->createQueryBuilder('e')
            ->select('COUNT(e.id)')
            ->where('e.etablissement = :centre')
            ->setParameter('centre', $centre->getId())
            ->andWhere('e.user = :user')
            ->setParameter('user', $user->getId())
            ->andWhere('e.statut = :statut')
            ->setParameter('statut', 'ACTIF')
            ->andWhere('e.role IN (:roles)')
            ->setParameter('roles', ['DIRECTEUR', 'GESTIONNAIRE'])
            ->getQuery()
            ->getSingleScalarResult();

        return $count > 0;
    }

    /**
     * Établissement "dirigé" de l'utilisateur (rôle managérial actif) —
     * le premier s'il en a plusieurs.
     */
    public function findManagedCentre(User $user): ?CentreDeSante
    {
        $member = $this->createQueryBuilder('e')
            ->where('e.user = :user')
            ->setParameter('user', $user->getId())
            ->andWhere('e.statut = :statut')
            ->setParameter('statut', 'ACTIF')
            ->andWhere('e.role IN (:roles)')
            ->setParameter('roles', ['DIRECTEUR', 'GESTIONNAIRE'])
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();

        return $member?->getEtablissement();
    }

    /**
     * Membre actif (quel que soit le rôle) pour l'utilisateur sur un établissement.
     */
    public function findActiveMember(User $user, CentreDeSante $centre): ?EtablissementEquipe
    {
        return $this->createQueryBuilder('e')
            ->where('e.user = :user')
            ->setParameter('user', $user->getId())
            ->andWhere('e.etablissement = :centre')
            ->setParameter('centre', $centre->getId())
            ->andWhere('e.statut = :statut')
            ->setParameter('statut', 'ACTIF')
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();
    }
}