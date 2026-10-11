<?php

declare(strict_types=1);

namespace App\Controller;

use App\Entity\CentreDeSante;
use App\Entity\PersonnelSante;
use App\Entity\User;
use App\Repository\EtablissementEquipeRepository;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

/**
 * Helpers d'accès communs aux contrôleurs du circuit personnel
 * (réception, soins, pharmacie).
 *
 * Les contrôleurs utilisant ce trait DOIVEN exposer une propriété
 * `equipeRepository` (EtablissementEquipeRepository).
 */
trait PersonnelAccessTrait
{
    abstract protected function equipeRepository(): EtablissementEquipeRepository;

    private function requireUser(): User
    {
        $user = $this->getUser();
        if (!$user instanceof User) {
            throw new AccessDeniedHttpException('Authentification requise.');
        }

        return $user;
    }

    private function isAdmin(User $user): bool
    {
        return in_array('ROLE_ADMIN', $user->getRoles(), true);
    }

    /**
     * Personnel validé + membre actif de l'établissement (double verrou).
     */
    private function requireActivePersonnel(): PersonnelSante
    {
        $user = $this->requireUser();
        if (!$user instanceof PersonnelSante) {
            throw new AccessDeniedHttpException('Accès réservé au personnel d\'établissement.');
        }

        if (!$user->estValide()) {
            throw new AccessDeniedHttpException(
                'Votre compte est en attente de validation par un manager de l\'établissement.'
            );
        }

        $centre = $user->getEtablissement();
        if (!$centre instanceof CentreDeSante) {
            throw new AccessDeniedHttpException('Aucun établissement rattaché à votre compte.');
        }

        if (!$this->equipeRepository()->findActiveMember($user, $centre)) {
            throw new AccessDeniedHttpException(
                'Votre adhésion à l\'équipe de cet établissement n\'est plus active.'
            );
        }

        return $user;
    }

    private function requirePersonnelTypes(PersonnelSante $personnel, array $types, string $message): void
    {
        if (!in_array($personnel->getTypePersonnel(), $types, true)) {
            throw new AccessDeniedHttpException($message);
        }
    }
}
