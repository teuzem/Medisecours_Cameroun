<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Service\ExternalVideoParser;
use PHPUnit\Framework\TestCase;

final class ExternalVideoParserTest extends TestCase
{
    public function testParsesYouTubeWatchUrl(): void
    {
        $parsed = ExternalVideoParser::parse('https://www.youtube.com/watch?v=abc123DEFGH');

        self::assertNotNull($parsed);
        self::assertSame('youtube', $parsed['provider']);
        self::assertSame('https://www.youtube.com/embed/abc123DEFGH', $parsed['embedUrl']);
        self::assertNotNull($parsed['thumbnailUrl']);
    }

    public function testParsesYouTubeShortsAndShortLinks(): void
    {
        $shorts = ExternalVideoParser::parse('https://www.youtube.com/shorts/abc123DEFGH');
        self::assertNotNull($shorts);
        self::assertSame('youtube', $shorts['provider']);

        $short = ExternalVideoParser::parse('youtu.be/abc123DEFGH');
        self::assertNotNull($short);
        self::assertSame('https://www.youtube.com/watch?v=abc123DEFGH', $short['watchUrl']);
    }

    public function testParsesTiktokInstagramFacebookVimeoDailymotion(): void
    {
        $tiktok = ExternalVideoParser::parse('https://www.tiktok.com/@user/video/1234567890123456789');
        self::assertNotNull($tiktok);
        self::assertSame('tiktok', $tiktok['provider']);
        self::assertStringContainsString('/embed/v2/', $tiktok['embedUrl']);

        $instagram = ExternalVideoParser::parse('https://www.instagram.com/reel/AbC123xYz_9/');
        self::assertNotNull($instagram);
        self::assertSame('instagram', $instagram['provider']);

        $facebook = ExternalVideoParser::parse('https://www.facebook.com/watch/?v=123456789012345');
        self::assertNotNull($facebook);
        self::assertSame('facebook', $facebook['provider']);

        $vimeo = ExternalVideoParser::parse('https://vimeo.com/123456789');
        self::assertNotNull($vimeo);
        self::assertSame('https://player.vimeo.com/video/123456789', $vimeo['embedUrl']);

        $dailymotion = ExternalVideoParser::parse('https://www.dailymotion.com/video/x8abc12');
        self::assertNotNull($dailymotion);
        self::assertSame('dailymotion', $dailymotion['provider']);
    }

    public function testRejectsUnsupportedAndShortLinks(): void
    {
        self::assertNull(ExternalVideoParser::parse(''));
        self::assertNull(ExternalVideoParser::parse('not a url at all ///'));
        self::assertNull(ExternalVideoParser::parse('https://example.com/video/123'));
        // Liens raccourcis sans identifiant exploitable : refusés pour
        // garantir un aperçu instantané fonctionnel.
        self::assertNull(ExternalVideoParser::parse('https://vm.tiktok.com/AbCdEf/'));
        self::assertNull(ExternalVideoParser::parse('https://www.youtube.com/watch'));
    }
}
