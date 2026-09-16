<?php

declare(strict_types=1);

namespace App\Service;

use App\Entity\ProtocolePremiersGestes;

/**
 * Classe le catalogue public selon les situations fréquemment rencontrées
 * au Cameroun, puis selon l'urgence clinique.
 *
 * Références de priorisation :
 * - OMS, profil sanitaire du Cameroun et principales causes de décès ;
 * - OMS, profil sécurité routière Cameroun 2023 ;
 * - OMS Cameroun, le paludisme représente environ 30 % des consultations ;
 * - UNICEF Cameroun, infections respiratoires, diarrhée et paludisme.
 */
final class CameroonFirstAidPriorityService
{
    /**
     * Plus la position est basse, plus le protocole apparaît tôt.
     *
     * @var array<int, string[]>
     */
    private const PRIORITY_GROUPS = [
        [
            'paludisme_signes_graves',
            'fievre',
            'fievre_nourrisson',
            'convulsion_febrile_enfant',
        ],
        [
            'difficulte_respiratoire',
            'detresse_respiratoire_enfant',
            'crise_asthme',
            'etouffement',
            'obstruction_nourrisson',
            'arret_cardiorespiratoire',
        ],
        [
            'diarrhee_aigue',
            'deshydratation',
            'deshydratation_enfant',
            'vomissements_persistants',
            'diarrhee_cholera',
        ],
        [
            'accident_route',
            'traumatisme',
            'traumatisme_cranien',
            'traumatisme_cranien_enfant',
            'fracture_suspectee',
            'entorse',
            'plaie',
            'saignement_externe_important',
            'brulure',
            'brulure_liquide_chaud',
            'brulure_enfant',
        ],
        [
            'malaise',
            'perte_de_connaissance',
            'convulsion',
            'hypoglycemie_consciente',
            'hypoglycemie_inconsciente',
            'douleur_thoracique',
            'avc_suspecte',
        ],
        [
            'saignement_grossesse',
            'eclampsie_suspectee',
            'hemorragie_postpartum',
            'accouchement_imminent',
            'nouveau_ne_ne_respire_pas',
        ],
        [
            'intoxication_alimentaire',
            'intoxication',
            'intoxication_enfant',
            'intoxication_pesticide',
            'ingestion_hydrocarbure',
            'morsure_serpent',
            'morsure_animale',
            'exposition_rage',
        ],
    ];

    private const URGENCY_RANK = [
        'CRITIQUE' => 4,
        'ELEVE' => 3,
        'MOYEN' => 2,
        'FAIBLE' => 1,
    ];

    /**
     * @param ProtocolePremiersGestes[] $protocols
     * @return ProtocolePremiersGestes[]
     */
    public function sort(array $protocols): array
    {
        usort($protocols, fn (
            ProtocolePremiersGestes $a,
            ProtocolePremiersGestes $b,
        ): int => $this->compare($a, $b));

        return $protocols;
    }

    private function compare(
        ProtocolePremiersGestes $a,
        ProtocolePremiersGestes $b,
    ): int {
        $priority = $this->priority($a) <=> $this->priority($b);
        if ($priority !== 0) {
            return $priority;
        }

        $urgency = (self::URGENCY_RANK[$b->getNiveauUrgence()] ?? 0)
            <=> (self::URGENCY_RANK[$a->getNiveauUrgence()] ?? 0);
        if ($urgency !== 0) {
            return $urgency;
        }

        $variant = $this->variantPriority($a) <=> $this->variantPriority($b);
        if ($variant !== 0) {
            return $variant;
        }

        return strcasecmp($a->getTitre(), $b->getTitre());
    }

    private function priority(ProtocolePremiersGestes $protocol): int
    {
        $topic = $protocol->getMasterSlug() ?: $protocol->getSlug();
        foreach (self::PRIORITY_GROUPS as $groupIndex => $slugs) {
            $position = array_search($topic, $slugs, true);
            if ($position !== false) {
                return ($groupIndex * 100) + $position;
            }
        }

        return 10_000;
    }

    private function variantPriority(ProtocolePremiersGestes $protocol): int
    {
        return match ($protocol->getVariantKey()) {
            null, 'STANDARD' => 0,
            'TEMOIN_SEUL' => 1,
            'SECOURS_ELOIGNES' => 2,
            'TRANSPORT_EN_COURS' => 3,
            'PLUSIEURS_VICTIMES' => 4,
            default => 5,
        };
    }
}
