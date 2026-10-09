<?php

declare(strict_types=1);

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Annotation\Groups;

/**
 * Trace d'audit d'une alerte SOS.
 *
 * Chaque transition du cycle de vie (création, vérification, sirène,
 * prise en charge, clôture…) laisse une trace horodatée immuable :
 * qui, quoi, quand, et le contexte (détails JSON).
 *
 * Entité interne — exposée uniquement via l'API custom /api/sos/{id}/traces
 * (restreinte au demandeur, à l'équipe de l'établissement et aux admins).
 */
#[ORM\Entity]
#[ORM\Table(name: 'sos_trace')]
#[ORM\Index(name: 'IDX_SOS_TRACE_SOS', columns: ['sos_id'])]
#[ORM\Index(name: 'IDX_SOS_TRACE_CREATED', columns: ['created_at'])]
class SosTrace
{
    public const ACTION_CREEE = 'CREEE';
    public const ACTION_ENVOYEE = 'ENVOYEE_ETABLISSEMENT';
    public const ACTION_CONFIRMEE = 'CONFIRMEE_REELLE';
    public const ACTION_FRAUDULEUSE = 'MARQUEE_FRAUDULEUSE';
    public const ACTION_SIRENE_ACTIVEE = 'SIRENE_ACTIVEE';
    public const ACTION_SIRENE_ETEINTE = 'SIRENE_ETEINTE';
    public const ACTION_PRISE_EN_CHARGE = 'PRISE_EN_CHARGE';
    public const ACTION_TRAITEE = 'TRAITEE';
    public const ACTION_CLOTUREE = 'CLOTUREE';

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: DemandeSos::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private ?DemandeSos $sos = null;

    #[ORM\Column(length: 40)]
    private string $action = self::ACTION_CREEE;

    /**
     * Auteur de l'action (null = système).
     */
    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?User $auteur = null;

    /**
     * Contexte libre : habilitation, commentaire, ip, decision…
     */
    #[ORM\Column(type: 'json', nullable: true)]
    private ?array $details = null;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getSos(): ?DemandeSos
    {
        return $this->sos;
    }

    public function setSos(?DemandeSos $sos): static
    {
        $this->sos = $sos;

        return $this;
    }

    public function getAction(): string
    {
        return $this->action;
    }

    public function setAction(string $action): static
    {
        $this->action = $action;

        return $this;
    }

    public function getAuteur(): ?User
    {
        return $this->auteur;
    }

    public function setAuteur(?User $auteur): static
    {
        $this->auteur = $auteur;

        return $this;
    }

    public function getDetails(): ?array
    {
        return $this->details;
    }

    public function setDetails(?array $details): static
    {
        $this->details = $details;

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
}
