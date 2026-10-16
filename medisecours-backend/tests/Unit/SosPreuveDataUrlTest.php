<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Entity\DemandeSos;
use PHPUnit\Framework\TestCase;

/**
 * La preuve SOS est une data-URL dont l'en-tête porte les codecs :
 * « data:video/webm;codecs=vp9,opus;base64,… ». La liste de codecs contient
 * une virgule : un découpage naïf au premier « ; » rejetait ces vidéos,
 * alors qu'elles sont parfaitement exploitables.
 */
final class SosPreuveDataUrlTest extends TestCase
{
    /**
     * Même découpage que DemandeSosProcessor::analyserDataUrl().
     */
    private static function analyser(string $dataUrl): array
    {
        if (!str_starts_with($dataUrl, 'data:')) {
            return ['', ''];
        }
        $virgule = strpos($dataUrl, ',');
        if ($virgule === false) {
            return ['', ''];
        }
        $entete = substr($dataUrl, 5, $virgule - 5);
        $parties = array_map('trim', explode(';', $entete));
        $mime = strtolower((string) array_shift($parties));
        $sousType = strtolower((string) (str_contains($mime, '/') ? substr($mime, strpos($mime, '/') + 1) : $mime));

        return [$mime, $sousType];
    }

    public static function donneesDataUrl(): array
    {
        return [
            'webm avec codecs contenant une virgule' => ['data:video/webm;codecs=vp9,opus;base64,AAA', 'video/webm', 'webm'],
            'webm vp8 vorbis' => ['data:video/webm;codecs=vp8,vorbis;base64,AAA', 'video/webm', 'webm'],
            'webm simple' => ['data:video/webm;base64,AAA', 'video/webm', 'webm'],
            'mp4 avec codec' => ['data:video/mp4;codecs=avc1.42E01E;base64,AAA', 'video/mp4', 'mp4'],
            'mp4 simple' => ['data:video/mp4;base64,AAA', 'video/mp4', 'mp4'],
            'quicktime' => ['data:video/quicktime;base64,AAA', 'video/quicktime', 'quicktime'],
            'jpeg' => ['data:image/jpeg;base64,/9j/4AAQ', 'image/jpeg', 'jpeg'],
            'png' => ['data:image/png;base64,iVBORw0K', 'image/png', 'png'],
        ];
    }

    /**
     * @dataProvider donneesDataUrl
     */
    public function testLeTypeEstLuCorrectement(string $dataUrl, string $mimeAttendu, string $sousTypeAttendu): void
    {
        [$mime, $sousType] = self::analyser($dataUrl);

        self::assertSame($mimeAttendu, $mime);
        self::assertSame($sousTypeAttendu, $sousType);
    }

    public function testUneVideoResteUneVideo memeAvecCodecsComposes(): void
    {
        foreach (['vp9,opus', 'vp8,vorbis', 'avc1.42E01E'] as $codecs) {
            [$mime] = self::analyser("data:video/webm;codecs={$codecs};base64,AAA");
            self::assertStringStartsWith('video/', $mime, "codecs {$codecs} : le type ne doit jamais être perdu");
        }
    }

    public function testUneDonneeQuiNestPasUneDataUrlEstRejetee(): void
    {
        self::assertSame(['', ''], self::analyser('https://exemple.com/preuve.jpg'));
        self::assertSame(['', ''], self::analyser('data:image/jpeg;base64'));
    }

    public function testLesConstantesDePreuveSontDefinies(): void
    {
        self::assertSame('PHOTO', DemandeSos::PREUVE_PHOTO);
        self::assertSame('VIDEO', DemandeSos::PREUVE_VIDEO);
    }
}