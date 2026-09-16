<?php

namespace App\Entity;

use ApiPlatform\Doctrine\Orm\Filter\SearchFilter;
use ApiPlatform\Metadata\ApiFilter;
use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Post;
use App\State\ConversationProcessor;
use App\Repository\ConversationRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Annotation\Groups;

#[ORM\Entity(repositoryClass: ConversationRepository::class)]
#[ApiResource(
    operations: [
        new GetCollection(security: "is_granted('ROLE_USER')"),
        new Get(security: "is_granted('ROLE_ADMIN') or object.getParticipants().contains(user)"),
        new Post(security: "is_granted('ROLE_USER')", processor: ConversationProcessor::class),
    ],
    normalizationContext: ['groups' => ['conversation:read']],
    denormalizationContext: ['groups' => ['conversation:write']],
    paginationEnabled: true,
    paginationItemsPerPage: 30,
    paginationMaximumItemsPerPage: 100,
    order: ['updatedAt' => 'DESC']
)]
class Conversation
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['conversation:read'])]
    private ?int $id = null;

    #[ORM\Column(length: 255, nullable: true)]
    #[Groups(['conversation:read', 'conversation:write'])]
    private ?string $titre = null;

    #[ORM\Column]
    #[Groups(['conversation:read'])]
    private ?\DateTimeImmutable $createdAt = null;

    #[ORM\Column(nullable: true)]
    #[Groups(['conversation:read'])]
    private ?\DateTimeImmutable $updatedAt = null;

    #[ORM\ManyToMany(targetEntity: User::class, inversedBy: 'conversations')]
    #[ORM\JoinTable(name: 'conversation_participants')]
    #[Groups(['conversation:read', 'conversation:write'])]
    private Collection $participants;

    #[ORM\Column(length: 73, nullable: true, unique: true)]
    private ?string $pairKey = null;

    #[ORM\OneToMany(targetEntity: Message::class, mappedBy: 'conversation', cascade: ['remove'])]
    #[ORM\OrderBy(['createdAt' => 'ASC'])]
    private Collection $messages;

    #[ORM\ManyToOne(targetEntity: Message::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    #[Groups(['conversation:read'])]
    private ?Message $dernierMessage = null;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable();
        $this->participants = new ArrayCollection();
        $this->messages = new ArrayCollection();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getTitre(): ?string
    {
        return $this->titre;
    }

    public function setTitre(?string $titre): static
    {
        $this->titre = $titre;
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

    public function getUpdatedAt(): ?\DateTimeImmutable
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(?\DateTimeImmutable $updatedAt): static
    {
        $this->updatedAt = $updatedAt;
        return $this;
    }

    public function getParticipants(): Collection
    {
        return $this->participants;
    }

    public function addParticipant(User $participant): static
    {
        if (!$this->participants->contains($participant)) {
            $this->participants->add($participant);
        }
        return $this;
    }

    public function removeParticipant(User $participant): static
    {
        $this->participants->removeElement($participant);
        return $this;
    }

    public function getPairKey(): ?string
    {
        return $this->pairKey;
    }

    public function setPairKey(?string $pairKey): static
    {
        $this->pairKey = $pairKey;

        return $this;
    }

    public function getMessages(): Collection
    {
        return $this->messages;
    }

    public function getDernierMessage(): ?Message
    {
        return $this->dernierMessage;
    }

    public function setDernierMessage(?Message $dernierMessage): static
    {
        $this->dernierMessage = $dernierMessage;
        return $this;
    }
}
