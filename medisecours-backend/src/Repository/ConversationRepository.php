<?php

namespace App\Repository;

use App\Entity\Conversation;
use App\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

class ConversationRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Conversation::class);
    }

    public static function pairKey(User $first, User $second): string
    {
        $ids = [(string) $first->getId(), (string) $second->getId()];
        sort($ids, SORT_STRING);

        return implode(':', $ids);
    }

    public function acquirePairLock(string $pairKey): void
    {
        $this->getEntityManager()->getConnection()->executeQuery(
            'SELECT pg_advisory_lock(hashtext(:pair_key))',
            ['pair_key' => $pairKey],
        );
    }

    public function releasePairLock(string $pairKey): void
    {
        $this->getEntityManager()->getConnection()->executeQuery(
            'SELECT pg_advisory_unlock(hashtext(:pair_key))',
            ['pair_key' => $pairKey],
        );
    }

    public function findExactParticipants(User $first, User $second): ?Conversation
    {
        return $this->createQueryBuilder('c')
            ->innerJoin('c.participants', 'participant')
            ->andWhere('participant IN (:participants)')
            ->andWhere('SIZE(c.participants) = 2')
            ->setParameter('participants', [$first, $second])
            ->groupBy('c.id')
            ->having('COUNT(DISTINCT participant.id) = 2')
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();
    }
}
