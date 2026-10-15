<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Entity\CentreDeSante;
use App\Entity\DemandeSos;
use App\Entity\Patient;
use App\Entity\SosTrace;
use PHPUnit\Framework\TestCase;

/**
 * Cycle de vie complet d'une alerte SOS, du dépôt à la clôture.
 *
 * Couvre ce qui rend le module exploitable : triage, preuve, prise en charge
 * typée (médecin vs ambulancier), jalons d'intervention et traces.
 */
final class SosWorkflowTest extends TestCase
{
    public function testUneAlerteNaissentEnVerificationSansSirene(): void
    {
        $sos = new DemandeSos();

        self::assertSame('EN_COURS', $sos->getStatut());
        self::assertFalse($sos->isSireneActive());
        self::assertSame(DemandeSos::GRAVITE_LEGERE, $sos->getGravite());
        self::assertNull($sos->getPriseEnChargeType());
        self::assertNull($sos->getDepartAt());
        self::assertNull($sos->getArriveeAt());
    }

    public function testLaPreuvePeutEtreUnePhotoOuUneVideo(): void
    {
        $sos = new DemandeSos();

        $sos->setPreuvePhoto('data:image/jpeg;base64,/9j/4AAQSkZJRg==');
        self::assertStringStartsWith('data:image/', (string) $sos->getPreuvePhoto());

        $sos->setPreuvePhoto('data:video/mp4;base64,AAAAIGZ0eXA==');
        self::assertStringStartsWith('data:video/', (string) $sos->getPreuvePhoto());
    }

    public function testLaPriseEnChargeEstTypeeEtOuvreLeSuivi(): void
    {
        $medecin = new Patient();
        $sos = new DemandeSos();
        $maintenant = new \DateTimeImmutable('2026-10-15 10:00:00');

        $sos->setPrisEnChargePar($medecin)
            ->setPrisEnChargeAt($maintenant)
            ->setPriseEnChargeType('MEDECIN')
            ->setStatut('EN_PRISE_EN_CHARGE');

        self::assertSame('MEDECIN', $sos->getPriseEnChargeType());
        self::assertSame('EN_PRISE_EN_CHARGE', $sos->getStatut());
        self::assertNull($sos->getDepartAt(), 'le départ se marque au moment du départ, pas à la prise en charge');
    }

    public function testLesJalonsDInterventionSontPosablesIndépendamment(): void
    {
        $sos = new DemandeSos();
        $horodatage = new \DateTimeImmutable('2026-10-15 10:05:00');

        $sos->setDepartAt($horodatage);
        self::assertNotNull($sos->getDepartAt());
        self::assertNull($sos->getArriveeAt());

        $sos->setArriveeAt($horodatage);
        $sos->setPatientEmbarqueAt($horodatage);
        self::assertNotNull($sos->getArriveeAt());
        self::assertNotNull($sos->getPatientEmbarqueAt());

        $sos->setNoteIntervention('Patient stabilisé, transport vers l\'établissement.');
        self::assertStringContainsString('transport', (string) $sos->getNoteIntervention());
    }

    public function testLesGravitesSontLimiteesAuTriage(): void
    {
        self::assertContains(DemandeSos::GRAVITE_CRITIQUE, DemandeSos::GRAVITES);
        self::assertNotContains('CATASTROPHIQUE', DemandeSos::GRAVITES);
    }

    public function testLesTracesCouvrentChaqueEtapeDuWorkflow(): void
    {
        $sos = new DemandeSos();
        $auteur = new Patient();

        foreach ([
            SosTrace::ACTION_CREEE,
            SosTrace::ACTION_CONFIRMEE,
            SosTrace::ACTION_PRISE_EN_CHARGE,
            SosTrace::ACTION_DEPART,
            SosTrace::ACTION_SUR_PLACE,
            SosTrace::ACTION_TRANSPORT,
            SosTrace::ACTION_TRAITEE,
        ] as $action) {
            $trace = (new SosTrace())->setSos($sos)->setAction($action)->setAuteur($auteur);
            self::assertSame($action, $trace->getAction());
            self::assertSame($sos, $trace->getSos());
        }
    }

    public function testUneAlerteResteLieeASonEtablissementCible(): void
    {
        $centre = new CentreDeSante();
        $sos = new DemandeSos();
        $sos->setEtablissement($centre);

        self::assertSame($centre, $sos->getEtablissement());
    }
}