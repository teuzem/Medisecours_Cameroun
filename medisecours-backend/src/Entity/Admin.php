<?php

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
class Admin extends User
{
    // L'entité Admin hérite de tous les champs de User.
    // Elle permet juste d'avoir un type "admin" propre en base de données
    // au lieu de stocker les administrateurs comme des Patients.
}
