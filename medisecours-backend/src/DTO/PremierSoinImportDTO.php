<?php

namespace App\DTO;

use Symfony\Component\Validator\Constraints as Assert;

class PremierSoinImportDTO
{
    #[Assert\NotBlank(message: 'Le titre du premier soin est obligatoire')]
    #[Assert\Length(max: 255)]
    public string $titre;

    #[Assert\Length(max: 10000)]
    public ?string $description = null;

    #[Assert\Length(max: 10000)]
    public ?string $symptomes = null;

    #[Assert\NotBlank(message: "Le niveau d'urgence est obligatoire")]
    #[Assert\Choice(
        choices: ['FAIBLE', 'MOYEN', 'ÉLEVÉ', 'CRITIQUE'],
        message: "Le niveau d'urgence doit être: FAIBLE, MOYEN, ÉLEVÉ ou CRITIQUE"
    )]
    public string $niveauUrgence;

    #[Assert\NotBlank(message: 'Le nom de la maladie liée est obligatoire')]
    #[Assert\Length(max: 255)]
    public string $maladieNom;

    #[Assert\Length(max: 255)]
    public ?string $categorieNom = null;

    #[Assert\Length(max: 10000)]
    public ?string $maladieDescription = null;
}
