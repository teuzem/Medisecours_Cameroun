<?php

declare(strict_types=1);

namespace App\Service;

use App\Entity\ProtocoleEtape;
use App\Entity\ProtocolePremiersGestes;

/** Serialisation publique minimale, sans donnees administratives internes. */
final class FirstAidProtocolPublicSerializer
{
    public function __construct(private readonly ContentLocalizer $localizer)
    {
    }

    /**
     * @return array<string, mixed>
     */
    public function serialize(ProtocolePremiersGestes $protocol): array
    {
        return [
            'slug' => $protocol->getSlug(),
            'titre' => $this->localizer->pick($protocol->getTitre(), $protocol->getTitreEn()),
            'categorie' => $protocol->getCategorie(),
            'masterSlug' => $protocol->getMasterSlug(),
            'variantKey' => $protocol->getVariantKey(),
            'niveauUrgence' => $protocol->getNiveauUrgence(),
            'population' => $protocol->getPopulation(),
            'version' => $protocol->getVersion(),
            'sourceClinique' => $this->localizer->pickNullable($protocol->getSourceClinique(), $protocol->getSourceCliniqueEn()),
            'restrictionsPopulations' => $this->localizer->pickNullable($protocol->getRestrictionsPopulations(), $protocol->getRestrictionsPopulationsEn()),
            'etapes' => array_map(
                fn (ProtocoleEtape $step): array => [
                    'position' => $step->getPosition(),
                    'type' => $step->getType(),
                    'titre' => $this->localizer->pickNullable($step->getTitre(), $step->getTitreEn()),
                    'instruction' => $this->localizer->pick($step->getInstruction(), $step->getInstructionEn()),
                ],
                $protocol->getEtapes()->toArray()
            ),
        ];
    }

    /**
     * @param ProtocolePremiersGestes[] $protocols
     * @return array<int, array<string, mixed>>
     */
    public function serializeMany(array $protocols): array
    {
        return array_map(fn (ProtocolePremiersGestes $protocol): array => $this->serialize($protocol), $protocols);
    }
}
