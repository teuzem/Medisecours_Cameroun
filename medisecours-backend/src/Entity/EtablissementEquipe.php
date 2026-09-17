<?php

declare(strict_types=1);

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Annotation\Groups;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * Membre de l'équipe d'un établissement de santé.
 *
 * Gérable par un manager (DIRECTEUR / GESTIONNAIRE) ou un admin depuis
 * le tableau de bord de l'établissement. Permet une gestion des accès
 * par niveau au sein de la hiérarchie de l'établissement.
 *
 * Rôles hiérarchiques :
 *  - DIRECTEUR      : accès complet au tableau de bord, gestion de l'équipe
 *  - GESTIONNAIRE   : gestion quotidienne (SOS, avis, suggestions, équipe)
 *  - MEDECIN        : agenda, disponibilités, consultations rattachées
 *  - INFIRMIER      : prise en charge, suivi des patients
 *  - LECTURE        : consultation seule (lecture seule)
 *
 * NOTE : entité interne au domaine — exposée via l'API /api/carte/equipes
 * (CarteController) pour restreindre l'accès aux managers de l'établissement.
 */
#[ORM\Entity]
class EtablissementEquipe
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: CentreDeSante::class, inversedBy: 'equipes')]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    #[Groups(['etablissement_equipe:read'])]
    private ?CentreDeSante $etablissement = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    #[Groups(['etablissement_equipe:read'])]
    private ?User $user = null;

    #[ORM\Column(length: 30)]
    #[Assert\Choice(choices: ['DIRECTEUR', 'GESTIONNAIRE', 'MEDECIN', 'INFIRMIER', 'LECTURE'])]
    #[Groups(['etablissement_equipe:read'])]
    private string $role = 'LECTURE';

    #[ORM\Column(length: 20, options: ['default' => 'INVITE'])]
    #[Assert\Choice(choices: ['INVITE', 'ACTIF', 'REVOQUE'])]
    #[Groups(['etablissement_equipe:read'])]
    private string $statut = 'INVITE';

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?User $invitePar = null;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column(nullable: true)]
    private ?\DateTimeImmutable $updatedAt = null;

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

    public function getUser(): ?User
    {
        return $this->user;
    }

    public function setUser(?User $user): static
    {
        $this->user = $user;

        return $this;
    }

    public function getRole(): string
    {
        return $this->role;
    }

    public function setRole(string $role): static
    {
        $this->role = $role;

        return $this;
    }

    public function getStatut(): string
    {
        return $this->statut;
    }

    public function setStatut(string $statut): static
    {
        $this->statut = $statut;

        return $this;
    }

    public function getInvitePar(): ?User
    {
        return $this->invitePar;
    }

    public function setInvitePar(?User $invitePar): static
    {
        $this->invitePar = $invitePar;

        return $this;
    }

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function setCreatedAt(\DateTimeImmutable $createdAt): static
    {
        $this->createdAt = $createdAt;

        return $this;
    }

    public function getUpdatedAt(): ?\DateTimeImmutable
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(?\DateTimeImmutable $updatedAt): static
    {
        $this->updatedAt = $updatedAt;

        return $this;
    }

    public function isManager(): bool
    {
        return $this->statut === 'ACTIF' && in_array($this->role, ['DIRECTEUR', 'GESTIONNAIRE'], true);
    }
}