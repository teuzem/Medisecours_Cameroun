<?php

declare(strict_types=1);

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Annotation\Groups;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * Profil médecin.
 *
 * disponibilites : tableau JSON de créneaux horaires structurés.
 * Format :
 * [
 *   {"jour": "lundi",    "debut": "08:00", "fin": "17:00"},
 *   {"jour": "mercredi", "debut": "08:00", "fin": "13:00"},
 *   {"jour": "vendredi", "debut": "08:00", "fin": "17:00"}
 * ]
 *
 * Ce format permet :
 * - Affichage d'un tableau de disponibilités lisible
 * - Filtrage futur "médecins disponibles aujourd'hui"
 * - Calcul d'horaires restants dans la journée
 *
 * On conserve aussi un champ texte libre `disponibilitesTexte` pour
 * la migration progressive depuis l'ancien format string.
 */
#[ORM\Entity]
class Medecin extends User
{
    #[ORM\Column(length: 255, nullable: true)]
    #[Assert\Length(max: 255, maxMessage: 'La spécialité ne peut pas dépasser {{ limit }} caractères')]
    #[Groups(['user:read', 'user:write', 'prescription:read'])]
    private ?string $specialite = null;

    #[ORM\Column(length: 100, nullable: true)]
    #[Assert\Length(max: 100, maxMessage: 'Le numéro d\'ordre ne peut pas dépasser {{ limit }} caractères')]
    #[Groups(['user:read', 'user:write'])]
    private ?string $numeroOrdre = null;

    #[ORM\Column(type: 'boolean', options: ['default' => false])]
    #[Groups(['user:read'])]
    private bool $estValide = false;

    #[ORM\Column(length: 20, nullable: true)]
    private ?string $typePieceIdentite = null;

    #[ORM\OneToOne(targetEntity: MediaObject::class, cascade: ['persist'])]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?MediaObject $pieceIdentite = null;

    #[ORM\OneToOne(targetEntity: MediaObject::class, cascade: ['persist'])]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?MediaObject $pieceIdentiteVerso = null;

    #[ORM\OneToOne(targetEntity: MediaObject::class, cascade: ['persist'])]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?MediaObject $photoVerificationIdentite = null;

    /**
     * Disponibilités structurées en JSON.
     * Format : [{"jour": "lundi", "debut": "08:00", "fin": "17:00"}]
     * Jours valides : lundi, mardi, mercredi, jeudi, vendredi, samedi, dimanche
     */
    #[ORM\Column(type: 'json', nullable: true)]
    #[Groups(['user:read', 'user:write'])]
    private ?array $disponibilites = null;

    /**
     * Description libre des disponibilités (champ héritage pour migration).
     * Utilisé si disponibilites JSON est null.
     * Ex : "Lundi-Vendredi 08h-17h, samedi matin"
     */
    #[ORM\Column(type: 'text', nullable: true)]
    #[Groups(['user:read', 'user:write'])]
    private ?string $disponibilitesTexte = null;

    /** @see UserInterface */
    public function getRoles(): array
    {
        return array_unique([...parent::getRoles(), 'ROLE_MEDECIN']);
    }

    public function getSpecialite(): ?string
    {
        return $this->specialite;
    }

    public function setSpecialite(?string $specialite): static
    {
        $this->specialite = $specialite;

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

    public function isEstValide(): bool
    {
        return $this->estValide;
    }

    public function setEstValide(bool $estValide): static
    {
        $this->estValide = $estValide;

        return $this;
    }

    public function getTypePieceIdentite(): ?string
    {
        return $this->typePieceIdentite;
    }

    public function setTypePieceIdentite(?string $typePieceIdentite): static
    {
        $this->typePieceIdentite = $typePieceIdentite;

        return $this;
    }

    public function getPieceIdentite(): ?MediaObject
    {
        return $this->pieceIdentite;
    }

    public function setPieceIdentite(?MediaObject $pieceIdentite): static
    {
        $this->pieceIdentite = $pieceIdentite;

        return $this;
    }

    public function getPieceIdentiteVerso(): ?MediaObject
    {
        return $this->pieceIdentiteVerso;
    }

    public function setPieceIdentiteVerso(?MediaObject $pieceIdentiteVerso): static
    {
        $this->pieceIdentiteVerso = $pieceIdentiteVerso;

        return $this;
    }

    public function getPhotoVerificationIdentite(): ?MediaObject
    {
        return $this->photoVerificationIdentite;
    }

    public function setPhotoVerificationIdentite(?MediaObject $photoVerificationIdentite): static
    {
        $this->photoVerificationIdentite = $photoVerificationIdentite;

        return $this;
    }

    public function hasCompleteIdentityVerificationFile(): bool
    {
        if (!in_array($this->typePieceIdentite, ['CNI', 'PASSPORT'], true)) {
            return false;
        }

        return $this->pieceIdentite !== null
            && $this->photoVerificationIdentite !== null
            && ($this->typePieceIdentite !== 'CNI' || $this->pieceIdentiteVerso !== null);
    }

    /**
     * @return array<array{jour: string, debut: string, fin: string}>|null
     */
    public function getDisponibilites(): ?array
    {
        return $this->disponibilites;
    }

    /**
     * @param array<array{jour: string, debut: string, fin: string}>|null $disponibilites
     */
    public function setDisponibilites(?array $disponibilites): static
    {
        $this->disponibilites = $disponibilites;

        return $this;
    }

    public function getDisponibilitesTexte(): ?string
    {
        return $this->disponibilitesTexte;
    }

    public function setDisponibilitesTexte(?string $disponibilitesTexte): static
    {
        $this->disponibilitesTexte = $disponibilitesTexte;

        return $this;
    }

    /**
     * Retourne une représentation lisible des disponibilités.
     * Utilise le JSON structuré si disponible, sinon le texte libre.
     */
    public function getDisponibilitesLabel(): string
    {
        if (!empty($this->disponibilites)) {
            $jours = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
            $disponibilites = $this->disponibilites;
            usort($disponibilites, fn($a, $b) =>
                array_search($a['jour'], $jours) - array_search($b['jour'], $jours)
            );
            return implode(', ', array_map(
                fn($d) => ucfirst($d['jour']) . ' ' . $d['debut'] . '-' . $d['fin'],
                $disponibilites
            ));
        }

        return $this->disponibilitesTexte ?? 'Non renseignées';
    }

    /**
     * Vérifie si le médecin est disponible à un moment donné.
     */
    public function isDisponibleMaintenant(): bool
    {
        if (empty($this->disponibilites)) {
            return false; // Pas de données structurées → indéterminé
        }

        $now   = new \DateTimeImmutable('now', new \DateTimeZone('Africa/Douala'));
        $jourFr = ['Sunday' => 'dimanche', 'Monday' => 'lundi', 'Tuesday' => 'mardi',
                   'Wednesday' => 'mercredi', 'Thursday' => 'jeudi', 'Friday' => 'vendredi',
                   'Saturday' => 'samedi'];
        $jourActuel = $jourFr[$now->format('l')];
        $heureActuelle = $now->format('H:i');

        foreach ($this->disponibilites as $creneau) {
            if (($creneau['jour'] ?? '') === $jourActuel
                && $heureActuelle >= ($creneau['debut'] ?? '00:00')
                && $heureActuelle <= ($creneau['fin'] ?? '00:00')
            ) {
                return true;
            }
        }

        return false;
    }
}
