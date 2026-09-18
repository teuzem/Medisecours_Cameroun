<?php

declare(strict_types=1);

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Annotation\Groups;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * Compte "Établissement" — manager d'un centre de santé.
 *
 * Lorsqu'un manager réclame son établissement (POST /api/carte/revendiquer),
 * une ligne EtablissementEquipe (rôle DIRECTEUR) le rattache au centre géré.
 *
 * Rôle unique : ROLE_ETABLISSEMENT (accessible via l'espace /espace-etablissement).
 */
#[ORM\Entity]
class EtablissementManager extends User
{
    /**
     * Nom de l'établissement géré (saisi à l'inscription, avant réclamation).
     */
    #[ORM\Column(length: 255, nullable: true)]
    #[Assert\Length(max: 255, maxMessage: "Le nom de l'établissement ne peut pas dépasser {{ limit }} caractères")]
    #[Groups(['user:read'])]
    private ?string $etablissementNom = null;

    /**
     * Fonction au sein de la structure (directeur, gestionnaire, administrateur…).
     */
    #[ORM\Column(length: 120, nullable: true)]
    #[Assert\Length(max: 120, maxMessage: 'La fonction ne peut pas dépasser {{ limit }} caractères')]
    #[Groups(['user:read'])]
    private ?string $fonction = null;

    public function getRoles(): array
    {
        return array_unique([...parent::getRoles(), 'ROLE_ETABLISSEMENT']);
    }

    public function getEtablissementNom(): ?string
    {
        return $this->etablissementNom;
    }

    public function setEtablissementNom(?string $etablissementNom): static
    {
        $this->etablissementNom = $etablissementNom;

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
}