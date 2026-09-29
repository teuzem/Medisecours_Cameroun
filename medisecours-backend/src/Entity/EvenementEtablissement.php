<?php

declare(strict_types=1);

namespace App\Entity;

use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Interaction enregistrée sur une fiche établissement (analytiques temps réel).
 *
 * Une ligne = un événement daté. Les agrégations (totaux, séries journalières,
 * services demandés) sont calculées côté SQL/requêtes, jamais stockées.
 *
 * Types d'événements (whitelist) :
 *  - fiche       : ouverture/consultation de la fiche,
 *  - telephone   : clic "appeler" (tel:),
 *  - email       : clic "contacter par mail" (mailto:),
 *  - site_web    : clic lien site web,
 *  - itineraire  : clic "itinéraire/directions",
 *  - partage     : partage (SMS, lien, réseaux),
 *  - sauvegarde  : enregistrement dans les favoris,
 *  - sos         : demande d'aide SOS émise pour cet établissement,
 *  - suggestion  : suggestion de modification envoyée,
 *  - proximite   : recherche "à proximité" depuis la fiche,
 *  - service     : interaction avec un service/spécialité (metadata.service),
 *  - avis        : avis publié sur la fiche.
 */
#[ORM\Entity(repositoryClass: EvenementEtablissementRepository::class)]
#[ORM\Table(name: 'evenement_etablissement')]
#[ORM\Index(name: 'idx_evenement_etab', columns: ['etablissement_id', 'type'])]
#[ORM\Index(name: 'idx_evenement_etab_date', columns: ['etablissement_id', 'created_at'])]
class EvenementEtablissement
{
    public const TYPES = [
        'fiche',
        'telephone',
        'email',
        'site_web',
        'itineraire',
        'partage',
        'sauvegarde',
        'sos',
        'suggestion',
        'proximite',
        'service',
        'avis',
    ];

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: CentreDeSante::class)]
    #[ORM\JoinColumn(name: 'etablissement_id', nullable: false, onDelete: 'CASCADE')]
    private ?CentreDeSante $etablissement = null;

    #[ORM\Column(length: 30)]
    private string $type = 'fiche';

    /**
     * Contexte optionnel (ex : {"service": "Cardiologie"} pour 'service').
     *
     * @var array<string, string|int|float|bool|null>
     */
    #[ORM\Column(type: Types::JSON)]
    private array $metadata = [];

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(name: 'utilisateur_id', nullable: true, onDelete: 'SET NULL')]
    private ?User $utilisateur = null;

    #[ORM\Column(name: 'created_at', type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $createdAt;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getEtablissement(): ?CentreDeSante
    {
        return $this->etablissement;
    }

    public function setEtablissement(?CentreDeSante $etablissement): static
    {
        $this->etablissement = $etablissement;

        return $this;
    }

    public function getType(): string
    {
        return $this->type;
    }

    public function setType(string $type): static
    {
        $this->type = $type;

        return $this;
    }

    /**
     * @return array<string, string|int|float|bool|null>
     */
    public function getMetadata(): array
    {
        return $this->metadata;
    }

    /**
     * @param array<string, string|int|float|bool|null> $metadata
     */
    public function setMetadata(array $metadata): static
    {
        $this->metadata = $metadata;

        return $this;
    }

    public function getUtilisateur(): ?User
    {
        return $this->utilisateur;
    }

    public function setUtilisateur(?User $utilisateur): static
    {
        $this->utilisateur = $utilisateur;

        return $this;
    }

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }
}