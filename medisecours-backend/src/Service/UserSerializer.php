<?php

declare(strict_types=1);

namespace App\Service;

use App\Entity\Admin;
use App\Entity\Medecin;
use App\Entity\Patient;
use App\Entity\User;

/**
 * Sérialise un utilisateur en tableau JSON pour les réponses d'authentification.
 *
 * Centralise la logique de sérialisation pour éviter la duplication dans
 * JWTController, GoogleAuthController, SecurityController et AdminMedecinController.
 *
 * ⚠️  Ne jamais exposer : password, emailVerificationToken, passwordResetToken.
 */
final class UserSerializer
{
    /**
     * Retourne le tableau de données utilisateur exposé dans les réponses JWT.
     *
     * @return array<string, mixed>
     */
    public function serialize(User $user): array
    {
        $data = [
            'id'            => (string) $user->getId(),
            'email'         => $user->getEmail(),
            'nom'           => $user->getNom(),
            'prenom'        => $user->getPrenom(),
            'telephone'     => $user->getTelephone(),
            'quartier'      => $user->getQuartier(),
            'photoProfil'   => $user->getPhotoProfil(),
            'roles'         => $user->getRoles(),
            'emailVerified' => $user->isEmailVerified(),
            'actif'         => $user->isActif(),
            'banni'         => $user->isBanni(),
            'type'          => $user instanceof Medecin ? 'medecin' : ($user instanceof Admin ? 'admin' : 'patient'),
        ];

        if ($user instanceof Patient) {
            $data['groupeSanguin']   = $user->getGroupeSanguin();
            $data['allergies']       = $user->getAllergies();
            $data['contactsUrgence'] = $user->getContactsUrgence();
        }

        if ($user instanceof Medecin) {
            $data['specialite']              = $user->getSpecialite();
            $data['numeroOrdre']             = $user->getNumeroOrdre();
            $data['estValide']               = $user->isEstValide();
            $data['disponibilites']          = $user->getDisponibilites();
            $data['disponibilitesTexte']     = $user->getDisponibilitesTexte();
            $data['disponibilitesLabel']     = $user->getDisponibilitesLabel();
            $data['isDisponibleMaintenant']  = $user->isDisponibleMaintenant();
        }

        return $data;
    }
}
