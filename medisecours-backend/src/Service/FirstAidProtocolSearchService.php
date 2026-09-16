<?php

declare(strict_types=1);

namespace App\Service;

use App\Entity\ProtocolePremiersGestes;

/**
 * Recherche « parlante » dans le catalogue de premiers gestes :
 * synonymes, formulations courantes et locales, fautes tolérées, gestion des
 * négations, classement par pertinence puis urgence, suggestions si aucun résultat.
 *
 * Purement fonctionnel (aucune dépendance) pour être testable unitairement.
 */
final class FirstAidProtocolSearchService
{
    public const CATEGORIES = [
        'respiration' => 'Respiration et étouffement',
        'inconscience' => 'Inconscience et convulsions',
        'cardiovasculaire' => 'Cœur et circulation',
        'saignements' => 'Saignements et plaies',
        'brulures' => 'Brûlures',
        'intoxications' => 'Intoxications',
        'traumatismes' => 'Traumatismes',
        'allergies' => 'Réactions allergiques',
        'fievre' => 'Fièvre et déshydratation',
        'environnement' => 'Chaleur, froid et environnement',
        'maternite' => 'Grossesse et maternité',
        'pediatrie' => 'Urgences pédiatriques',
    ];

    public const CATEGORIES_EN = [
        'respiration' => 'Breathing and choking',
        'inconscience' => 'Unconsciousness and seizures',
        'cardiovasculaire' => 'Heart and circulation',
        'saignements' => 'Bleeding and wounds',
        'brulures' => 'Burns',
        'intoxications' => 'Poisoning',
        'traumatismes' => 'Injuries',
        'allergies' => 'Allergic reactions',
        'fievre' => 'Fever and dehydration',
        'environnement' => 'Heat, cold and environment',
        'maternite' => 'Pregnancy and maternity',
        'pediatrie' => 'Pediatric emergencies',
    ];

    /**
     * Formulations courantes et locales (dont les recherches typiques)
     * associées aux slugs de protocoles. Les mots-clés sont normalisés
     * (minuscules, sans accents).
     *
     * @var array<string, string[]>
     */
    private const SYNONYMS = [
        'difficulte_respiratoire' => [
            'il ne respire plus', 'ne respire plus', 'ne respire pas', 'respire mal',
            'difficulte a respirer', 'difficulte respiratoire', 'essoufflement',
            'souffle court', 'detresse respiratoire', 'asthme crise', 'toux etouffante',
            'levres bleues', 'asphyxie', 'la respiration est difficile',
        ],
        'perte_de_connaissance' => [
            'il est tombe sans connaissance', 'perte de connaissance', 'inconscient',
            'evanoui', 's evanouit', 'malaise avec perte de connaissance',
            'ne repond pas', 'coma', 'ne reagit pas', 's est effondre',
        ],
        'convulsion' => [
            'crise de convulsion', 'convulsion', 'convulsions', 'crise epileptique',
            'il tremble partout', 'spasmes', 'crise de tremblements', 'agite sans controle',
        ],
        'saignement_externe_important' => [
            'sang qui coule beaucoup', 'saigne beaucoup', 'saignement abondant',
            'hemorragie', 'perd beaucoup de sang', 'sa plaie saigne', 'saignement important',
            'le sang ne s arrete pas', 'coupure profonde qui saigne',
        ],
        'brulure' => [
            'brulure', 'il s est brule', 'brulure grave', 'peau brulee', 'cloque',
            'brulure etendue', 'contact avec une flamme', 'brulure a l eau bouillante',
        ],
        'douleur_thoracique' => [
            'douleur dans la poitrine', 'douleur thoracique', 'oppression poitrine',
            'serrement poitrine', 'douleur poitrine', 'mal au coeur', 'douleur bras gauche',
            'crise cardiaque', 'infarctus',
        ],
        'deshydratation' => [
            'deshydratation', 'soif intense', 'yeux creux', 'bouche seche',
            'diarrhee avec vomissements', 'diarrhee severe', 'vomissements repetes',
            'urine rare', 'il ne boit plus',
        ],
        'fievre' => [
            'fievre', 'temperature elevee', 'il a tres chaud', 'fievre avec convulsion',
            'fievre persistante', 'raideur de la nuque', 'fievre chez un enfant',
            'la fievre ne descend pas',
        ],
        'etouffement' => [
            'il s etouffe', 'etouffement', 'aliment bloque dans la gorge',
            'objet avale et coince', 'il ne peut plus parler', 'ne peut plus respirer',
            'quelque chose dans la gorge', 's etrangle',
        ],
        'intoxication' => [
            'produit avale', 'a avale un produit', 'medicament avale', 'intoxication',
            'poison', 'pesticide', 'produit menager', 'a bu un produit', 'surdose',
            'morsure de serpent venimeux',
        ],
        'reaction_allergique' => [
            'reaction allergique', 'gonflement de la langue', 'gonflement du visage',
            'apres une piqure', 'piqure d abeille', 'allergie alimentaire',
            'urticaire', 'gonflement apres piqure', 'choc anaphylactique',
        ],
        'traumatisme' => [
            'traumatisme', 'chute sur la tete', 'choc a la tete', 'douleur cervicale',
            'os casse', 'fracture', 'accident de la route', 'coup sur la tete',
            'il est tombe', 'ne bouge pas apres la chute', 'objet plante',
        ],
        'plaie' => [
            'plaie profonde', 'morsure', 'coupure', 'plaie sale', 'objet plante dans la plaie',
            'plaie au bras', 'entaille', 'coupure profonde', 'blessure ouverte',
        ],
    ];

    /** @var array<string, int> */
    private const URGENCY_RANK = ['CRITIQUE' => 10, 'ELEVE' => 8, 'MOYEN' => 4, 'FAIBLE' => 0];

    /**
     * @param ProtocolePremiersGestes[] $protocols Protocoles éligibles (déjà filtrés par le dépôt public)
     * @return array{results: array<int, array<string, mixed>>, suggestions: string[]}
     */
    public function search(array $protocols, string $query): array
    {
        $normalizedQuery = $this->normalize($query);
        if ($normalizedQuery === '') {
            return ['results' => [], 'suggestions' => []];
        }

        $negated = $this->extractNegatedTokens($normalizedQuery);
        $positiveQuery = $this->stripNegations($normalizedQuery);

        $categoryMatched = $this->matchCategory($positiveQuery);

        $scored = [];
        foreach ($protocols as $protocol) {
            $score = $this->scoreProtocol($protocol, $positiveQuery, $categoryMatched, $negated);
            if ($score > 0) {
                $scored[] = ['protocol' => $protocol, 'score' => $score];
            }
        }

        usort($scored, function (array $a, array $b): int {
            $byScore = $b['score'] <=> $a['score'];
            if ($byScore !== 0) {
                return $byScore;
            }
            $rankA = self::URGENCY_RANK[$a['protocol']->getNiveauUrgence()] ?? 0;
            $rankB = self::URGENCY_RANK[$b['protocol']->getNiveauUrgence()] ?? 0;

            return $rankB <=> $rankA;
        });

        return [
            'results' => array_map(
                static fn (array $entry): array => [
                    'protocol' => $entry['protocol'],
                    'score' => $entry['score'],
                ],
                array_slice($scored, 0, 12)
            ),
            'suggestions' => $this->buildSuggestions($scored, $categoryMatched, $positiveQuery),
        ];
    }

    /**
     * @param array<string, string>|null $categoryMatched [categorie => label] si une catégorie est reconnue
     * @param string[] $negated
     */
    private function scoreProtocol(ProtocolePremiersGestes $protocol, string $query, ?array $categoryMatched, array $negated): int
    {
        $title = $this->normalize($protocol->getTitre());
        $slug = $protocol->getSlug();
        $category = $this->normalize((string) $protocol->getCategorie());
        $categoryLabel = self::CATEGORIES[$protocol->getCategorie()] ?? '';
        $haystack = $this->normalize(implode(' ', array_map(
            static fn ($step): string => $step->getInstruction(),
            $protocol->getEtapes()->toArray()
        )));

        // Négation stricte : un signe explicitement nié exclut le protocole.
        $synonymTexts = array_map(fn (string $s): string => $this->normalize($s), self::SYNONYMS[$slug] ?? []);
        foreach ($negated as $negatedToken) {
            foreach (array_merge([$title, $categoryLabel], $synonymTexts, [$haystack]) as $target) {
                if ($target !== '' && str_contains($target, $negatedToken)) {
                    return 0;
                }
            }
        }

        $score = 0;

        if ($title === $query) {
            $score += 120;
        } elseif ($title !== '' && mb_strlen($query) >= 4 && str_contains($title, $query)) {
            $score += 90;
        } elseif ($title !== '' && $this->levenshteinAcceptable($query, $title)) {
            $score += 70;
        }

        foreach ($synonymTexts as $synonym) {
            if ($synonym === '') {
                continue;
            }
            $queryInSynonym = $synonym === $query || str_contains($query, $synonym);
            $synonymInQuery = mb_strlen($query) >= 4 && str_contains($synonym, $query);
            if ($queryInSynonym || $synonymInQuery) {
                $score += 100;
                break;
            }
        }

        if ($haystack !== '' && mb_strlen($query) >= 4 && str_contains($haystack, $query)) {
            $score += 45;
        }

        if ($categoryMatched !== null) {
            $score += in_array($protocol->getCategorie(), array_keys($categoryMatched), true) ? 40 : 0;
        }

        // Aucune correspondance de contenu : pas de résultat, quel que soit le niveau d'urgence.
        if ($score === 0) {
            return 0;
        }

        return $score + self::URGENCY_RANK[$protocol->getNiveauUrgence()] ?? 0;
    }

    /**
     * @param array<int, array{protocol: ProtocolePremiersGestes, score: int}> $scored
     * @param array<string, string>|null $categoryMatched
     * @return string[]
     */
    private function buildSuggestions(array $scored, ?array $categoryMatched, string $query): array
    {
        $suggestions = [];
        if ($categoryMatched !== null && $scored === []) {
            foreach (array_values($categoryMatched) as $label) {
                $suggestions[] = $label;
            }
        }

        if ($scored === [] && $categoryMatched === null) {
            foreach (array_values(self::CATEGORIES) as $label) {
                $suggestions[] = $label;
                if (count($suggestions) >= 4) {
                    break;
                }
            }
        }

        if ($scored !== [] && count($scored) < 3) {
            $suggestions[] = 'Élargir la recherche à une catégorie (ex. « saignements », « brûlures »).';
        }

        if ($scored !== [] && count($scored) >= 3) {
            return [];
        }

        if ($suggestions === []) {
            $suggestions[] = 'Formuler la situation autrement, par exemple « il ne respire plus » ou « sang qui coule beaucoup ».';
        }

        return array_values(array_unique($suggestions));
    }

    /**
     * @return array<string, string>|null
     */
    private function matchCategory(string $query): ?array
    {
        foreach (self::CATEGORIES as $slug => $label) {
            $normalizedLabel = $this->normalize($label);
            if ($normalizedLabel === '') {
                continue;
            }
            $labelInQuery = $normalizedLabel === $query || (mb_strlen($query) >= 4 && str_contains($normalizedLabel, $query));
            $queryInLabel = mb_strlen($query) >= 4 && str_contains($query, $normalizedLabel);
            if ($labelInQuery || $queryInLabel) {
                return [$slug => $label];
            }
        }

        return null;
    }

    /**
     * @return string[]
     */
    private function extractNegatedTokens(string $normalizedQuery): array
    {
        // "pas de gonflement de la langue" -> "gonflement", "langue"
        $tokens = [];
        if (preg_match_all('~(?:pas(?:\s+(?:de|d\'))?|sans|ne\s+\w+\s+pas|aucun\s+|aucune\s+|plus\s+)\s*([a-z]+(?:\s+[a-z]+)?)~', $normalizedQuery, $matches)) {
            foreach ($matches[1] as $group) {
                foreach (preg_split('/\s+/', $group) ?: [] as $word) {
                    if (mb_strlen($word) >= 4) {
                        $tokens[] = $word;
                    }
                }
            }
        }

        return array_values(array_unique($tokens));
    }

    private function stripNegations(string $normalizedQuery): string
    {
        return trim((string) preg_replace(
            '~(?:pas(?:\s+(?:de|d\'))?|sans|aucun\s+|aucune\s+|ne\s+[a-z]+\s+pas(?:\s+(?:de|d\'))?)~',
            ' ',
            $normalizedQuery
        ));
    }

    private function levenshteinAcceptable(string $query, string $title): bool
    {
        if ($query === '' || $title === '') {
            return false;
        }
        $distance = levenshtein($query, $title);
        $maxLength = max(mb_strlen($query), mb_strlen($title));

        return $distance > 0 && $distance <= max(1, intdiv($maxLength, 3));
    }

    private function normalize(string $value): string
    {
        $value = trim(mb_strtolower($value));
        $ascii = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);
        $value = $ascii !== false ? $ascii : $value;
        $value = preg_replace('/[^a-z0-9]+/i', ' ', $value) ?? '';

        return trim(preg_replace('/\s+/', ' ', $value) ?? '');
    }
}
