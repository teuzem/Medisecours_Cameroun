import type { EtablissementMedia } from './carte'

export type ExternalVideoProvider =
  | 'youtube'
  | 'tiktok'
  | 'instagram'
  | 'facebook'
  | 'vimeo'
  | 'dailymotion'

export interface ParsedExternalVideo {
  provider: ExternalVideoProvider
  id: string | null
  watchUrl: string
  embedUrl: string
  thumbnailUrl: string | null
}

export const EXTERNAL_VIDEO_PROVIDER_LABELS: Record<ExternalVideoProvider, string> = {
  youtube: 'YouTube',
  tiktok: 'TikTok',
  instagram: 'Instagram',
  facebook: 'Facebook',
  vimeo: 'Vimeo',
  dailymotion: 'Dailymotion',
}

function normalizeInput(input: string): { host: string; path: string; query: Record<string, string> } | null {
  const trimmed = input.trim()
  if (!trimmed || trimmed.length > 1000) return null
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  let url: URL
  try {
    url = new URL(withScheme)
  } catch {
    return null
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  const query: Record<string, string> = {}
  url.searchParams.forEach((value, key) => {
    query[key] = value
  })
  return { host, path: url.pathname || '', query }
}

/**
 * Analyse un lien vidéo externe et le normalise vers un embed iframe jouable.
 * Miroir exact de `CarteController::parseExternalVideoUrl` côté Symfony :
 * toute URL acceptée ici doit être acceptée par l'API, et inversement.
 * Retourne null pour les liens raccourcis inexploitables (vm.tiktok.com,
 * fb.watch…) afin de garantir un aperçu instantané fonctionnel.
 */
export function parseExternalVideoUrl(input: string): ParsedExternalVideo | null {
  const parsed = normalizeInput(input)
  if (!parsed) return null
  const { host, path, query } = parsed

  if (['youtube.com', 'm.youtube.com', 'youtu.be', 'youtube-nocookie.com'].includes(host)) {
    let id: string | null = null
    if (host === 'youtu.be') {
      const match = /^\/([A-Za-z0-9_-]{6,20})/.exec(path)
      if (match) id = match[1]
    } else {
      const match = /\/(shorts|embed|live)\/([A-Za-z0-9_-]{6,20})/.exec(path)
      if (match) id = match[2]
      else if (query.v && /^[A-Za-z0-9_-]{6,20}$/.test(query.v)) id = query.v
    }
    if (!id) return null
    return {
      provider: 'youtube',
      id,
      watchUrl: `https://www.youtube.com/watch?v=${id}`,
      embedUrl: `https://www.youtube.com/embed/${id}`,
      thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    }
  }

  if (host.endsWith('tiktok.com')) {
    const match = /\/video\/(\d{5,30})/.exec(path)
    if (!match) return null
    return {
      provider: 'tiktok',
      id: match[1],
      watchUrl: `https://www.tiktok.com/@/video/${match[1]}`,
      embedUrl: `https://www.tiktok.com/embed/v2/${match[1]}`,
      thumbnailUrl: null,
    }
  }

  if (host === 'instagram.com' || host === 'instagr.am') {
    const match = /\/(p|reel|reels|tv)\/([A-Za-z0-9_-]{5,60})/.exec(path)
    if (!match) return null
    return {
      provider: 'instagram',
      id: match[2],
      watchUrl: `https://www.instagram.com/p/${match[2]}/`,
      embedUrl: `https://www.instagram.com/p/${match[2]}/embed`,
      thumbnailUrl: null,
    }
  }

  if (host === 'facebook.com' || host === 'fb.com') {
    let id: string | null = null
    const reel = /\/reel\/(\d{5,30}|[A-Za-z0-9_-]{5,60})/.exec(path)
    const video = /\/(videos?)\/(\d{5,30})/.exec(path)
    if (reel) id = reel[1]
    else if (video) id = video[2]
    else if (query.v && /^\d{5,30}$/.test(query.v)) id = query.v
    if (!id) return null
    const watchUrl = path.includes('/reel/')
      ? `https://www.facebook.com/reel/${id}/`
      : `https://www.facebook.com/watch/?v=${id}`
    return {
      provider: 'facebook',
      id,
      watchUrl,
      embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(watchUrl)}&show_text=false`,
      thumbnailUrl: null,
    }
  }

  if (host.endsWith('vimeo.com')) {
    const match = /\/(\d{5,20})(?:\/|$)/.exec(path)
    if (!match) return null
    return {
      provider: 'vimeo',
      id: match[1],
      watchUrl: `https://vimeo.com/${match[1]}`,
      embedUrl: `https://player.vimeo.com/video/${match[1]}`,
      thumbnailUrl: null,
    }
  }

  if (host === 'dailymotion.com' || host === 'dai.ly') {
    let id: string | null = null
    const long = /\/video\/([A-Za-z0-9]{5,20})/.exec(path)
    const short = /^\/([A-Za-z0-9]{5,20})/.exec(path)
    if (long) id = long[1]
    else if (host === 'dai.ly' && short) id = short[1]
    if (!id) return null
    return {
      provider: 'dailymotion',
      id,
      watchUrl: `https://www.dailymotion.com/video/${id}`,
      embedUrl: `https://www.dailymotion.com/embed/video/${id}`,
      thumbnailUrl: null,
    }
  }

  return null
}

export function isExternalVideoMedia(media: Pick<EtablissementMedia, 'provider' | 'externalUrl' | 'embedUrl' | 'mimeType'>): boolean {
  if (media.provider) return true
  if (media.externalUrl || media.embedUrl) return true
  const mime = (media.mimeType ?? '').toLowerCase()
  return (
    mime === 'video/youtube' ||
    mime === 'video/tiktok' ||
    mime === 'video/instagram' ||
    mime === 'video/facebook' ||
    mime === 'video/vimeo' ||
    mime === 'video/dailymotion'
  )
}

/** URL iframe à afficher : embed API, embed déduit localement, ou à défaut watch URL. */
export function getMediaEmbedUrl(
  media: Pick<EtablissementMedia, 'embedUrl' | 'externalUrl' | 'contentUrl' | 'provider'>,
): string | null {
  if (media.embedUrl) return media.embedUrl
  const candidate = media.externalUrl ?? media.contentUrl ?? ''
  if (!candidate) return null
  const parsed = parseExternalVideoUrl(candidate)
  if (parsed) return parsed.embedUrl
  return null
}

/** Vignette : thumbnail API, miniature YouTube déduite, sinon null (badge provider). */
export function getMediaThumbnailUrl(
  media: Pick<EtablissementMedia, 'thumbnailUrl' | 'externalUrl' | 'contentUrl' | 'provider'>,
): string | null {
  if (media.thumbnailUrl) return media.thumbnailUrl
  const candidate = media.externalUrl ?? media.contentUrl ?? ''
  if (!candidate) return null
  return parseExternalVideoUrl(candidate)?.thumbnailUrl ?? null
}

/** Libellé lisible du fournisseur, ou null pour les fichiers téléversés. */
export function getMediaProviderLabel(
  media: Pick<EtablissementMedia, 'provider' | 'externalUrl' | 'embedUrl' | 'mimeType'>,
): string | null {
  if (media.provider && media.provider in EXTERNAL_VIDEO_PROVIDER_LABELS) {
    return EXTERNAL_VIDEO_PROVIDER_LABELS[media.provider as ExternalVideoProvider]
  }
  if (!isExternalVideoMedia(media)) return null
  const candidate = media.externalUrl ?? media.embedUrl ?? ''
  const parsed = candidate ? parseExternalVideoUrl(candidate) : null
  if (parsed) return EXTERNAL_VIDEO_PROVIDER_LABELS[parsed.provider]
  return 'Vidéo externe'
}
