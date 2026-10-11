<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\SignatureNumerique;
use App\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<SignatureNumerique>
 */
class SignatureNumeriqueRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, SignatureNumerique::class);
    }

    public function findOneActiveByUser(User $user): ?SignatureNumerique
    {
        return $this->findOneBy(['utilisateur' => $user, 'estActive' => true]);
    }

    public function deactivateAllForUser(User $user): void
    {
        $this->createQueryBuilder('s')
            ->update()
            ->set('s.estActive', false)
            ->where('s.utilisateur = :user')
            ->andWhere('s.estActive = true')
            ->setParameter('user', $user)
            ->getQuery()
            ->execute();
    }
}
