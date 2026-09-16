<?php
// src/DTO/MaladieImportDTO.php

namespace App\DTO;

use Symfony\Component\Validator\Constraints as Assert;

class MaladieImportDTO
{
    #[Assert\NotBlank(message: "Le nom de la maladie est obligatoire")]
    #[Assert\Length(max: 255)]
    public string $nom;

    #[Assert\Length(max: 1000)]
    public ?string $description = null;

    #[Assert\Length(max: 100000)]
    public ?string $symptomes = null;

    #[Assert\NotBlank(message: "Le niveau de gravité est obligatoire")]
    #[Assert\Choice(
        choices: ['LÉGÈRE', 'MODÉRÉE', 'SÉVÈRE', 'CRITIQUE', 'VARIABLE'],
        message: "Le niveau de gravité doit être: LÉGÈRE, MODÉRÉE, SÉVÈRE, CRITIQUE ou VARIABLE"
    )]
    public string $niveauGravite;

    #[Assert\Type(type: 'bool', message: "Le champ urgence doit être un booléen")]
    public bool $urgence;

    #[Assert\Type(type: 'bool', message: "Le champ contagieux doit être un booléen")]
    public bool $contagieux;

    #[Assert\NotBlank(message: "Le nom de la catégorie est obligatoire")]
    #[Assert\Length(max: 255)]
    public string $categorieNom;

    #[Assert\Length(max: 2000)]
    public ?string $premierSoinEtapes = null;

    #[Assert\Length(max: 1000000)]
    public ?string $premierSoinPrecautions = null;
}
