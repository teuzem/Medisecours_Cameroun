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
        new Get(),
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

    /** @var Collection<int, MediaObject> */
    #[ORM\OneToMany(targetEntity: MediaObject::class, mappedBy: 'centre', cascade: ['persist', 'remove'])]
    #[Groups(['centre_sante:read'])]
    private Collection $images;

    public function __construct()
    {
        $this->images = new ArrayCollection();
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
}
