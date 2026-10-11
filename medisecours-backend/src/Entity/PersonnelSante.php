<?php

declare(strict_types=1);

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Annotation\Groups;

/**
 * Personnel d'établissement de santé (hors médecins) : réceptionniste,
 * infirmier(IDE), aide-soignant(AS), pharmacien. Filière STI sur `user`.
 *
 * L'accès opérationnel exige statutValidation = VALIDE (pièces validées
 * par le manager de l'établissement) ET une adhésion ACTIF dans
 * etablissement_equipe — double verrou pour éviter tout accès fantôme.
 */
#[ORM\Entity]
class PersonnelSante extends User
{
    public const TYPE_RECEPTIONNISTE = 'RECEPTIONNISTE';
    public const TYPE_INFIRMIER = 'INFIRMIER';
    public const TYPE_AIDE_SOIGNANT = 'AIDE_SOIGNANT';
    public const TYPE_PHARMACIEN = 'PHARMACIEN';

    public const TYPES = [self::TYPE_RECEPTIONNISTE, self::TYPE_INFIRMIER, self::TYPE_AIDE_SOIGNANT, self::TYPE_PHARMACIEN];

    public const VALIDATION_EN_ATTENTE = 'EN_ATTENTE';
    public const VALIDATION_VALIDE = 'VALIDE';
    public const VALIDATION_REJETE = 'REJETE';

    /** Rôles équipe correspondant à chaque type de personnel. */
    public const ROLE_EQUIPE_MAP = [
        self::TYPE_RECEPTIONNISTE => 'RECEPTIONNISTE',
        self::TYPE_INFIRMIER => 'INFIRMIER',
        self::TYPE_AIDE_SOIGNANT => 'AIDE_SOIGNANT',
        self::TYPE_PHARMACIEN => 'PHARMACIEN',
    ];

    #[ORM\Column(length: 30)]
    private string $typePersonnel = self::TYPE_RECEPTIONNISTE;

    #[ORM\ManyToOne(targetEntity: CentreDeSante::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?CentreDeSante $etablissement = null;

    #[ORM\Column(length: 150, nullable: true)]
    private ?string $fonction = null;

    #[ORM\Column(length: 60, nullable: true)]
    private ?string $numeroOrdre = null;

    #[ORM\Column(length: 20, options: ['default' => 'EN_ATTENTE'])]
    private string $statutValidation = self::VALIDATION_EN_ATTENTE;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $validationMotif = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?User $validatedBy = null;

    #[ORM\Column(nullable: true)]
    private ?\DateTimeImmutable $validatedAt = null;

    /** @see UserInterface */
    public function getRoles(): array
    {
        return array_unique([...parent::getRoles(), 'ROLE_PERSONNEL']);
    }

    public function estValide(): bool
    {
        return $this->statutValidation === self::VALIDATION_VALIDE;
    }

    public function getTypePersonnel(): string
    {
        return $this->typePersonnel;
    }

    public function setTypePersonnel(string $typePersonnel): static
    {
        $this->typePersonnel = $typePersonnel;

        return $this;
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

    public function getFonction(): ?string
    {
        return $this->fonction;
    }

    public function setFonction(?string $fonction): static
    {
        $this->fonction = $fonction;

        return $this;
    }

    public function getNumeroOrdre(): ?string
    {
        return $this->numeroOrdre;
    }

    public function setNumeroOrdre(?string $numeroOrdre): static
    {
        $this->numeroOrdre = $numeroOrdre;

        return $this;
    }

    public function getStatutValidation(): string
    {
        return $this->statutValidation;
    }

    public function setStatutValidation(string $statutValidation): static
    {
        $this->statutValidation = $statutValidation;

        return $this;
    }

    public function getValidationMotif(): ?string
    {
        return $this->validationMotif;
    }

    public function setValidationMotif(?string $validationMotif): static
    {
        $this->validationMotif = $validationMotif;

        return $this;
    }

    public function getValidatedBy(): ?User
    {
        return $this->validatedBy;
    }

    public function setValidatedBy(?User $validatedBy): static
    {
        $this->validatedBy = $validatedBy;

        return $this;
    }

    public function getValidatedAt(): ?\DateTimeImmutable
    {
        return $this->validatedAt;
    }

    public function setValidatedAt(?\DateTimeImmutable $validatedAt): static
    {
        $this->validatedAt = $validatedAt;

        return $this;
    }
}
