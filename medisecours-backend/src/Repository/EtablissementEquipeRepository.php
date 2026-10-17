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
    /**
     * Roles managériaux (fiche, équipe, préférences).
     */
    public const ROLES_MANAGEMENT = ['DIRECTEUR', 'GESTIONNAIRE'];

    /**
     * Roles autorisés à alimenter la galerie (photos et vidéos).
     *
     * Reprend tous les rôles opérationnels acceptés par
     * CarteController::ajouterMembre() : les soignants et les services
     * techniques produisent le contenu au quotidien. LECTURE reste
     * volontairement exclu car il ne doit donner accès à rien d'autre que la
     * consultation. Sans cette liste, un soignant recruté dans l'équipe se
     * retrouvait sur l'assistant « réclamer un établissement » au lieu de la
     * galerie qu'il alimente.
     */
    public const ROLES_GALERIE = [
        'DIRECTEUR',
        'GESTIONNAIRE',
        'MEDECIN',
        'INFIRMIER',
        'AIDE_SOIGNANT',
        'RECEPTIONNISTE',
        'PHARMACIEN',
    ];

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
            ->setParameter('roles', self::ROLES_MANAGEMENT)
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
            ->setParameter('roles', self::ROLES_MANAGEMENT)
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();

        return $member?->getEtablissement();
    }

    /**
     * Peut alimenter la galerie de cet établissement ?
     *
     * Vrai pour les rôles de ROLES_GALERIE, faux pour LECTURE.
     */
    public function canManageGalerie(User $user, ?CentreDeSante $centre): bool
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
            ->setParameter('roles', self::ROLES_GALERIE)
            ->getQuery()
            ->getSingleScalarResult();

        return $count > 0;
    }

    /**
     * Premier établissement dont l'utilisateur peut alimenter la galerie.
     */
    public function findGalerieCentre(User $user): ?CentreDeSante
    {
        $member = $this->createQueryBuilder('e')
            ->where('e.user = :user')
            ->setParameter('user', $user->getId())
            ->andWhere('e.statut = :statut')
            ->setParameter('statut', 'ACTIF')
            ->andWhere('e.role IN (:roles)')
            ->setParameter('roles', self::ROLES_GALERIE)
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