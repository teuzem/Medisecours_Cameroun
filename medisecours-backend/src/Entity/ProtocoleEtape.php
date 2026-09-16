<?php

declare(strict_types=1);

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Annotation\Groups;

#[ORM\Entity]
class ProtocoleEtape
{
    #[ORM\Id, ORM\GeneratedValue, ORM\Column]
    #[Groups(['protocole:read'])]
    private ?int $id = null;
    #[ORM\ManyToOne(targetEntity: ProtocolePremiersGestes::class, inversedBy: 'etapes')]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private ?ProtocolePremiersGestes $protocole = null;
    #[ORM\Column]
    #[Groups(['protocole:read'])]
    private int $position = 1;
    #[ORM\Column(length: 20)]
    #[Groups(['protocole:read'])]
    private string $type = 'FAIRE';
    #[ORM\Column(length: 160, nullable: true)]
    #[Groups(['protocole:read'])]
    private ?string $titre = null;

    #[ORM\Column(length: 160, nullable: true)]
    private ?string $titreEn = null;

    #[ORM\Column(type: 'text')]
    #[Groups(['protocole:read'])]
    private string $instruction;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $instructionEn = null;

    public function setProtocole(ProtocolePremiersGestes $protocole): static { $this->protocole = $protocole; return $this; }
    public function setPosition(int $position): static { $this->position = $position; return $this; }
    public function setType(string $type): static { $this->type = $type; return $this; }
    public function setTitre(?string $titre): static { $this->titre = $titre; return $this; }
    public function setTitreEn(?string $titreEn): static { $this->titreEn = $titreEn; return $this; }
    public function setInstruction(string $instruction): static { $this->instruction = $instruction; return $this; }
    public function setInstructionEn(?string $instructionEn): static { $this->instructionEn = $instructionEn; return $this; }
    public function getPosition(): int { return $this->position; }
    public function getType(): string { return $this->type; }
    public function getTitre(): ?string { return $this->titre; }
    public function getTitreEn(): ?string { return $this->titreEn; }
    public function getInstruction(): string { return $this->instruction; }
    public function getInstructionEn(): ?string { return $this->instructionEn; }
}
