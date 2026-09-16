<?php

declare(strict_types=1);

namespace App\Entity;

use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Get;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Annotation\Groups;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * Profil patient.
 *
 * allergies       : tableau JSON de chaînes (ex: ["Pénicilline", "Latex"])
 *                   Structuré pour permettre un filtrage futur côté backend.
 *
 * contactsUrgence : tableau JSON d'objets {nom, telephone, lien}
 *                   (ex: [{"nom": "Marie Dupont", "telephone": "+237 677000000", "lien": "Mère"}])
 *                   Données critiques en situation d'urgence médicale.
 */
#[ORM\Entity]
#[ApiResource(
    operations: [
        // GET /api/patients/{id} — le patient lui-même, son médecin, ou admin
        new Get(
            security: "is_granted('ROLE_ADMIN') or object == user",
        ),
    ],
    normalizationContext: ['groups' => ['user:search']],
)]
class Patient extends User
{
    #[ORM\Column(length: 10, nullable: true)]
    #[Assert\Length(max: 10, maxMessage: 'Le groupe sanguin ne peut pas dépasser {{ limit }} caractères')]
    #[Assert\Regex(
        pattern: '/^(A|B|AB|O)[+-]$/',
        message: 'Format groupe sanguin invalide. Exemples valides : A+, O-, AB+'
    )]
    #[Groups(['user:read', 'user:write'])]
    private ?string $groupeSanguin = null;

    /**
     * Liste JSON des allergies connues.
     * Format : ["Pénicilline", "Aspirine", "Latex"]
     *
     * Stocké en JSON pour permettre un filtrage et une exploitation
     * médicale structurée (ex: alertes croisées avec prescriptions).
     */
    #[ORM\Column(type: 'json', nullable: true)]
    #[Groups(['user:read', 'user:write'])]
    private ?array $allergies = null;

    /**
     * Contacts d'urgence structurés.
     * Format : [{"nom": "Marie Dupont", "telephone": "+237 677000000", "lien": "Mère"}]
     *
     * La structure permet d'afficher et d'appeler directement depuis l'app,
     * et de valider le numéro de téléphone de chaque contact.
     */
    #[ORM\Column(type: 'json', nullable: true)]
    #[Groups(['user:read', 'user:write'])]
    private ?array $contactsUrgence = null;

    /** @see UserInterface */
    public function getRoles(): array
    {
        return array_unique([...parent::getRoles(), 'ROLE_PATIENT']);
    }

    public function getGroupeSanguin(): ?string
    {
        return $this->groupeSanguin;
    }

    public function setGroupeSanguin(?string $groupeSanguin): static
    {
        $this->groupeSanguin = $groupeSanguin;

        return $this;
    }

    /**
     * @return string[]|null
     */
    public function getAllergies(): ?array
    {
        return $this->allergies;
    }

    /**
     * @param string[]|null $allergies
     */
    public function setAllergies(?array $allergies): static
    {
        $this->allergies = $allergies;

        return $this;
    }

    /**
     * Ajoute une allergie si elle n'existe pas déjà.
     */
    public function addAllergie(string $allergie): static
    {
        $this->allergies ??= [];
        if (!in_array($allergie, $this->allergies, true)) {
            $this->allergies[] = $allergie;
        }

        return $this;
    }

    /**
     * @return array<array{nom: string, telephone: string, lien?: string}>|null
     */
    public function getContactsUrgence(): ?array
    {
        return $this->contactsUrgence;
    }

    /**
     * @param array<array{nom: string, telephone: string, lien?: string}>|null $contactsUrgence
     */
    public function setContactsUrgence(?array $contactsUrgence): static
    {
        $this->contactsUrgence = $contactsUrgence;

        return $this;
    }
}
