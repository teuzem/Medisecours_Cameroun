<?php

namespace App\DTO;

use Symfony\Component\Validator\Constraints as Assert;

class CentreDeSanteImportDTO
{
    #[Assert\NotBlank(message: "Le nom du centre est obligatoire")]
    public string $nom;

    #[Assert\NotBlank(message: "Le type de centre est obligatoire")]
    public string $type;

    #[Assert\NotBlank(message: "La région est obligatoire")]
    #[Assert\Choice(
        choices: ['Adamaoua', 'Centre', 'Est', 'Extrême-Nord', 'Littoral', 'Nord', 'Nord-Ouest', 'Ouest', 'Sud', 'Sud-Ouest'],
        message: "Région camerounaise invalide"
    )]
    public string $region;

    #[Assert\NotBlank(message: "La ville est obligatoire")]
    public string $ville;

    public ?string $quartier = null;

    #[Assert\NotBlank(message: "L'adresse est obligatoire")]
    public string $adresse;

    #[Assert\NotBlank(message: "Le téléphone est obligatoire")]
    #[Assert\Regex(
        pattern: '/^(\+237\s?)?[6-9][0-9]{8}$/',
        message: "Le numéro de téléphone doit être un numéro camerounais valide (+237 6XXXXXXXX)"
    )]
    public string $telephone;

    public ?string $email = null;
    public ?string $siteWeb = null;

    #[Assert\NotBlank(message: "La latitude est obligatoire")]
    #[Assert\Type(type: 'float')]
    #[Assert\Range(min: -90, max: 90)]
    public float $latitude;

    #[Assert\NotBlank(message: "La longitude est obligatoire")]
    #[Assert\Type(type: 'float')]
    #[Assert\Range(min: -180, max: 180)]
    public float $longitude;

    public ?string $horaires = null;
    public ?string $description = null;

    #[Assert\Choice(choices: ['public', 'prive', 'associatif'])]
    public ?string $statut = 'prive';

    public ?bool $estActif = true;

    public ?string $specialites = null;
}
