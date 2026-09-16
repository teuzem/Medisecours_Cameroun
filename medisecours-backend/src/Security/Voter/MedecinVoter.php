<?php

declare(strict_types=1);

namespace App\Security\Voter;

use App\Entity\Medecin;
use App\Entity\User;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\Voter\Voter;
use Symfony\Component\Security\Core\Authorization\Voter\Vote;

/**
 * Voter gérant les droits sur l'entité Medecin.
 *
 * Attributs supportés :
 *  - MEDECIN_VALIDATE  : valider/invalider un compte médecin (admin uniquement)
 *  - MEDECIN_EDIT      : modifier le profil (propriétaire ou admin)
 *  - MEDECIN_VIEW      : voir le profil complet (propriétaire ou admin — les données partielles sont publiques)
 */
class MedecinVoter extends Voter
{
    public const VALIDATE = 'MEDECIN_VALIDATE';
    public const EDIT     = 'MEDECIN_EDIT';
    public const VIEW     = 'MEDECIN_VIEW';

    protected function supports(string $attribute, mixed $subject): bool
    {
        return in_array($attribute, [self::VALIDATE, self::EDIT, self::VIEW], true)
            && $subject instanceof Medecin;
    }

    protected function voteOnAttribute(string $attribute, mixed $subject, TokenInterface $token, ?Vote $vote = null): bool
    {
        $user = $token->getUser();

        if (!$user instanceof User) {
            return false;
        }

        /** @var Medecin $medecin */
        $medecin = $subject;

        return match ($attribute) {
            self::VALIDATE => $this->isAdmin($user),
            self::EDIT     => $this->isAdmin($user) || $user === $medecin,
            self::VIEW     => $this->isAdmin($user) || $user === $medecin,
            default        => false,
        };
    }

    private function isAdmin(User $user): bool
    {
        return in_array('ROLE_ADMIN', $user->getRoles(), true);
    }
}
