<?php

namespace App\DTO;

use Symfony\Component\Validator\Constraints as Assert;

class MedecinImportDTO
{
    #[Assert\NotBlank]
    #[Assert\Email]
    public string $email;

    #[Assert\NotBlank]
    #[Assert\Length(min: 8)]
    #[Assert\Regex(
        pattern: '/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/',
        message: 'Le mot de passe doit contenir majuscule, minuscule, chiffre et caractère spécial.'
    )]
    public ?string $password = null;

    #[Assert\NotBlank]
    public string $nom;

    #[Assert\NotBlank]
    public string $prenom;

    #[Assert\NotBlank]
    #[Assert\Regex(
        pattern: '/^(\+237\s?)?[6-9][0-9]{8}$/',
        message: 'Le téléphone doit être un numéro camerounais valide (+237 6XXXXXXXX).'
    )]
    public string $telephone;

    #[Assert\NotBlank]
    public string $specialite;

    #[Assert\NotBlank]
    public string $numeroOrdre;

    public ?string $ville = null;
    public ?string $quartier = null;
}
