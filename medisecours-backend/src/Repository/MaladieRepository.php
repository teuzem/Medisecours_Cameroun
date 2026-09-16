<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Maladie;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\ORM\Tools\Pagination\Paginator;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<Maladie>
 */
class MaladieRepository extends ServiceEntityRepository
{
    private const STOP_WORDS = [
        'a', 'ai', 'au', 'aux', 'avec', 'ce', 'ces', 'dans', 'de', 'des', 'du', 'elle', 'en', 'et', 'eux',
        'il', 'je', 'la', 'le', 'les', 'leur', 'lui', 'ma', 'mais', 'me', 'mes', 'moi', 'mon', 'ne', 'nos',
        'notre', 'nous', 'on', 'ou', 'par', 'pas', 'pour', 'qu', 'que', 'qui', 'sa', 'se', 'ses', 'son',
        'sur', 'ta', 'te', 'tes', 'toi', 'ton', 'tu', 'un', 'une', 'vos', 'votre', 'vous', 'mal', 'maux',
        'douleur', 'douleurs', 'symptome', 'symptomes', 'signe', 'signes', 'avoir', 'jai', 'j', 'l', 'd'
    ];

    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Maladie::class);
    }

    /**
     * @return Maladie[]
     */
    public function findAllForTriage(): array
    {
        return $this->createQueryBuilder('m')
            ->leftJoin('m.symptomesStructures', 'ms')->addSelect('ms')
            ->leftJoin('ms.symptome', 's')->addSelect('s')
            ->leftJoin('m.categorie', 'c')->addSelect('c')
            ->leftJoin('m.premiersSoins', 'ps')->addSelect('ps')
            ->getQuery()
            ->getResult();
    }

    /**
     * @return Maladie[]
     */
    public function findAllForPatientTriage(): array
    {
        $qb = $this->createQueryBuilder('m')
            ->leftJoin('m.symptomesStructures', 'ms')->addSelect('ms')
            ->leftJoin('ms.symptome', 's')->addSelect('s')
            ->leftJoin('m.categorie', 'c')->addSelect('c')
            ->leftJoin('m.premiersSoins', 'ps')->addSelect('ps')
            ->andWhere('m.patientVisible = true')
            ->orderBy('m.patientPriority', 'ASC')
            ->addOrderBy('m.id', 'ASC')
            ->setMaxResults(200);

        return $qb->getQuery()->getResult();
    }

    /**
     * @return array{items: Maladie[], total: int}
     */
    public function findPatientCatalogPage(
        int $page,
        int $itemsPerPage,
        ?int $categoryId
    ): array {
        $qb = $this->createQueryBuilder('m')
            ->leftJoin('m.categorie', 'c')->addSelect('c')
            ->andWhere('m.patientVisible = true')
            ->orderBy('m.patientPriority', 'ASC')
            ->addOrderBy('m.id', 'ASC')
            ->setFirstResult(($page - 1) * $itemsPerPage)
            ->setMaxResults($itemsPerPage);

        if ($categoryId !== null) {
            $qb->andWhere('c.id = :categoryId')->setParameter('categoryId', $categoryId);
        }
        $paginator = new Paginator($qb->getQuery());

        return [
            'items' => iterator_to_array($paginator->getIterator()),
            'total' => count($paginator),
        ];
    }

    public function findPatientCatalogOne(int $id): ?Maladie
    {
        $qb = $this->createQueryBuilder('m')
            ->leftJoin('m.categorie', 'c')->addSelect('c')
            ->andWhere('m.id = :id')
            ->andWhere('m.patientVisible = true')
            ->setParameter('id', $id);

        return $qb->getQuery()->getOneOrNullResult();
    }

    /**
     * Recherche pondérée orientée symptômes.
     *
     * PostgreSQL sert à récupérer les candidats pertinents, puis PHP recalcule un score métier :
     * - correspondances dans symptomes : poids fort ;
     * - correspondances dans le nom : poids moyen ;
     * - description/causes : poids faible ;
     * - plusieurs symptômes saisis doivent matcher pour éviter les résultats incohérents.
     *
     * @return Maladie[]
     */
    public function searchFullText(
        string $query,
        int $limit = 30,
        int $offset = 0,
        ?int $categorieId = null,
        ?bool $urgence = null,
        ?bool $contagieux = null,
        bool $patientOnly = false
    ): array {
        $cleanQuery = $this->cleanQuery($query);
        if ($cleanQuery === '') {
            return [];
        }

        $tokens = $this->extractSearchTokens($cleanQuery);
        if (empty($tokens)) {
            return [];
        }

        $conn = $this->getEntityManager()->getConnection();
        $candidateLimit = max(100, min(300, $offset + ($limit * 8)));

        $where = ["(
            setweight(to_tsvector('french', COALESCE(m.nom,         '')), 'A') ||
            setweight(to_tsvector('french', COALESCE(m.symptomes,   '')), 'B') ||
            setweight(to_tsvector('french', COALESCE(m.description, '')), 'C') ||
            setweight(to_tsvector('french', COALESCE(m.causes,      '')), 'D')
        ) @@ plainto_tsquery('french', :query)"];
        $params = ['query' => $cleanQuery, 'candidateLimit' => $candidateLimit];

        if ($categorieId !== null) {
            $where[] = 'm.categorie_id = :categorieId';
            $params['categorieId'] = $categorieId;
        }
        if ($urgence !== null) {
            $where[] = 'm.urgence = :urgence';
            $params['urgence'] = $urgence;
        }
        if ($contagieux !== null) {
            $where[] = 'm.contagieux = :contagieux';
            $params['contagieux'] = $contagieux;
        }
        if ($patientOnly) {
            $where[] = 'm.patient_visible = TRUE';
        }
        $sql = sprintf(<<<SQL
            SELECT m.id,
                   ts_rank_cd(
                       setweight(to_tsvector('french', COALESCE(m.nom,         '')), 'A') ||
                       setweight(to_tsvector('french', COALESCE(m.symptomes,   '')), 'B') ||
                       setweight(to_tsvector('french', COALESCE(m.description, '')), 'C') ||
                       setweight(to_tsvector('french', COALESCE(m.causes,      '')), 'D'),
                       plainto_tsquery('french', :query)
                   ) AS rank
            FROM maladie m
            WHERE %s
            ORDER BY rank DESC
            LIMIT :candidateLimit
        SQL, implode(' AND ', $where));

        $rows = $conn->executeQuery($sql, $params)->fetchAllAssociative();

        if (empty($rows)) {
            return $this->searchFallback(
                $cleanQuery,
                $tokens,
                $limit,
                $offset,
                $categorieId,
                $urgence,
                $contagieux,
                $patientOnly
            );
        }

        $ids = array_map('intval', array_column($rows, 'id'));
        $rankById = array_column($rows, 'rank', 'id');

        $entityQb = $this->createQueryBuilder('m')
            ->where('m.id IN (:ids)')
            ->setParameter('ids', $ids);
        if ($patientOnly) {
            $entityQb->andWhere('m.patientVisible = true');
        }
        $entities = $entityQb->getQuery()->getResult();

        return $this->scoreAndSlice($entities, $tokens, $rankById, $limit, $offset);
    }

    /**
     * @param string[] $tokens
     * @return Maladie[]
     */
    private function searchFallback(
        string $query,
        array $tokens,
        int $limit,
        int $offset,
        ?int $categorieId,
        ?bool $urgence,
        ?bool $contagieux,
        bool $patientOnly
    ): array {
        $qb = $this->createQueryBuilder('m');
        $or = $qb->expr()->orX();

        foreach ($tokens as $i => $token) {
            $param = 'token' . $i;
            $or->add("LOWER(m.nom) LIKE :$param");
            $or->add("LOWER(m.symptomes) LIKE :$param");
            $or->add("LOWER(m.description) LIKE :$param");
            $or->add("LOWER(m.causes) LIKE :$param");
            $qb->setParameter($param, '%' . mb_strtolower($token) . '%');
        }

        if ($or->count() === 0) {
            $or->add('LOWER(m.nom) LIKE :query');
            $qb->setParameter('query', '%' . mb_strtolower($query) . '%');
        }

        $qb->where($or);
        if ($categorieId !== null) {
            $qb->andWhere('m.categorie = :categorieId')->setParameter('categorieId', $categorieId);
        }
        if ($urgence !== null) {
            $qb->andWhere('m.urgence = :urgence')->setParameter('urgence', $urgence);
        }
        if ($contagieux !== null) {
            $qb->andWhere('m.contagieux = :contagieux')->setParameter('contagieux', $contagieux);
        }
        if ($patientOnly) {
            $qb->andWhere('m.patientVisible = true');
        }
        $entities = $qb->setMaxResults(300)->getQuery()->getResult();

        return $this->scoreAndSlice($entities, $tokens, [], $limit, $offset);
    }

    /**
     * @param Maladie[] $entities
     * @param string[] $tokens
     * @param array<int|string, numeric-string|float|int> $rankById
     * @return Maladie[]
     */
    private function scoreAndSlice(array $entities, array $tokens, array $rankById, int $limit, int $offset): array
    {
        $scored = [];
        $minRatio = count($tokens) >= 3 ? 0.5 : 0.34;

        foreach ($entities as $entity) {
            $symptoms = $this->normalizeText($entity->getSymptomes() ?? '');
            $name = $this->normalizeText($entity->getNom() ?? '');
            $description = $this->normalizeText($entity->getDescription() ?? '');
            $causes = $this->normalizeText($entity->getCauses() ?? '');

            $matched = [];
            $score = (float) ($rankById[$entity->getId()] ?? 0.0);

            foreach ($tokens as $token) {
                $tokenScore = 0.0;
                if (str_contains($symptoms, $token)) {
                    $tokenScore += 6.0;
                }
                if (str_contains($name, $token)) {
                    $tokenScore += 3.0;
                }
                if (str_contains($description, $token)) {
                    $tokenScore += 1.25;
                }
                if (str_contains($causes, $token)) {
                    $tokenScore += 0.75;
                }

                if ($tokenScore > 0) {
                    $matched[$token] = true;
                    $score += $tokenScore;
                }
            }

            $matchRatio = count($matched) / max(1, count($tokens));
            if ($matchRatio < $minRatio) {
                continue;
            }

            if ($matchRatio >= 0.75) {
                $score += 8.0;
            }
            if ($matchRatio >= 1.0) {
                $score += 10.0;
            }
            if ($entity->isUrgence()) {
                $score += 0.25;
            }

            $scored[] = ['entity' => $entity, 'score' => $score, 'matchRatio' => $matchRatio];
        }

        usort($scored, static function (array $a, array $b): int {
            $scoreCompare = $b['score'] <=> $a['score'];
            if ($scoreCompare !== 0) {
                return $scoreCompare;
            }
            return $b['matchRatio'] <=> $a['matchRatio'];
        });

        return array_map(
            static fn (array $row): Maladie => $row['entity'],
            array_slice($scored, $offset, $limit)
        );
    }

    private function cleanQuery(string $query): string
    {
        $cleanQuery = preg_replace('/[^\p{L}\p{N}\s]/u', ' ', $query) ?? '';
        return trim(preg_replace('/\s+/', ' ', $cleanQuery) ?? '');
    }

    /**
     * @return string[]
     */
    private function extractSearchTokens(string $query): array
    {
        $normalized = $this->normalizeText($query);
        $parts = preg_split('/\s+/', $normalized, -1, PREG_SPLIT_NO_EMPTY) ?: [];

        $tokens = [];
        foreach ($parts as $part) {
            if (mb_strlen($part) < 3 || in_array($part, self::STOP_WORDS, true)) {
                continue;
            }
            $tokens[] = $part;
        }

        return array_values(array_unique($tokens));
    }

    private function normalizeText(string $text): string
    {
        $text = mb_strtolower($text);
        $converted = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $text);
        if (is_string($converted)) {
            $text = $converted;
        }
        $text = preg_replace('/[^a-z0-9\s]/', ' ', $text) ?? '';
        return trim(preg_replace('/\s+/', ' ', $text) ?? '');
    }

    public function save(Maladie $entity, bool $flush = false): void
    {
        $this->getEntityManager()->persist($entity);
        if ($flush) {
            $this->getEntityManager()->flush();
        }
    }

    public function remove(Maladie $entity, bool $flush = false): void
    {
        $this->getEntityManager()->remove($entity);
        if ($flush) {
            $this->getEntityManager()->flush();
        }
    }
}
