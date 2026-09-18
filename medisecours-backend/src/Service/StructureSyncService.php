<?php

declare(strict_types=1);

namespace App\Service;

use App\Entity\CentreDeSante;
use App\Repository\CentreDeSanteRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Contracts\HttpClient\HttpClientInterface;

/**
 * Synchronisation temps réel des structures de santé camerounaises.
 *
 * Interroge l'API Google Places Text Search (directement ou via le proxy
 * Forge GeoAPI) sur la matrice [10 régions × types d'établissement] puis
 * upsert dans centre_de_sante :
 *   - inconnu   : créé,
 *   - existant  : enrichi (adresse, ville, téléphone, coordonnées),
 *   - fermé     : ignoré,
 * avec googlePlaceId comme clé d'unicité et source/last_synced_at tracés.
 *
 * Sans clé configurée (FORGE_API_KEY / GOOGLE_MAPS_API_KEY absente), la
 * sauvegarde ne modifie rien et retourne configured=false.
 */
final class StructureSyncService
{
    public const SOURCE_GOOGLE = 'google_places';
    public const SOURCE_MANUEL = 'manuel';

    private const GOOGLE_TEXTSEARCH = 'https://maps.googleapis.com/maps/api/place/textsearch/json';

    /** @var list<string> */
    private const REGIONS = [
        'Adamaoua', 'Centre', 'Est', 'Extrême-Nord', 'Littoral',
        'Nord', 'Nord-Ouest', 'Ouest', 'Sud', 'Sud-Ouest',
    ];

    /**
     * Type interne => mots-clés de recherche Google Places.
     *
     * @var array<string, list<string>>
     */
    private const TYPE_KEYWORDS = [
        'hopital_general'     => ['hôpital', 'hopital général'],
        'hopital_de_district' => ['hôpital de district', 'centre hospitalier'],
        'chu'                 => ['centre hospitalier universitaire', 'CHU'],
        'cma'                 => ['centre médical d’arrondissement', 'CMA'],
        'csi'                 => ['centre de santé intégré', 'centre de santé'],
        'clinique_privee'     => ['clinique', 'polyclinique'],
        'pharmacie'           => ['pharmacie'],
        'laboratoire'         => ['laboratoire d’analyses médicales'],
        'centre_specialise'   => ['centre spécialisé'],
    ];

    private const DEFAULT_HORAIRES = 'Horaires non renseignés — vérifier à l’accueil';

    private int $queries = 0;
    private int $created = 0;
    private int $updated = 0;
    private int $skipped = 0;

    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly CentreDeSanteRepository $centres,
        private readonly HttpClientInterface $httpClient,
        private readonly string $forgeApiKey,
        private readonly string $forgeApiUrl,
        private readonly string $googleMapsApiKey
    ) {
    }

    /**
     * Lance la synchronisation sur la matrice régions × types.
     *
     * @param list<string>|null $regions sous-ensemble de régions (null = toutes)
     * @param int               $maxPerQuery nombre max d'occurrences traitées par requête
     * @param int               $globalCap   arrêt total (créés + mis à jour)
     *
     * @return array<string, mixed>
     */
    public function sync(?array $regions = null, int $maxPerQuery = 60, int $globalCap = 400): array
    {
        $endpoint = $this->resolveEndpoint();
        if ($endpoint === null) {
            return [
                'configured' => false,
                'error'      => 'Aucune clé Google Places configurée (FORGE_API_KEY ou GOOGLE_MAPS_API_KEY).',
                'queries'    => 0,
                'created'    => 0,
                'updated'    => 0,
                'skipped'    => 0,
            ];
        }

        $regions = $regions === null || $regions === []
            ? self::REGIONS
            : array_values(array_intersect(self::REGIONS, array_map('trim', $regions)));
        if ($regions === []) {
            $regions = self::REGIONS;
        }

        foreach ($regions as $region) {
            if ($this->created + $this->updated >= $globalCap) {
                break;
            }

            foreach (self::TYPE_KEYWORDS as $type => $keywords) {
                if ($this->created + $this->updated >= $globalCap) {
                    break;
                }

                foreach ($keywords as $keyword) {
                    $remaining = $globalCap - ($this->created + $this->updated);
                    if ($remaining <= 0) {
                        break;
                    }

                    $this->searchQuery($endpoint, sprintf('%s %s, Cameroun', $keyword, $region), $region, $type, $remaining);

                    // Politesse API : pause entre chaque requête.
                    usleep(150_000);
                }
            }
        }

        $this->em->flush();

        return [
            'configured' => true,
            'source'     => $endpoint['label'],
            'queries'    => $this->queries,
            'created'    => $this->created,
            'updated'    => $this->updated,
            'skipped'    => $this->skipped,
            'regions'    => count($regions),
        ];
    }

    /**
     * @return array{url: string, key: string, label: string}|null
     */
    private function resolveEndpoint(): ?array
    {
        if ($this->forgeApiKey !== '') {
            return [
                'url'   => rtrim($this->forgeApiUrl, '/') . '/v1/maps/proxy/maps/api/place/textsearch/json',
                'key'   => $this->forgeApiKey,
                'label' => 'forge',
            ];
        }

        if ($this->googleMapsApiKey !== '') {
            return [
                'url'   => self::GOOGLE_TEXTSEARCH,
                'key'   => $this->googleMapsApiKey,
                'label' => 'google_places',
            ];
        }

        return null;
    }

    /**
     * Requête Text Search + pagination (next_page_token), upsert de chaque résultat.
     *
     * @param array{url: string, key: string, label: string} $endpoint
     */
    private function searchQuery(array $endpoint, string $query, string $region, string $type, int $remaining): void
    {
        $params = [
            'query'  => $query,
            'region' => 'cm',
            'key'    => $endpoint['key'],
        ];

        // 3 pages max par requête pour rester dans les quotas standard.
        for ($page = 0; $page < 3; ++$page) {
            $results = $this->fetch($endpoint['url'], $params);
            if ($results === null) {
                break;
            }

            ++$this->queries;

            foreach ($results['results'] as $place) {
                if ($this->created + $this->updated >= $remaining) {
                    return;
                }
                $this->upsert(is_array($place) ? $place : [], $region, $type);
            }

            $token = $results['next_page_token'] ?? null;
            if (!is_string($token) || $token === '') {
                break;
            }

            // Google impose ~2 secondes avant l'utilisation d'un next_page_token.
            sleep(2);
            $params = ['pagetoken' => $token, 'key' => $endpoint['key']];
        }
    }

    /**
     * @param array<string, string> $params
     *
     * @return array{results: list<array<string, mixed>>}|null
     */
    private function fetch(string $url, array $params): ?array
    {
        try {
            $response = $this->httpClient->request('GET', $url, [
                'query'   => $params,
                'timeout' => 20,
            ]);
            $json = $response->toArray(false);
        } catch (\Throwable) {
            return null;
        }

        if (!is_array($json) || !isset($json['results']) || !is_array($json['results'])) {
            return null;
        }

        return $json;
    }

    /**
     * Upsert d'un résultat Google Places dans centre_de_sante.
     *
     * @param array<string, mixed> $place
     */
    private function upsert(array $place, string $region, string $type): void
    {
        $placeId = (string) ($place['place_id'] ?? '');
        $businessStatus = (string) ($place['business_status'] ?? '');
        $geometry = $place['geometry']['location'] ?? null;

        if ($placeId === '' || $businessStatus === 'CLOSED_PERMANENTLY' || !is_array($geometry)) {
            ++$this->skipped;
            return;
        }

        $lat = (float) ($geometry['lat'] ?? 0);
        $lng = (float) ($geometry['lng'] ?? 0);
        if ($lat === 0.0 && $lng === 0.0) {
            ++$this->skipped;
            return;
        }

        $name = trim((string) ($place['name'] ?? ''));
        if ($name === '') {
            ++$this->skipped;
            return;
        }

        $centre = $this->centres->findByGooglePlaceId($placeId);
        $isNew = $centre === null;

        if ($centre === null) {
            // Repli : correspondance nom + région (indifférent à la casse) pour
            // enrichir une structure déjà présente avec un id Google manquant.
            $centre = $this->centres->findOneBy(['nom' => $name, 'region' => $region]);
            $isNew = $centre === null;
        }

        if ($centre === null) {
            $centre = new CentreDeSante();
            $centre
                ->setNom(mb_substr($name, 0, 255))
                ->setType($type)
                ->setRegion($region)
                ->setStatut('prive')
                ->setEstActif(true)
                ->setUrgences24h(false)
                ->setSpecialites([])
                ->setServices([])
                ->setVerificationStatut('NON_VERIFIE');

            $this->em->persist($centre);
        }

        $centre
            ->setGooglePlaceId($placeId)
            ->setSource(self::SOURCE_GOOGLE)
            ->setLastSyncedAt(new \DateTimeImmutable())
            ->setLatitude($lat)
            ->setLongitude($lng);

        $this->fillAddress($centre, $place, $region, $type);

        if (trim((string) $centre->getHoraires()) === '') {
            $centre->setHoraires(
                is_array($place['opening_hours'] ?? null) && ($place['opening_hours']['open_now'] ?? null) === true
                    ? 'Ouvert maintenant'
                    : self::DEFAULT_HORAIRES
            );
        }

        if ($isNew) {
            ++$this->created;
        } else {
            ++$this->updated;
        }
    }

    /**
     * Remplit adresse / ville / téléphone sans écraser les valeurs déjà
     * renseignées (préservation des données saisies ou importées).
     *
     * @param array<string, mixed> $place
     */
    private function fillAddress(CentreDeSante $centre, array $place, string $region, string $type): void
    {
        $formatted = trim((string) ($place['formatted_address'] ?? ''));
        if ($formatted !== '') {
            $centre->setAdresse(mb_substr($formatted, 0, 255));
        }

        if (trim((string) $centre->getVille()) === '') {
            $ville = $this->extractLocality($place, $formatted);
            if ($ville !== null) {
                $centre->setVille($ville);
            }
        }

        if (trim((string) $centre->getRegion()) === '') {
            $centre->setRegion($region);
        }

        $telephone = trim((string) ($place['international_phone_number'] ?? ''));
        if ($telephone !== '' && trim((string) $centre->getTelephone()) === '') {
            $centre->setTelephone(mb_substr($telephone, 0, 40));
        }

        if ($type !== '' && in_array($centre->getType(), ['', 'hopital_general'], true)) {
            $centre->setType($type);
        }
    }

    /**
     * Extrait la ville (locality / niveau administratif 2) depuis les
     * address_components ou l'adresse formatée.
     *
     * @param array<string, mixed> $place
     */
    private function extractLocality(array $place, string $formatted): ?string
    {
        foreach (($place['address_components'] ?? []) as $component) {
            if (!is_array($component)) {
                continue;
            }
            $types = $component['types'] ?? [];
            if (in_array('locality', $types, true) || in_array('administrative_area_level_2', $types, true)) {
                $name = trim((string) ($component['long_name'] ?? ''));
                if ($name !== '') {
                    return mb_substr($name, 0, 100);
                }
            }
        }

        if ($formatted !== '') {
            $part = trim((string) explode(',', $formatted)[0]);
            if ($part !== '') {
                return mb_substr($part, 0, 100);
            }
        }

        return null;
    }
}