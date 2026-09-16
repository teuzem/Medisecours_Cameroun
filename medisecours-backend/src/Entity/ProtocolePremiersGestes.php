<?php

declare(strict_types=1);

namespace App\Entity;

use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Delete;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Patch;
use ApiPlatform\Metadata\Post;
use App\Repository\ProtocolePremiersGestesRepository;
use App\State\ProtocolePublishedProvider;
use App\State\ProtocoleProcessor;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Annotation\Groups;
use Symfony\Component\Validator\Constraints as Assert;

#[ORM\Entity(repositoryClass: ProtocolePremiersGestesRepository::class)]
#[ORM\UniqueConstraint(name: 'uniq_protocole_slug_version', columns: ['slug', 'version'])]
#[ORM\Index(name: 'idx_protocole_master_variant', columns: ['master_slug', 'variant_key'])]
#[ApiResource(
    operations: [
        new GetCollection(provider: ProtocolePublishedProvider::class),
        new Get(provider: ProtocolePublishedProvider::class),
        new Post(security: "is_granted('ROLE_ADMIN')", processor: ProtocoleProcessor::class),
        new Patch(security: "is_granted('ROLE_ADMIN')", processor: ProtocoleProcessor::class),
        new Delete(security: "is_granted('ROLE_ADMIN')"),
    ],
    normalizationContext: ['groups' => ['protocole:read']],
    denormalizationContext: ['groups' => ['protocole:write']]
)]
class ProtocolePremiersGestes
{
    public const STATUT_BROUILLON = 'BROUILLON';
    public const STATUT_EN_REVUE = 'EN_REVUE';
    public const STATUT_PUBLIE = 'PUBLIE';
    public const STATUT_RETIRE = 'RETIRE';

    #[ORM\Id, ORM\GeneratedValue, ORM\Column]
    #[Groups(['protocole:read'])]
    private ?int $id = null;

    #[ORM\Column(length: 120)]
    #[Assert\NotBlank]
    #[Groups(['protocole:read', 'protocole:write'])]
    private string $slug;

    #[ORM\Column(length: 180)]
    #[Assert\NotBlank]
    #[Groups(['protocole:read', 'protocole:write'])]
    private string $titre;

    #[ORM\Column(length: 180, nullable: true)]
    private ?string $titreEn = null;

    #[ORM\Column(length: 20)]
    #[Assert\Choice(choices: ['BROUILLON', 'EN_REVUE', 'PUBLIE', 'RETIRE'])]
    #[Groups(['protocole:read'])]
    private string $statut = self::STATUT_BROUILLON;

    #[ORM\Column(length: 20)]
    #[Assert\Choice(choices: ['FAIBLE', 'MOYEN', 'ELEVE', 'CRITIQUE'])]
    #[Groups(['protocole:read', 'protocole:write'])]
    private string $niveauUrgence = 'MOYEN';

    #[ORM\Column(length: 20)]
    #[Groups(['protocole:read', 'protocole:write'])]
    private string $population = 'TOUS';

    #[ORM\Column(length: 40)]
    #[Groups(['protocole:read', 'protocole:write'])]
    private string $version = '1.0';

    #[ORM\Column(length: 60, nullable: true)]
    #[Groups(['protocole:read', 'protocole:write'])]
    private ?string $categorie = null;

    #[ORM\Column(length: 120, nullable: true)]
    #[Groups(['protocole:read', 'protocole:write'])]
    private ?string $masterSlug = null;

    #[ORM\Column(length: 40, nullable: true)]
    #[Groups(['protocole:read', 'protocole:write'])]
    private ?string $variantKey = null;

    #[ORM\Column(type: 'text', nullable: true)]
    #[Groups(['protocole:read', 'protocole:write'])]
    private ?string $restrictionsPopulations = null;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $restrictionsPopulationsEn = null;

    #[ORM\Column(type: 'text', nullable: true)]
    #[Groups(['protocole:read', 'protocole:write'])]
    private ?string $sourceClinique = null;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $sourceCliniqueEn = null;

    /** @var Collection<int, ProtocoleEtape> */
    #[ORM\OneToMany(targetEntity: ProtocoleEtape::class, mappedBy: 'protocole', cascade: ['persist', 'remove'], orphanRemoval: true)]
    #[ORM\OrderBy(['position' => 'ASC'])]
    #[Groups(['protocole:read'])]
    private Collection $etapes;

    public function __construct()
    {
        $this->etapes = new ArrayCollection();
    }

    public function getId(): ?int { return $this->id; }
    public function getSlug(): string { return $this->slug; }
    public function setSlug(string $slug): static { $this->slug = $slug; return $this; }
    public function getTitre(): string { return $this->titre; }
    public function setTitre(string $titre): static { $this->titre = $titre; return $this; }
    public function getTitreEn(): ?string { return $this->titreEn; }
    public function setTitreEn(?string $titreEn): static { $this->titreEn = $titreEn; return $this; }
    public function getStatut(): string { return $this->statut; }
    public function setStatut(string $statut): static { $this->statut = $statut; return $this; }
    public function getNiveauUrgence(): string { return $this->niveauUrgence; }
    public function setNiveauUrgence(string $niveau): static { $this->niveauUrgence = $niveau; return $this; }
    public function getPopulation(): string { return $this->population; }
    public function setPopulation(string $population): static { $this->population = $population; return $this; }
    public function getVersion(): string { return $this->version; }
    public function setVersion(string $version): static { $this->version = $version; return $this; }
    public function getCategorie(): ?string { return $this->categorie; }
    public function setCategorie(?string $categorie): static { $this->categorie = $categorie; return $this; }
    public function getMasterSlug(): ?string { return $this->masterSlug; }
    public function setMasterSlug(?string $masterSlug): static { $this->masterSlug = $masterSlug; return $this; }
    public function getVariantKey(): ?string { return $this->variantKey; }
    public function setVariantKey(?string $variantKey): static { $this->variantKey = $variantKey; return $this; }
    public function getRestrictionsPopulations(): ?string { return $this->restrictionsPopulations; }
    public function setRestrictionsPopulations(?string $restrictions): static { $this->restrictionsPopulations = $restrictions; return $this; }
    public function getRestrictionsPopulationsEn(): ?string { return $this->restrictionsPopulationsEn; }
    public function setRestrictionsPopulationsEn(?string $restrictions): static { $this->restrictionsPopulationsEn = $restrictions; return $this; }
    public function getSourceClinique(): ?string { return $this->sourceClinique; }
    public function setSourceClinique(?string $source): static { $this->sourceClinique = $source; return $this; }
    public function getSourceCliniqueEn(): ?string { return $this->sourceCliniqueEn; }
    public function setSourceCliniqueEn(?string $source): static { $this->sourceCliniqueEn = $source; return $this; }
    /** @return Collection<int, ProtocoleEtape> */
    public function getEtapes(): Collection { return $this->etapes; }
    public function addEtape(ProtocoleEtape $etape): static { $this->etapes->add($etape); $etape->setProtocole($this); return $this; }
    public function removeEtape(ProtocoleEtape $etape): static { $this->etapes->removeElement($etape); return $this; }

    public static function compareVersions(string $a, string $b): int
    {
        $partsA = array_map('intval', preg_split('/[.\-_]/', $a) ?: []);
        $partsB = array_map('intval', preg_split('/[.\-_]/', $b) ?: []);
        $max = max(count($partsA), count($partsB));
        for ($i = 0; $i < $max; ++$i) {
            $na = $partsA[$i] ?? 0;
            $nb = $partsB[$i] ?? 0;
            if ($na !== $nb) {
                return $na <=> $nb;
            }
        }

        return 0;
    }

    public function nextVersion(): string
    {
        $parts = preg_split('/[.\-_]/', $this->version) ?: [];
        if ($parts === []) {
            return '1.1';
        }

        $last = (int) array_pop($parts);
        $parts[] = (string) ($last + 1);

        return implode('.', $parts);
    }

    public function duplicateAsNewVersion(): static
    {
        $copy = (new self())
            ->setSlug($this->slug)
            ->setTitre($this->titre)
            ->setTitreEn($this->titreEn)
            ->setNiveauUrgence($this->niveauUrgence)
            ->setPopulation($this->population)
            ->setVersion($this->nextVersion())
            ->setCategorie($this->categorie)
            ->setMasterSlug($this->masterSlug)
            ->setVariantKey($this->variantKey)
            ->setRestrictionsPopulations($this->restrictionsPopulations)
            ->setRestrictionsPopulationsEn($this->restrictionsPopulationsEn)
            ->setSourceClinique($this->sourceClinique)
            ->setSourceCliniqueEn($this->sourceCliniqueEn)
            ->setStatut(self::STATUT_BROUILLON);

        foreach ($this->etapes as $etape) {
            $copy->addEtape(
                (new ProtocoleEtape())
                    ->setPosition($etape->getPosition())
                    ->setType($etape->getType())
                    ->setTitre($etape->getTitre())
                    ->setTitreEn($etape->getTitreEn())
                    ->setInstruction($etape->getInstruction())
                    ->setInstructionEn($etape->getInstructionEn())
            );
        }

        return $copy;
    }
}
