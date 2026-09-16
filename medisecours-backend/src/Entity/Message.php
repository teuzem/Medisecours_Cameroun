<?php

namespace App\Entity;

use ApiPlatform\Doctrine\Orm\Filter\OrderFilter;
use ApiPlatform\Doctrine\Orm\Filter\SearchFilter;
use ApiPlatform\Metadata\ApiFilter;
use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Post;
use App\Repository\MessageRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Annotation\Groups;
use Symfony\Component\Validator\Constraints as Assert;
use Gedmo\Mapping\Annotation as Gedmo;

#[ORM\Entity(repositoryClass: MessageRepository::class)]
#[Gedmo\SoftDeleteable(fieldName: 'deletedAt', timeAware: false)]
#[ApiFilter(SearchFilter::class, properties: ['conversation' => 'exact'])]
#[ApiFilter(OrderFilter::class, properties: ['createdAt', 'id'])]
#[ApiResource(
    operations: [
        new GetCollection(),
        new Get(security: "is_granted('ROLE_ADMIN') or object.getExpediteur() == user or object.getConversation().getParticipants().contains(user)"),
        new Post(processor: \App\State\MessageProcessor::class),
    ],
    normalizationContext: ['groups' => ['message:read']],
    denormalizationContext: ['groups' => ['message:create']],
    paginationEnabled: true,
    paginationItemsPerPage: 100,
    paginationMaximumItemsPerPage: 200,
    order: ['createdAt' => 'DESC', 'id' => 'DESC']
)]
class Message
{
    public const STATUT_ENVOYE = 'ENVOYE';
    public const STATUT_LIVRE = 'LIVRE';
    public const STATUT_LU = 'LU';

    public const TYPE_TEXTE = 'TEXTE';
    public const TYPE_VOIX = 'VOIX';
    public const TYPE_IMAGE = 'IMAGE';
    public const TYPE_VIDEO = 'VIDEO';
    public const TYPE_FICHIER = 'FICHIER';

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['message:read', 'conversation:read'])]
    private ?int $id = null;

    #[ORM\Column(type: Types::TEXT)]
    #[Assert\Length(max: 10000)]
    #[Groups(['message:read', 'message:create', 'conversation:read'])]
    private ?string $contenu = null;

    #[ORM\Column(length: 20)]
    #[Assert\Choice(choices: [self::STATUT_ENVOYE, self::STATUT_LIVRE, self::STATUT_LU])]
    #[Groups(['message:read', 'conversation:read'])]
    private string $statut = self::STATUT_ENVOYE;

    #[ORM\Column(length: 20)]
    #[Assert\Choice(choices: [self::TYPE_TEXTE, self::TYPE_VOIX, self::TYPE_IMAGE, self::TYPE_VIDEO, self::TYPE_FICHIER])]
    #[Groups(['message:read', 'message:create', 'conversation:read'])]
    private string $typeMessage = self::TYPE_TEXTE;

    #[ORM\Column(nullable: true)]
    #[Groups(['message:read', 'message:create', 'conversation:read'])]
    private ?int $dureeVoix = null;

    #[ORM\Column]
    #[Groups(['message:read', 'conversation:read'])]
    private ?\DateTimeImmutable $createdAt = null;

    #[ORM\ManyToOne(targetEntity: User::class, inversedBy: 'messages')]
    #[ORM\JoinColumn(nullable: false)]
    #[Groups(['message:read', 'conversation:read'])]
    private ?User $expediteur = null;

    #[ORM\ManyToOne(targetEntity: Conversation::class, inversedBy: 'messages')]
    #[ORM\JoinColumn(nullable: false)]
    #[Groups(['message:read', 'message:create'])]
    private ?Conversation $conversation = null;

    #[ORM\ManyToOne(targetEntity: Consultation::class, inversedBy: 'messages')]
    #[Groups(['message:read', 'message:create'])]
    private ?Consultation $consultation = null;

    #[ORM\ManyToOne(targetEntity: MediaObject::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    #[Groups(['message:read', 'message:create', 'conversation:read'])]
    private ?MediaObject $media = null;

    #[ORM\ManyToOne(targetEntity: Message::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    #[Groups(['message:read', 'message:create'])]
    private ?Message $messageParent = null;

    #[ORM\Column(type: 'boolean', options: ['default' => false])]
    #[Groups(['message:read'])]
    private bool $estModifie = false;

    #[ORM\Column(nullable: true)]
    #[Groups(['message:read'])]
    private ?\DateTimeImmutable $modifieAt = null;

    #[ORM\Column(type: 'boolean', options: ['default' => false])]
    #[Groups(['message:read'])]
    private bool $estTransfere = false;

    #[ORM\Column(type: 'boolean', options: ['default' => false])]
    private bool $supprimePourExpediteur = false;

    #[ORM\Column(type: 'boolean', options: ['default' => false])]
    private bool $supprimePourDestinataire = false;

    #[ORM\Column(nullable: true)]
    private ?\DateTimeImmutable $deletedAt = null;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getContenu(): ?string
    {
        return $this->contenu;
    }

    public function setContenu(string $contenu): static
    {
        $this->contenu = $contenu;
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

    public function getTypeMessage(): string
    {
        return $this->typeMessage;
    }

    public function setTypeMessage(string $typeMessage): static
    {
        $this->typeMessage = $typeMessage;
        return $this;
    }

    public function getDureeVoix(): ?int
    {
        return $this->dureeVoix;
    }

    public function setDureeVoix(?int $dureeVoix): static
    {
        $this->dureeVoix = $dureeVoix;
        return $this;
    }

    public function getCreatedAt(): ?\DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function setCreatedAt(\DateTimeImmutable $createdAt): static
    {
        $this->createdAt = $createdAt;
        return $this;
    }

    public function getExpediteur(): ?User
    {
        return $this->expediteur;
    }

    public function setExpediteur(?User $expediteur): static
    {
        $this->expediteur = $expediteur;
        return $this;
    }

    public function getConversation(): ?Conversation
    {
        return $this->conversation;
    }

    public function setConversation(?Conversation $conversation): static
    {
        $this->conversation = $conversation;
        return $this;
    }

    public function getConsultation(): ?Consultation
    {
        return $this->consultation;
    }

    public function setConsultation(?Consultation $consultation): static
    {
        $this->consultation = $consultation;
        return $this;
    }

    public function getMedia(): ?MediaObject
    {
        return $this->media;
    }

    public function setMedia(?MediaObject $media): static
    {
        $this->media = $media;
        return $this;
    }

    public function getMessageParent(): ?self
    {
        return $this->messageParent;
    }

    public function setMessageParent(?self $messageParent): static
    {
        $this->messageParent = $messageParent;
        return $this;
    }

    public function isEstModifie(): bool
    {
        return $this->estModifie;
    }

    public function setEstModifie(bool $estModifie): static
    {
        $this->estModifie = $estModifie;
        return $this;
    }

    public function getModifieAt(): ?\DateTimeImmutable
    {
        return $this->modifieAt;
    }

    public function setModifieAt(?\DateTimeImmutable $modifieAt): static
    {
        $this->modifieAt = $modifieAt;
        return $this;
    }

    public function isEstTransfere(): bool
    {
        return $this->estTransfere;
    }

    public function setEstTransfere(bool $estTransfere): static
    {
        $this->estTransfere = $estTransfere;
        return $this;
    }

    public function isSupprimePourExpediteur(): bool
    {
        return $this->supprimePourExpediteur;
    }

    public function setSupprimePourExpediteur(bool $supprimePourExpediteur): static
    {
        $this->supprimePourExpediteur = $supprimePourExpediteur;
        return $this;
    }

    public function isSupprimePourDestinataire(): bool
    {
        return $this->supprimePourDestinataire;
    }

    public function setSupprimePourDestinataire(bool $supprimePourDestinataire): static
    {
        $this->supprimePourDestinataire = $supprimePourDestinataire;
        return $this;
    }

    public function getDeletedAt(): ?\DateTimeImmutable
    {
        return $this->deletedAt;
    }

    public function setDeletedAt(?\DateTimeImmutable $deletedAt): static
    {
        $this->deletedAt = $deletedAt;
        return $this;
    }
}
