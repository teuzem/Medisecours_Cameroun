<?php

namespace App\Entity;

use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Post;
use ApiPlatform\Metadata\Patch;
use ApiPlatform\Metadata\Delete;
use ApiPlatform\Doctrine\Orm\Filter\SearchFilter;
use ApiPlatform\Doctrine\Orm\Filter\OrderFilter;
use ApiPlatform\Metadata\ApiFilter;
use App\Repository\PremierSoinRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Annotation\Groups;
use Symfony\Component\Validator\Constraints as Assert;

#[ORM\Entity(repositoryClass: PremierSoinRepository::class)]
#[ApiResource(
    operations: [
        new GetCollection(),
        new Get(),
        new Post(security: "is_granted('ROLE_ADMIN')"),
        new Patch(security: "is_granted('ROLE_ADMIN')"),
        new Delete(security: "is_granted('ROLE_ADMIN')")
    ],
    normalizationContext: ['groups' => ['premier_soin:read']],
    denormalizationContext: ['groups' => ['premier_soin:write']],
    paginationEnabled: true,
    paginationItemsPerPage: 30,
    paginationMaximumItemsPerPage: 100
)]
#[ApiFilter(SearchFilter::class, properties: [
    'titre'         => 'partial',
    'description'   => 'partial',
    'maladie'       => 'exact',
    'niveauUrgence' => 'exact',
])]
#[ApiFilter(OrderFilter::class, properties: ['niveauUrgence', 'titre'])]
class PremierSoin
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['premier_soin:read', 'maladie:read'])]
    private ?int $id = null;

    #[ORM\Column(length: 255)]
    #[Assert\NotBlank(message: 'Le titre est obligatoire')]
    #[Assert\Length(min: 3, max: 255, minMessage: 'Le titre doit contenir au moins {{ limit }} caractères', maxMessage: 'Le titre ne peut pas dépasser {{ limit }} caractères')]
    #[Groups(['premier_soin:read', 'premier_soin:write', 'maladie:read'])]
    private ?string $titre = null;

    #[ORM\Column(length: 255, nullable: true)]
    private ?string $titreEn = null;

    #[ORM\Column(type: Types::TEXT)]
    #[Assert\NotBlank(message: 'La description est obligatoire')]
    #[Assert\Length(min: 10, max: 10000, minMessage: 'La description doit contenir au moins {{ limit }} caractères', maxMessage: 'La description ne peut pas dépasser {{ limit }} caractères')]
    #[Groups(['premier_soin:read', 'premier_soin:write', 'maladie:read'])]
    private ?string $description = null;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    private ?string $descriptionEn = null;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    #[Assert\Length(max: 10000, maxMessage: 'Les symptômes ne peuvent pas dépasser {{ limit }} caractères')]
    #[Groups(['premier_soin:read', 'premier_soin:write', 'maladie:read'])]
    private ?string $symptomes = null;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    private ?string $symptomesEn = null;

    #[ORM\Column(length: 50)]
    #[Assert\NotBlank(message: 'Le niveau d\'urgence est obligatoire')]
    #[Assert\Choice(
        choices: ['FAIBLE', 'MOYEN', 'ÉLEVÉ', 'CRITIQUE'],
        message: 'Valeur invalide. Choix possibles : FAIBLE, MOYEN, ÉLEVÉ, CRITIQUE.'
    )]
    #[Groups(['premier_soin:read', 'premier_soin:write', 'maladie:read'])]
    private ?string $niveauUrgence = null;

    #[ORM\ManyToOne(inversedBy: 'premiersSoins')]
    #[Groups(['premier_soin:read', 'premier_soin:write'])]
    private ?Maladie $maladie = null;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getTitre(): ?string
    {
        return $this->titre;
    }

    public function setTitre(string $titre): static
    {
        $this->titre = $titre;

        return $this;
    }

    public function getTitreEn(): ?string
    {
        return $this->titreEn;
    }

    public function setTitreEn(?string $titreEn): static
    {
        $this->titreEn = $titreEn;

        return $this;
    }

    public function getDescription(): ?string
    {
        return $this->description;
    }

    public function setDescription(string $description): static
    {
        $this->description = $description;

        return $this;
    }

    public function getDescriptionEn(): ?string
    {
        return $this->descriptionEn;
    }

    public function setDescriptionEn(?string $descriptionEn): static
    {
        $this->descriptionEn = $descriptionEn;

        return $this;
    }

    public function getSymptomes(): ?string
    {
        return $this->symptomes;
    }

    public function setSymptomes(?string $symptomes): static // Modifié : accepte la chaîne ou null
    {
        $this->symptomes = $symptomes;

        return $this;
    }

    public function getSymptomesEn(): ?string
    {
        return $this->symptomesEn;
    }

    public function setSymptomesEn(?string $symptomesEn): static
    {
        $this->symptomesEn = $symptomesEn;

        return $this;
    }

    public function getNiveauUrgence(): ?string
    {
        return $this->niveauUrgence;
    }

    public function setNiveauUrgence(string $niveauUrgence): static
    {
        $this->niveauUrgence = $niveauUrgence;

        return $this;
    }

    public function getMaladie(): ?Maladie
    {
        return $this->maladie;
    }

    public function setMaladie(?Maladie $maladie): static
    {
        $this->maladie = $maladie;

        return $this;
    }

    public function getMaladieNom(): ?string
    {
        return $this->maladie?->getNom();
    }
}
