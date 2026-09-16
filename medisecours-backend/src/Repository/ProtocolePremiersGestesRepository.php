<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\ProtocolePremiersGestes;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\ORM\QueryBuilder;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<ProtocolePremiersGestes>
 */
class ProtocolePremiersGestesRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, ProtocolePremiersGestes::class);
    }

    /**
     * Toutes les fiches non retirees qui possedent des etapes sont consultables,
     * y compris leurs variantes et leur version la plus recente.
     *
     * @return ProtocolePremiersGestes[]
     */
    public function findAllPublic(?\DateTimeImmutable $now = null): array
    {
        $eligible = $this->createPublicQueryBuilder()->getQuery()->getResult();

        return $this->keepLatestVersionPerSlug($eligible);
    }

    public function findPublicOneById(int $id, ?\DateTimeImmutable $now = null): ?ProtocolePremiersGestes
    {
        $eligible = $this->createPublicQueryBuilder()
            ->andWhere('p.id = :id')
            ->setParameter('id', $id)
            ->getQuery()
            ->getResult();

        $latest = $this->keepLatestVersionPerSlug($eligible);

        return $latest[0] ?? null;
    }

    public function findPublicOneBySlug(string $slug, ?\DateTimeImmutable $now = null): ?ProtocolePremiersGestes
    {
        $eligible = $this->createPublicQueryBuilder()
            ->andWhere('p.slug = :slug')
            ->setParameter('slug', $slug)
            ->getQuery()
            ->getResult();

        $latest = $this->keepLatestVersionPerSlug($eligible);

        return $latest[0] ?? null;
    }

    /**
     * @param string[] $slugs
     * @return ProtocolePremiersGestes[]
     */
    public function findPublicBySlugs(array $slugs, ?\DateTimeImmutable $now = null): array
    {
        if ($slugs === []) {
            return [];
        }

        $eligible = $this->createPublicQueryBuilder()
            ->andWhere('p.slug IN (:slugs)')
            ->setParameter('slugs', array_values(array_unique($slugs)))
            ->getQuery()
            ->getResult();

        return $this->keepLatestVersionPerSlug($eligible);
    }

    /**
     * @return ProtocolePremiersGestes[]
     */
    public function findVersionsBySlug(string $slug): array
    {
        return $this->createQueryBuilder('p')
            ->andWhere('p.slug = :slug')
            ->setParameter('slug', $slug)
            ->orderBy('p.version', 'DESC')
            ->getQuery()
            ->getResult();
    }

    /**
     * @param ProtocolePremiersGestes[] $protocols
     * @return ProtocolePremiersGestes[]
     */
    public function keepLatestVersionPerSlug(array $protocols): array
    {
        $latestBySlug = [];
        foreach ($protocols as $protocol) {
            $slug = $protocol->getSlug();
            if (!isset($latestBySlug[$slug]) || ProtocolePremiersGestes::compareVersions($protocol->getVersion(), $latestBySlug[$slug]->getVersion()) > 0) {
                $latestBySlug[$slug] = $protocol;
            }
        }

        $result = array_values($latestBySlug);
        usort($result, static function (ProtocolePremiersGestes $a, ProtocolePremiersGestes $b): int {
            $rank = ['CRITIQUE' => 4, 'ELEVE' => 3, 'MOYEN' => 2, 'FAIBLE' => 1];
            $comparison = ($rank[$b->getNiveauUrgence()] ?? 0) <=> ($rank[$a->getNiveauUrgence()] ?? 0);

            return $comparison !== 0 ? $comparison : strcmp($a->getTitre(), $b->getTitre());
        });

        return $result;
    }

    private function createPublicQueryBuilder(): QueryBuilder
    {
        return $this->createQueryBuilder('p')
            ->innerJoin('p.etapes', 'e')
            ->andWhere('p.statut != :retired')
            ->setParameter('retired', ProtocolePremiersGestes::STATUT_RETIRE)
            ->distinct();
    }
}
