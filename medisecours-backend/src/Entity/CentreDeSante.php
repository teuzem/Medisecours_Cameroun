<?php

namespace App\Entity;

use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Post;
use ApiPlatform\Metadata\Patch;
use ApiPlatform\Metadata\Delete;
use ApiPlatform\Doctrine\Orm\Filter\SearchFilter;
use ApiPlatform\Doctrine\Orm\Filter\BooleanFilter;
use ApiPlatform\Doctrine\Orm\Filter\OrderFilter;
use ApiPlatform\Metadata\ApiFilter;
use App\Repository\CentreDeSanteRepository;
use App\State\CentreDeSanteCarteProvider;
use App\State\CentreDeSanteFicheProvider;
use App\State\CentreDeSanteProcheProvider;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Annotation\Groups;
use Symfony\Component\Validator\Constraints as Assert;

#[ApiResource(
    operations: [
        new GetCollection(),
        new GetCollection(
            uriTemplate: '/centres_de_santes/proches',
            provider: CentreDeSanteProcheProvider::class,
            normalizationContext: ['groups' => ['centre_sante:read', 'centre_sante:distance']]
        ),
        // Moteur de recherche de la carte Santé (q / type / region / ville / lat / lng)
        new GetCollection(
            uriTemplate: '/carte/etablissements',
            provider: CentreDeSanteCarteProvider::class,
            normalizationContext: ['groups' => ['centre_sante:read', 'centre_sante:distance', 'centre_sante:carte']],
            paginationEnabled: false
        ),
        new Get(),
        // Fiche détaillée (médias, note, médecins affiliés, stats)
        new Get(
            uriTemplate: '/centre_de_santes/{id}/fiche',
            provider: CentreDeSanteFicheProvider::class,
            normalizationContext: ['groups' => ['centre_sante:read', 'centre_sante:fiche']]
        ),
        new Post(security: "is_granted('ROLE_ADMIN')"),
        new Patch(security: "is_granted('ROLE_ADMIN')"),
        new Delete(security: "is_granted('ROLE_ADMIN')")
    ],
    normalizationContext: ['groups' => ['centre_sante:read']],
    denormalizationContext: ['groups' => ['centre_sante:write']],
    paginationEnabled: false
)]
#[ApiFilter(SearchFilter::class, properties: [
    'nom'    => 'partial',
    'ville'  => 'partial',
    'region' => 'exact',
    'type'   => 'exact',
])]
#[ApiFilter(BooleanFilter::class, properties: ['estActif', 'urgences24h'])]
#[ApiFilter(OrderFilter::class, properties: ['nom', 'ville'])]
#[ORM\Entity(repositoryClass: CentreDeSanteRepository::class)]
class CentreDeSante
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['centre_sante:read'])]
    private ?int $id = null;

    #[ORM\Column(length: 255)]
    #[Assert\NotBlank(message: 'Le nom est obligatoire')]
    #[Assert\Length(min: 2, max: 255)]
    #[Groups(['centre_sante:read', 'centre_sante:write'])]
    private ?string $nom = null;

    #[ORM\Column(length: 50)]
    #[Assert\Choice(choices: [
        'hopital_general',
        'hopital_de_district',
        'chu',
        'cma',
        'csi',
        'clinique_privee',
        'pharmacie',
        'laboratoire',
        'centre_specialise',
    ], message: 'Type de centre invalide')]
    #[Groups(['centre_sante:read', 'centre_sante:write'])]
    private string $type = 'hopital_general';

    #[ORM\Column(length: 255)]
    #[Assert\NotBlank(message: 'L\'adresse est obligatoire')]
    #[Assert\Length(min: 5, max: 255)]
    #[Groups(['centre_sante:read', 'centre_sante:write'])]
    private ?string $adresse = null;

    #[ORM\Column(length: 100)]
    #[Assert\NotBlank(message: 'La ville est obligatoire')]
    #[Groups(['centre_sante:read', 'centre_sante:write'])]
    private ?string $ville = null;

    #[ORM\Column(length: 100)]
    #[Assert\Choice(choices: [
        'Adamaoua', 'Centre', 'Est', 'Extrême-Nord', 'Littoral',
        'Nord', 'Nord-Ouest', 'Ouest', 'Sud', 'Sud-Ouest'
    ], message: 'Région invalide')]
    #[Groups(['centre_sante:read', 'centre_sante:write'])]
    private ?string $region = null;

    #[ORM\Column]
    #[Assert\NotBlank(message: 'La latitude est obligatoire')]
    #[Assert\Range(min: -90, max: 90)]
    #[Groups(['centre_sante:read', 'centre_sante:write'])]
    private ?float $latitude = null;

    #[ORM\Column]
    #[Assert\NotBlank(message: 'La longitude est obligatoire')]
    #[Assert\Range(min: -180, max: 180)]
    #[Groups(['centre_sante:read', 'centre_sante:write'])]
    private ?float $longitude = null;

    #[ORM\Column(length: 255, nullable: true)]
    #[Groups(['centre_sante:read', 'centre_sante:write'])]
    private ?string $telephone = null;

    #[ORM\Column(length: 255, nullable: true)]
    #[Groups(['centre_sante:read', 'centre_sante:write'])]
    private ?string $email = null;

    #[ORM\Column(length: 255, nullable: true)]
    #[Groups(['centre_sante:read', 'centre_sante:write'])]
    private ?string $siteWeb = null;

    #[ORM\Column(length: 500, nullable: true)]
    #[Groups(['centre_sante:read', 'centre_sante:write'])]
    private ?string $imageUrl = null;

    #[ORM\Column(length: 50, options: ['default' => 'prive'])]
    #[Assert\Choice(choices: ['public', 'prive', 'associatif'])]
    #[Groups(['centre_sante:read', 'centre_sante:write'])]
    private string $statut = 'prive';

    #[ORM\Column(length: 255, nullable: true)]
    #[Groups(['centre_sante:read', 'centre_sante:write'])]
    private ?string $quartier = null;

    #[ORM\Column(length: 255)]
    #[Assert\NotBlank(message: 'Les horaires sont obligatoires')]
    #[Groups(['centre_sante:read', 'centre_sante:write'])]
    private ?string $horaires = null;

    #[ORM\Column(type: 'json')]
    #[Groups(['centre_sante:read', 'centre_sante:write'])]
    private array $specialites = [];

    #[ORM\Column(type: 'json')]
    #[Groups(['centre_sante:read', 'centre_sante:write'])]
    private array $services = [];

    #[ORM\Column(type: 'text', nullable: true)]
    #[Groups(['centre_sante:read', 'centre_sante:write'])]
    private ?string $description = null;

    #[ORM\Column]
    #[Groups(['centre_sante:read', 'centre_sante:write'])]
    private bool $estActif = true;

    #[ORM\Column]
    #[Groups(['centre_sante:read', 'centre_sante:write'])]
    private bool $urgences24h = false;

    /**
     * Distance calculée à la volée lors d'une recherche géolocalisée.
     * NON persisté en base — injecté dynamiquement par CentreDeSanteProcheProvider.
     * Exposé uniquement dans le groupe 'centre_sante:distance'.
     */
    #[Groups(['centre_sante:distance'])]
    private ?float $distance = null;

    /**
     * Note moyenne recalculée à chaque avis publié (AvisEtablissementProcessor).
     */
    #[ORM\Column(type: 'float', options: ['default' => 0])]
    #[Groups(['centre_sante:read', 'centre_sante:fiche'])]
    private float $noteMoyenne = 0;

    /**
     * Nombre total d'avis publiés.
     */
    #[ORM\Column(type: 'integer', options: ['default' => 0])]
    #[Groups(['centre_sante:read', 'centre_sante:fiche'])]
    private int $totalAvis = 0;

    /**
     * Identifiant Google Place (interopérabilité / alignement avec un portail externe).
     */
    #[ORM\Column(length: 255, nullable: true)]
    #[Groups(['centre_sante:read', 'centre_sante:write'])]
    private ?string $googlePlaceId = null;

    /**
     * Statut de vérification des informations : NON_VERIFIE, EN_COURS, VERIFIE.
     */
    #[ORM\Column(length: 30, options: ['default' => 'NON_VERIFIE'])]
    #[Groups(['centre_sante:read', 'centre_sante:write'])]
    private string $verificationStatut = 'NON_VERIFIE';

    /**
     * Origine des données : manuel (saisie/seed), csv (import), google_places (sync temps réel).
     */
    #[ORM\Column(length: 20, options: ['default' => 'manuel'])]
    private string $source = 'manuel';

    /**
     * Dernière mise à jour par la synchronisation temps réel des structures.
     */
    #[ORM\Column(type: 'datetime_immutable', nullable: true)]
    private ?\DateTimeImmutable $lastSyncedAt = null;

    /**
     * Médecins affiliés (vus à travers la fiche) — injecté par CentreDeSanteFicheProvider.
     * NON persisté. Tableau : [{"id":..., "fonction":..., "specialite":..., "nom":..., "prenom":..., "planning":..., "teleconsultation":...}]
     */
    #[Groups(['centre_sante:fiche'])]
    private ?array $medecins = [];

    /** @var Collection<int, MediaObject> */
    #[ORM\OneToMany(targetEntity: MediaObject::class, mappedBy: 'centre', cascade: ['persist', 'remove'])]
    #[Groups(['centre_sante:read'])]
    private Collection $images;

    /** @var Collection<int, AffiliationMedecin> */
    #[ORM\OneToMany(targetEntity: AffiliationMedecin::class, mappedBy: 'etablissement', cascade: ['persist', 'remove'])]
    private Collection $affiliations;

    /** @var Collection<int, EtablissementEquipe> */
    #[ORM\OneToMany(targetEntity: EtablissementEquipe::class, mappedBy: 'etablissement', cascade: ['persist', 'remove'])]
    private Collection $equipes;

    public function __construct()
    {
        $this->images = new ArrayCollection();
        $this->affiliations = new ArrayCollection();
        $this->equipes = new ArrayCollection();
    }

    // Getters et setters
    public function getId(): ?int { return $this->id; }

    public function getNom(): ?string { return $this->nom; }
    public function setNom(string $nom): static { $this->nom = $nom; return $this; }

    public function getType(): string { return $this->type; }
    public function setType(string $type): static { $this->type = $type; return $this; }

    public function getAdresse(): ?string { return $this->adresse; }
    public function setAdresse(string $adresse): static { $this->adresse = $adresse; return $this; }

    public function getVille(): ?string { return $this->ville; }
    public function setVille(string $ville): static { $this->ville = $ville; return $this; }

    public function getRegion(): ?string { return $this->region; }
    public function setRegion(string $region): static { $this->region = $region; return $this; }

    public function getLatitude(): ?float { return $this->latitude; }
    public function setLatitude(?float $latitude): static { $this->latitude = $latitude; return $this; }

    public function getLongitude(): ?float { return $this->longitude; }
    public function setLongitude(?float $longitude): static { $this->longitude = $longitude; return $this; }

    public function getTelephone(): ?string { return $this->telephone; }
    public function setTelephone(?string $telephone): static { $this->telephone = $telephone; return $this; }

    public function getHoraires(): ?string { return $this->horaires; }
    public function setHoraires(string $horaires): static { $this->horaires = $horaires; return $this; }

    public function getSpecialites(): array { return $this->specialites; }
    public function setSpecialites(array $specialites): static { $this->specialites = $specialites; return $this; }

    public function getServices(): array { return $this->services; }
    public function setServices(array $services): static { $this->services = $services; return $this; }

    public function getDescription(): ?string { return $this->description; }
    public function setDescription(?string $description): static { $this->description = $description; return $this; }

    public function isEstActif(): bool { return $this->estActif; }
    public function setEstActif(bool $estActif): static { $this->estActif = $estActif; return $this; }

    public function isUrgences24h(): bool { return $this->urgences24h; }
    public function setUrgences24h(bool $urgences24h): static { $this->urgences24h = $urgences24h; return $this; }

    public function getDistance(): ?float { return $this->distance; }
    public function setDistance(?float $distance): static { $this->distance = $distance; return $this; }

    public function getEmail(): ?string { return $this->email; }
    public function setEmail(?string $email): static { $this->email = $email; return $this; }

    public function getSiteWeb(): ?string { return $this->siteWeb; }
    public function setSiteWeb(?string $siteWeb): static { $this->siteWeb = $siteWeb; return $this; }

    public function getImageUrl(): ?string { return $this->imageUrl; }
    public function setImageUrl(?string $imageUrl): static { $this->imageUrl = $imageUrl; return $this; }

    public function getStatut(): string { return $this->statut; }
    public function setStatut(string $statut): static { $this->statut = $statut; return $this; }

    public function getQuartier(): ?string { return $this->quartier; }
    public function setQuartier(?string $quartier): static { $this->quartier = $quartier; return $this; }

    /** @return Collection<int, MediaObject> */
    public function getImages(): Collection
    {
        return $this->images;
    }

    public function addImage(MediaObject $image): static
    {
        if (!$this->images->contains($image)) {
            $this->images->add($image);
            $image->setCentre($this);
        }
        return $this;
    }

    public function removeImage(MediaObject $image): static
    {
        if ($this->images->removeElement($image)) {
            $image->setCentre(null);
        }
        return $this;
    }

    public function getNoteMoyenne(): float
    {
        return $this->noteMoyenne;
    }

    public function setNoteMoyenne(float $noteMoyenne): static
    {
        $this->noteMoyenne = $noteMoyenne;
        return $this;
    }

    public function getTotalAvis(): int
    {
        return $this->totalAvis;
    }

    public function setTotalAvis(int $totalAvis): static
    {
        $this->totalAvis = $totalAvis;
        return $this;
    }

    public function getGooglePlaceId(): ?string
    {
        return $this->googlePlaceId;
    }

    public function setGooglePlaceId(?string $googlePlaceId): static
    {
        $this->googlePlaceId = $googlePlaceId;
        return $this;
    }

    public function getVerificationStatut(): string
    {
        return $this->verificationStatut;
    }

    public function setVerificationStatut(string $verificationStatut): static
    {
        $this->verificationStatut = $verificationStatut;
        return $this;
    }

    public function getSource(): string
    {
        return $this->source;
    }

    public function setSource(string $source): static
    {
        $this->source = $source;
        return $this;
    }

    public function getLastSyncedAt(): ?\DateTimeImmutable
    {
        return $this->lastSyncedAt;
    }

    public function setLastSyncedAt(?\DateTimeImmutable $lastSyncedAt): static
    {
        $this->lastSyncedAt = $lastSyncedAt;
        return $this;
    }

    /**
     * @return array<int, array<string, mixed>>|null
     */
    public function getMedecins(): ?array
    {
        return $this->medecins;
    }

    /**
     * @param array<int, array<string, mixed>>|null $medecins
     */
    public function setMedecins(?array $medecins): static
    {
        $this->medecins = $medecins;
        return $this;
    }

    /** @return Collection<int, AffiliationMedecin> */
    public function getAffiliations(): Collection
    {
        return $this->affiliations;
    }

    public function addAffiliation(AffiliationMedecin $affiliation): static
    {
        if (!$this->affiliations->contains($affiliation)) {
            $this->affiliations->add($affiliation);
            $affiliation->setEtablissement($this);
        }
        return $this;
    }

    public function removeAffiliation(AffiliationMedecin $affiliation): static
    {
        if ($this->affiliations->removeElement($affiliation)) {
            $affiliation->setEtablissement(null);
        }
        return $this;
    }

    /** @return Collection<int, EtablissementEquipe> */
    public function getEquipes(): Collection
    {
        return $this->equipes;
    }

    public function addEquipe(EtablissementEquipe $equipe): static
    {
        if (!$this->equipes->contains($equipe)) {
            $this->equipes->add($equipe);
            $equipe->setEtablissement($this);
        }
        return $this;
    }

    public function removeEquipe(EtablissementEquipe $equipe): static
    {
        if ($this->equipes->removeElement($equipe)) {
            $equipe->setEtablissement(null);
        }
        return $this;
    }
}
