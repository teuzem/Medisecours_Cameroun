<?php

namespace App\Repository;

use App\Entity\Message;
use App\Entity\Conversation;
use App\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<Message>
 */
class MessageRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Message::class);
    }

    /**
     * @return Message[]
     */
    public function findUnreadReceivedBy(User $user): array
    {
        return $this->createQueryBuilder('m')
            ->innerJoin('m.conversation', 'c')
            ->innerJoin('c.participants', 'participant')
            ->andWhere('participant = :user')
            ->andWhere('m.expediteur != :user')
            ->andWhere('m.statut != :readStatus')
            ->setParameter('user', $user)
            ->setParameter('readStatus', Message::STATUT_LU)
            ->getQuery()
            ->getResult();
    }

    /**
     * @return Message[]
     */
    public function findUnreadReceivedByInConversation(User $user, Conversation $conversation): array
    {
        return $this->createQueryBuilder('m')
            ->andWhere('m.conversation = :conversation')
            ->andWhere('m.expediteur != :user')
            ->andWhere('m.statut != :readStatus')
            ->setParameter('conversation', $conversation)
            ->setParameter('user', $user)
            ->setParameter('readStatus', Message::STATUT_LU)
            ->orderBy('m.createdAt', 'ASC')
            ->getQuery()
            ->getResult();
    }

//    /**
//     * @return Message[] Returns an array of Message objects
//     */
//    public function findByExampleField($value): array
//    {
//        return $this->createQueryBuilder('m')
//            ->andWhere('m.exampleField = :val')
//            ->setParameter('val', $value)
//            ->orderBy('m.id', 'ASC')
//            ->setMaxResults(10)
//            ->getQuery()
//            ->getResult()
//        ;
//    }

//    public function findOneBySomeField($value): ?Message
//    {
//        return $this->createQueryBuilder('m')
//            ->andWhere('m.exampleField = :val')
//            ->setParameter('val', $value)
//            ->getQuery()
//            ->getOneOrNullResult()
//        ;
//    }
}
