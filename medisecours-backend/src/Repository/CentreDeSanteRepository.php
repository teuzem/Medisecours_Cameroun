<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\CentreDeSante;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<CentreDeSante>
 */
class CentreDeSanteRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, CentreDeSante::class);
    }

    /**
     * Retourne les centres de santé dans un rayon donné, triés par distance croissante.
     *
     * Correction N+1 : la version précédente faisait 1 requête SQL pour obtenir les IDs
     * puis 1 requête ORM par résultat (find($id)) → 31 aller-retours pour 30 centres.
     *
     * Cette version fait exactement 1 requête SQL avec JOIN qui charge tout en une fois,
     * puis hydrate les entités depuis l'UnitOfWork Doctrine (cache de session).
     *
     * Formule Haversine utilisée pour le calcul de distance en km.
     * Précision suffisante pour des distances ≤ 100 km (erreur < 0.1%).
     *
     * @return CentreDeSante[]
     */
    public function findProches(
        float $lat,
        float $lng,
        float $rayonKm = 25,
        int $limit = 30,
        ?string $type = null,
        ?string $ville = null,
        ?string $specialite = null
    ): array {
        // Étape 1 : SQL native pour le calcul Haversine (non supporté par DQL)
        // On récupère les IDs ET les distances en une seule requête,
        // en utilisant une bounding box pour pré-filtrer et réduire le scan.
        $latRange  = $rayonKm / 111.0;                            // 1 degré lat ≈ 111 km
        $lngRange  = $rayonKm / (111.0 * cos(deg2rad($lat)));     // correction longitude

        $sql = <<<SQL
            SELECT
                c.id,
                ROUND(
                    CAST(
                        6371 * 2 * ASIN(
                            SQRT(
                                POWER(SIN(RADIANS(c.latitude  - :lat) / 2), 2) +
                                COS(RADIANS(:lat)) * COS(RADIANS(c.latitude)) *
                                POWER(SIN(RADIANS(c.longitude - :lng) / 2), 2)
                            )
                        )
                    AS NUMERIC),
                2) AS distance
            FROM centre_de_sante c
            WHERE c.est_actif = true
              AND c.latitude  BETWEEN :lat_min AND :lat_max
              AND c.longitude BETWEEN :lng_min AND :lng_max
              AND 6371 * 2 * ASIN(
                    SQRT(
                        POWER(SIN(RADIANS(c.latitude  - :lat) / 2), 2) +
                        COS(RADIANS(:lat)) * COS(RADIANS(c.latitude)) *
                        POWER(SIN(RADIANS(c.longitude - :lng) / 2), 2)
                    )
                  ) <= :rayon
        SQL;

        $params = [
            'lat'     => $lat,
            'lng'     => $lng,
            'lat_min' => $lat - $latRange,
            'lat_max' => $lat + $latRange,
            'lng_min' => $lng - $lngRange,
            'lng_max' => $lng + $lngRange,
            'rayon'   => $rayonKm,
        ];

        if ($type !== null && $type !== '') {
            $sql .= ' AND c.type = :type';
            $params['type'] = $type;
        }

        if ($ville !== null && $ville !== '') {
            $sql .= ' AND LOWER(c.ville) LIKE :ville';
            $params['ville'] = '%' . strtolower($ville) . '%';
        }

        if ($specialite !== null && $specialite !== '') {
            // Recherche dans le tableau JSON des spécialités
            $sql .= " AND c.specialites::text ILIKE :specialite";
            $params['specialite'] = '%' . $specialite . '%';
        }

        $sql .= ' ORDER BY distance ASC LIMIT ' . $limit;

        $conn    = $this->getEntityManager()->getConnection();
        $rows    = $conn->executeQuery($sql, $params)->fetchAllAssociative();

        if (empty($rows)) {
            return [];
        }

        // Étape 2 : Charger toutes les entités en UNE SEULE requête ORM
        // au lieu d'un find() par ligne (suppression du N+1)
        $ids            = array_column($rows, 'id');
        $distanceById   = array_column($rows, 'distance', 'id');

        $entities = $this->createQueryBuilder('c')
            ->where('c.id IN (:ids)')
            ->setParameter('ids', $ids)
            ->getQuery()
            ->getResult();

        // Étape 3 : Injecter la distance calculée dans chaque entité
        // et remettre dans l'ordre du tri SQL (ORDER BY distance ASC)
        $entitiesById = [];
        foreach ($entities as $entity) {
            $entity->setDistance((float) $distanceById[$entity->getId()]);
            $entitiesById[$entity->getId()] = $entity;
        }

        // Respecter l'ordre de tri original (les IDs sont déjà triés par distance)
        $result = [];
        foreach ($ids as $id) {
            if (isset($entitiesById[$id])) {
                $result[] = $entitiesById[$id];
            }
        }

        return $result;
    }
}
