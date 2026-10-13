<?php

declare(strict_types=1);

namespace App\Service;

/**
 * Normalise un lien vidéo externe (YouTube, TikTok, Instagram, Facebook,
 * Vimeo, Dailymotion) vers un embed iframe jouable avec aperçu instantané.
 *
 * Source unique de vérité partagée par la galerie d'établissement
 * (CarteController) et les médias d'avis (AvisEtablissementMediaController).
 */
final class ExternalVideoParser
{
    /**
     * @return array{provider: string, id: string|null, watchUrl: string, embedUrl: string, thumbnailUrl: string|null}|null
     *         null si le fournisseur n'est pas pris en charge ou si
     *         l'identifiant est introuvable (liens raccourcis type
     *         vm.tiktok.com, fb.watch sans identifiant exploitable).
     */
    public static function parse(string $url): ?array
    {
        $url = trim($url);
        if ($url === '' || mb_strlen($url) > 1000) {
            return null;
        }
        if (!preg_match('#^https?://#i', $url)) {
            $url = 'https://' . $url;
        }
        $parts = parse_url($url);
        if (!is_array($parts) || !isset($parts['host'])) {
            return null;
        }
        $host = strtolower(preg_replace('/^www\./', '', (string) $parts['host']));
        $path = (string) ($parts['path'] ?? '');
        $query = [];
        if (isset($parts['query'])) {
            parse_str((string) $parts['query'], $query);
        }

        // ── YouTube ──────────────────────────────────────────────────────
        if (in_array($host, ['youtube.com', 'm.youtube.com', 'youtu.be', 'youtube-nocookie.com'], true)) {
            $id = null;
            if ($host === 'youtu.be' && preg_match('#^/([A-Za-z0-9_-]{6,20})#', $path, $m)) {
                $id = $m[1];
            } elseif (preg_match('#/(shorts|embed|live)/([A-Za-z0-9_-]{6,20})#', $path, $m)) {
                $id = $m[2];
            } elseif (isset($query['v']) && preg_match('/^[A-Za-z0-9_-]{6,20}$/', (string) $query['v'])) {
                $id = (string) $query['v'];
            }
            if ($id === null) {
                return null;
            }

            return [
                'provider' => 'youtube',
                'id' => $id,
                'watchUrl' => 'https://www.youtube.com/watch?v=' . $id,
                'embedUrl' => 'https://www.youtube.com/embed/' . $id,
                'thumbnailUrl' => 'https://i.ytimg.com/vi/' . $id . '/hqdefault.jpg',
            ];
        }

        // ── TikTok (identifiant numerique obligatoire pour l'embed) ──────
        if (str_ends_with($host, 'tiktok.com')) {
            if (preg_match('#/video/(\d{5,30})#', $path, $m)) {
                $id = $m[1];

                return [
                    'provider' => 'tiktok',
                    'id' => $id,
                    'watchUrl' => 'https://www.tiktok.com/@/video/' . $id,
                    'embedUrl' => 'https://www.tiktok.com/embed/v2/' . $id,
                    'thumbnailUrl' => null,
                ];
            }

            return null;
        }

        // ── Instagram (publication / reel) ───────────────────────────────
        if (in_array($host, ['instagram.com', 'instagr.am'], true)) {
            if (preg_match('#/(p|reel|reels|tv)/([A-Za-z0-9_-]{5,60})#', $path, $m)) {
                $shortcode = $m[2];

                return [
                    'provider' => 'instagram',
                    'id' => $shortcode,
                    'watchUrl' => 'https://www.instagram.com/p/' . $shortcode . '/',
                    'embedUrl' => 'https://www.instagram.com/p/' . $shortcode . '/embed',
                    'thumbnailUrl' => null,
                ];
            }

            return null;
        }

        // ── Facebook (video / watch / reel) ──────────────────────────────
        if (in_array($host, ['facebook.com', 'fb.com'], true)) {
            $id = null;
            if (preg_match('#/reel/(\d{5,30}|[A-Za-z0-9_-]{5,60})#', $path, $m)) {
                $id = $m[1];
            } elseif (preg_match('#/videos?/(\d{5,30})#', $path, $m)) {
                $id = $m[1];
            } elseif (isset($query['v']) && preg_match('/^\d{5,30}$/', (string) $query['v'])) {
                $id = (string) $query['v'];
            }
            if ($id === null) {
                return null;
            }
            $watchUrl = str_contains($path, '/reel/') ? 'https://www.facebook.com/reel/' . $id . '/' : 'https://www.facebook.com/watch/?v=' . $id;

            return [
                'provider' => 'facebook',
                'id' => $id,
                'watchUrl' => $watchUrl,
                'embedUrl' => 'https://www.facebook.com/plugins/video.php?href=' . rawurlencode($watchUrl) . '&show_text=false',
                'thumbnailUrl' => null,
            ];
        }

        // ── Vimeo ────────────────────────────────────────────────────────
        if (str_ends_with($host, 'vimeo.com')) {
            if (preg_match('#/(\d{5,20})(?:/|$)#', $path, $m)) {
                $id = $m[1];

                return [
                    'provider' => 'vimeo',
                    'id' => $id,
                    'watchUrl' => 'https://vimeo.com/' . $id,
                    'embedUrl' => 'https://player.vimeo.com/video/' . $id,
                    'thumbnailUrl' => null,
                ];
            }

            return null;
        }

        // ── Dailymotion ──────────────────────────────────────────────────
        if (in_array($host, ['dailymotion.com', 'dai.ly'], true)) {
            $id = null;
            if (preg_match('#/video/([A-Za-z0-9]{5,20})#', $path, $m)) {
                $id = $m[1];
            } elseif ($host === 'dai.ly' && preg_match('#^/([A-Za-z0-9]{5,20})#', $path, $m)) {
                $id = $m[1];
            }
            if ($id === null) {
                return null;
            }

            return [
                'provider' => 'dailymotion',
                'id' => $id,
                'watchUrl' => 'https://www.dailymotion.com/video/' . $id,
                'embedUrl' => 'https://www.dailymotion.com/embed/video/' . $id,
                'thumbnailUrl' => null,
            ];
        }

        return null;
    }
}
