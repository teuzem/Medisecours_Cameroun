import { NextResponse } from 'next/server'

type CoverProvider = 'pexels' | 'pixabay'

const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const ALLOWED_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
])

function isAllowedProviderHost(provider: CoverProvider, hostname: string): boolean {
  const normalized = hostname.toLowerCase()
  if (provider === 'pexels') return /(^|\.)pexels\.com$/.test(normalized)
  return /(^|\.)pixabay\.com$/.test(normalized)
}

function safeFileName(value: string, contentType: string): string {
  const extensionByType: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  }
  const base = value
    .replace(/\.[a-z0-9]{2,5}$/i, '')
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'facility-cover'
  return `${base}.${extensionByType[contentType] ?? 'jpg'}`
}

export async function POST(request: Request) {
  let payload: { provider?: string; url?: string; fileName?: string }
  try {
    payload = await request.json() as typeof payload
  } catch {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 })
  }

  if (payload.provider !== 'pexels' && payload.provider !== 'pixabay') {
    return NextResponse.json({ error: 'invalid_provider' }, { status: 400 })
  }
  if (typeof payload.url !== 'string' || payload.url.length > 2_000) {
    return NextResponse.json({ error: 'invalid_url' }, { status: 400 })
  }

  let source: URL
  try {
    source = new URL(payload.url)
  } catch {
    return NextResponse.json({ error: 'invalid_url' }, { status: 400 })
  }
  if (source.protocol !== 'https:' || !isAllowedProviderHost(payload.provider, source.hostname)) {
    return NextResponse.json({ error: 'unapproved_source' }, { status: 400 })
  }

  try {
    const response = await fetch(source, {
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(12_000),
    })
    if (!response.ok) {
      return NextResponse.json({ error: 'download_failed' }, { status: 502 })
    }

    const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? ''
    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
      return NextResponse.json({ error: 'invalid_image_type' }, { status: 415 })
    }

    const declaredLength = Number(response.headers.get('content-length') ?? 0)
    if (Number.isFinite(declaredLength) && declaredLength > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: 'image_too_large' }, { status: 413 })
    }

    const image = await response.arrayBuffer()
    if (image.byteLength === 0 || image.byteLength > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: image.byteLength === 0 ? 'empty_image' : 'image_too_large' },
        { status: image.byteLength === 0 ? 422 : 413 },
      )
    }

    const fileName = safeFileName(payload.fileName ?? `${payload.provider}-cover`, contentType)
    return new Response(image, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(image.byteLength),
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch {
    return NextResponse.json({ error: 'download_unavailable' }, { status: 502 })
  }
}
