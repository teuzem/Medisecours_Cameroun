<?php

namespace App\Entity;

use ApiPlatform\Doctrine\Orm\Filter\SearchFilter;
use ApiPlatform\Doctrine\Orm\Filter\OrderFilter;
use ApiPlatform\Metadata\ApiFilter;
use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Delete;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Patch;
use ApiPlatform\Metadata\Post;
use App\Repository\ConsultationRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Annotation\Groups;
use Symfony\Component\Validator\Constraints as Assert;

#[ORM\Entity(repositoryClass: ConsultationRepository::class)]
#[ApiFilter(SearchFilter::class, properties: ['statut' => 'exact'])]
#[ApiFilter(OrderFilter::class, properties: ['createdAt', 'id'])]
#[ApiResource(
    operations: [
        new GetCollection(),
        new Get(security: "is_granted('ROLE_ADMIN') or object.getPatient() == user or object.getMedecin() == user or (is_granted('ROLE_MEDECIN') and object.getMedecin() == null)"),
        new Post(security: "is_granted('ROLE_PATIENT')", processor: \App\State\ConsultationProcessor::class),
        new Patch(security: "is_granted('ROLE_ADMIN') or object.getPatient() == user or object.getMedecin() == user or (is_granted('ROLE_MEDECIN') and object.getMedecin() == null)", processor: \App\State\ConsultationProcessor::class),
        new Delete(security: "is_granted('ROLE_ADMIN') or object.getPatient() == user or object.getMedecin() == user")
    ],
    normalizationContext: ['groups' => ['consultation:read']],
    denormalizationContext: ['groups' => ['consultation:write']],
    order: ['createdAt' => 'DESC', 'id' => 'DESC'],
    paginationEnabled: true,
    paginationItemsPerPage: 30,
    paginationMaximumItemsPerPage: 100
)]
class Consultation
{
    public const STATUT_OUVERTE = 'OUVERTE';
    public const STATUT_EN_COURS = 'EN_COURS';
    public const STATUT_TERMINEE = 'TERMINEE';
    public const STATUT_ANNULEE = 'ANNULEE';

    public const PRIORITE_NORMALE = 'NORMALE';
    public const PRIORITE_URGENTE = 'URGENTE';
    public const PRIORITE_CRITIQUE = 'CRITIQUE';

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['consultation:read', 'message:read', 'prescription:read'])]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: Patient::class)]
    #[ORM\JoinColumn(nullable: false)]
    #[Groups(['consultation:read'])]
    private ?Patient $patient = null;

    #[ORM\ManyToOne(targetEntity: Medecin::class)]
    #[ORM\JoinColumn(nullable: true)]
    #[Groups(['consultation:read', 'consultation:write', 'message:read'])]
    private ?Medecin $medecin = null;

    #[ORM\Column(length: 30)]
    #[Assert\Choice(choices: [
        self::STATUT_OUVERTE,
        self::STATUT_EN_COURS,
        self::STATUT_TERMINEE,
        self::STATUT_ANNULEE,
    ])]
    #[Groups(['consultation:read', 'consultation:write', 'prescription:read'])]
    private string $statut = self::STATUT_OUVERTE;

    #[ORM\Column(length: 255, nullable: true)]
    #[Assert\Length(max: 255)]
    #[Groups(['consultation:read', 'consultation:write'])]
    private ?string $motif = null;

    #[ORM\Column]
    #[Groups(['consultation:read', 'prescription:read'])]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column(nullable: true)]
    #[Groups(['consultation:read'])]
    private ?\DateTimeImmutable $closedAt = null;

    #[ORM\Column(nullable: true)]
    #[Groups(['consultation:read', 'consultation:write', 'prescription:read'])]
    private ?\DateTimeImmutable $dateConsultation = null;

    #[ORM\Column(length: 20, options: ['default' => 'NORMALE'])]
    #[Assert\Choice(choices: [
        self::PRIORITE_NORMALE,
        self::PRIORITE_URGENTE,
        self::PRIORITE_CRITIQUE,
    ])]
    #[Groups(['consultation:read', 'consultation:write'])]
    private string $priorite = self::PRIORITE_NORMALE;

    #[ORM\Column(type: 'text', nullable: true)]
    #[Groups(['consultation:read', 'consultation:write'])]
    private ?string $compteRendu = null;

    /**
     * Messages liés à cette consultation.
     *
     * NON inclus dans la sérialisation par défaut pour éviter le chargement eager
     * de centaines de messages. Utiliser GET /api/messages?consultation={id} à la place.
     *
     * @var Collection<int, Message>
     */
    #[ORM\OneToMany(targetEntity: Message::class, mappedBy: 'consultation', cascade: ['remove'])]
    private Collection $messages;

    /**
     * @var Collection<int, Prescription>
     */
    #[ORM\OneToMany(targetEntity: Prescription::class, mappedBy: 'consultation', cascade: ['remove'])]
    #[Groups(['consultation:read'])]
    private Collection $prescriptions;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable();
        $this->messages = new ArrayCollection();
        $this->prescriptions = new ArrayCollection();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getPatient(): ?Patient
    {
        return $this->patient;
    }

    public function setPatient(?Patient $patient): static
    {
        $this->patient = $patient;

        return $this;
    }

    public function getMedecin(): ?Medecin
    {
        return $this->medecin;
    }

    public function setMedecin(?Medecin $medecin): static
    {
        $this->medecin = $medecin;

        return $this;
    }

    public function getStatut(): string
    {
        return $this->statut;
    }

    public function setStatut(string $statut): static
    {
        $this->statut = $statut;
        $this->closedAt = $statut === self::STATUT_TERMINEE ? new \DateTimeImmutable() : null;

        return $this;
    }

    public function getMotif(): ?string
    {
        return $this->motif;
    }

    public function setMotif(?string $motif): static
    {
        $this->motif = $motif;

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

    public function getClosedAt(): ?\DateTimeImmutable
    {
        return $this->closedAt;
    }

    public function setClosedAt(?\DateTimeImmutable $closedAt): static
    {
        $this->closedAt = $closedAt;

        return $this;
    }

    public function getDateConsultation(): ?\DateTimeImmutable
    {
        return $this->dateConsultation;
    }

    public function setDateConsultation(?\DateTimeImmutable $dateConsultation): static
    {
        $this->dateConsultation = $dateConsultation;

        return $this;
    }

    public function getPriorite(): string
    {
        return $this->priorite;
    }

    public function setPriorite(string $priorite): static
    {
        $this->priorite = $priorite;

        return $this;
    }

    public function getCompteRendu(): ?string
    {
        return $this->compteRendu;
    }

    public function setCompteRendu(?string $compteRendu): static
    {
        $this->compteRendu = $compteRendu;

        return $this;
    }

    /**
     * @return Collection<int, Message>
     */
    public function getMessages(): Collection
    {
        return $this->messages;
    }

    public function addMessage(Message $message): static
    {
        if (!$this->messages->contains($message)) {
            $this->messages->add($message);
            $message->setConsultation($this);
        }

        return $this;
    }

    public function removeMessage(Message $message): static
    {
        if ($this->messages->removeElement($message) && $message->getConsultation() === $this) {
            $message->setConsultation(null);
        }

        return $this;
    }

    /**
     * @return Collection<int, Prescription>
     */
    public function getPrescriptions(): Collection
    {
        return $this->prescriptions;
    }

    public function addPrescription(Prescription $prescription): static
    {
        if (!$this->prescriptions->contains($prescription)) {
            $this->prescriptions->add($prescription);
            $prescription->setConsultation($this);
        }

        return $this;
    }

    public function removePrescription(Prescription $prescription): static
    {
        if ($this->prescriptions->removeElement($prescription) && $prescription->getConsultation() === $this) {
            $prescription->setConsultation(null);
        }

        return $this;
    }
}
