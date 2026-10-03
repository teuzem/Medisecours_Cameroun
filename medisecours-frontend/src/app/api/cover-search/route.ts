import { NextResponse } from 'next/server'

type CoverProvider = 'pexels' | 'pixabay'

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_REQUESTS = 10
const requestWindows = new Map<string, { count: number; resetAt: number }>()

function rateLimitKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || request.headers.get('x-real-ip') || 'unknown'
}

function isRateLimited(request: Request): boolean {
  const now = Date.now()
  const key = rateLimitKey(request)
  const current = requestWindows.get(key)

  if (!current || current.resetAt <= now) {
    requestWindows.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return false
  }

  current.count += 1
  if (requestWindows.size > 2_000) {
    for (const [entryKey, entry] of requestWindows) {
      if (entry.resetAt <= now) requestWindows.delete(entryKey)
    }
  }
  return current.count > RATE_LIMIT_MAX_REQUESTS
}

function unavailable(provider: CoverProvider, status = 503) {
  return NextResponse.json(
    {
      provider,
      items: [],
      configurationRequired: true,
      error: 'provider_not_configured',
    },
    { status },
  )
}

export async function GET(request: Request) {
  if (isRateLimited(request)) {
    return NextResponse.json(
      { items: [], error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': '60' } },
    )
  }

  const searchParams = new URL(request.url).searchParams
  const query = searchParams.get('q')?.trim() ?? ''
  const requestedProvider = searchParams.get('provider') ?? 'pexels'

  if (requestedProvider !== 'pexels' && requestedProvider !== 'pixabay') {
    return NextResponse.json({ items: [], error: 'invalid_provider' }, { status: 400 })
  }

  const provider: CoverProvider = requestedProvider
  if (query.length < 2) {
    return NextResponse.json({ provider, items: [], error: 'query_too_short' }, { status: 400 })
  }
  if (query.length > 120) {
    return NextResponse.json({ provider, items: [], error: 'query_too_long' }, { status: 400 })
  }
  if (provider === 'pixabay' && query.length > 100) {
    return NextResponse.json({ provider, items: [], error: 'query_too_long' }, { status: 400 })
  }

  try {
    if (provider === 'pixabay') {
      if (!process.env.PIXABAY_API_KEY) return unavailable(provider)

      const endpoint = new URL('https://pixabay.com/api/')
      endpoint.searchParams.set('key', process.env.PIXABAY_API_KEY)
      endpoint.searchParams.set('q', query)
      endpoint.searchParams.set('image_type', 'photo')
      endpoint.searchParams.set('safesearch', 'true')
      endpoint.searchParams.set('orientation', 'horizontal')
      endpoint.searchParams.set('per_page', '12')
      const response = await fetch(endpoint, {
        next: { revalidate: 86_400 },
        signal: AbortSignal.timeout(8_000),
      })
      if (!response.ok) {
        return NextResponse.json(
          { provider, items: [], error: 'provider_request_failed' },
          { status: response.status >= 500 ? 502 : response.status },
        )
      }
      const data = await response.json() as {
        hits?: Array<{
          id: number
          webformatURL?: string
          largeImageURL?: string
          pageURL?: string
          user?: string
        }>
      }
      const items = (data.hits ?? [])
        .map(item => ({
          id: String(item.id),
          url: item.largeImageURL || item.webformatURL || '',
          previewUrl: item.webformatURL || item.largeImageURL || '',
          sourceUrl: item.pageURL || 'https://pixabay.com/',
          author: item.user || 'Pixabay',
        }))
        .filter(item => item.url && item.previewUrl)
      return NextResponse.json({ provider, items })
    }

    if (!process.env.PEXELS_API_KEY) return unavailable(provider)

    const endpoint = new URL('https://api.pexels.com/v1/search')
    endpoint.searchParams.set('query', query)
    endpoint.searchParams.set('orientation', 'landscape')
    endpoint.searchParams.set('per_page', '12')
    const response = await fetch(endpoint, {
      headers: { Authorization: process.env.PEXELS_API_KEY },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(8_000),
    })
    if (!response.ok) {
      return NextResponse.json(
        { provider, items: [], error: 'provider_request_failed' },
        { status: response.status >= 500 ? 502 : response.status },
      )
    }
    const data = await response.json() as {
      photos?: Array<{
        id: number
        photographer?: string
        url?: string
        src?: { large2x?: string; large?: string; medium?: string }
      }>
    }
    const items = (data.photos ?? [])
      .map(item => ({
        id: String(item.id),
        url: item.src?.large2x || item.src?.large || item.src?.medium || '',
        previewUrl: item.src?.medium || item.src?.large || item.src?.large2x || '',
        sourceUrl: item.url || 'https://www.pexels.com/',
        author: item.photographer || 'Pexels',
      }))
      .filter(item => item.url && item.previewUrl)
    return NextResponse.json({ provider, items })
  } catch (error) {
    const code = error instanceof DOMException && error.name === 'TimeoutError'
      ? 'provider_timeout'
      : 'provider_unavailable'
    return NextResponse.json({ provider, items: [], error: code }, { status: 502 })
  }
}
