<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Controller\CarteController;
use App\Entity\AvisEtablissement;
use App\Entity\AvisJaime;
use App\Entity\Patient;
use PHPUnit\Framework\TestCase;

/**
 * Contrat de sérialisation d'un avis et de son compteur de « J'aime ».
 *
 * Régression : la lecture des avis d'un établissement qui en possède a renvoyé
 * 500 (la table avis_jaime manquait, migration_versions la croyait appliquée),
 * et la fiche affiche alors « Impossible de charger les avis ».
 */
final class AvisListeResilienceTest extends TestCase
{
    public function testUnAvisExposeLeNomEtLaPhotoDeSonAuteur(): void
    {
        $user = new Patient();
        $user->setNom('TEUZEM');
        $user->setPrenom('Yeiavel');
        $user->setPhotoProfil('/api/media_objects/6/download');

        $avis = new AvisEtablissement();
        $avis->setUser($user);
        $avis->setNote(5);
        $avis->setCommentaire('Je recommande vivement cet établissement.');

        $payload = CarteController::serializeAvis($avis);

        self::assertSame('Yeiavel TEUZEM', $payload['auteurNom']);
        self::assertSame('/api/media_objects/6/download', $payload['auteurPhoto']);
        self::assertSame('PUBLIE', $payload['statut']);
        self::assertIsArray($payload['images']);
    }

    public function testUnAvisSansAuteurNeDeclenchePasDErreur(): void
    {
        $avis = new AvisEtablissement();
        $avis->setNote(4);

        $payload = CarteController::serializeAvis($avis);

        self::assertNull($payload['auteurNom']);
        self::assertNull($payload['auteurPhoto']);
        self::assertIsString($payload['createdAt']);
    }

    public function testUnJaimeRelieUnAvisAUnUtilisateur(): void
    {
        $avis = new AvisEtablissement();
        $user = new Patient();

        $jaime = new AvisJaime($avis, $user);

        self::assertSame($avis, $jaime->getAvis());
        self::assertSame($user, $jaime->getUser());
        self::assertInstanceOf(\DateTimeImmutable::class, $jaime->getCreatedAt());
    }
}