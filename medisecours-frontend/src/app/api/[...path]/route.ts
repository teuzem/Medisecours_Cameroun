import { NextResponse } from 'next/server'

/**
 * Proxy API runtime vers le backend Symfony.
 *
 * Remplace le rewrite statique figé au build (`next.config.mjs`) : l'URL du
 * backend est résolue À CHAQUE REQUÊTE depuis `API_BASE_URL` (ou
 * `NEXT_PUBLIC_API_BASE_URL`), donc un conteneur construit sans la variable
 * fonctionne dès qu'elle est fournie au runtime (Coolify, Docker, VPS).
 *
 * - Transmet méthode, query, corps (JSON / multipart / binaire) et les
 *   en-têtes utiles (content-type, accept-language, authorization, cookie).
 * - Renvoie statut, corps et cookies (`set-cookie`) du backend tels quels.
 * - Backend injoignable → 502 `backend_unreachable` (jamais de page HTML),
 *   pour que le frontend affiche un diagnostic précis au lieu d'un toast
 *   générique.
 */
function backendBase(): string {
  return (
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    'http://127.0.0.1:8000'
  ).replace(/\/$/, '')
}

const FORWARDED_REQUEST_HEADERS = [
  'content-type',
  'accept',
  'accept-language',
  'authorization',
  'cookie',
] as const

async function proxy(request: Request, params: Promise<{ path: string[] }>) {
  const { path } = await params
  const incoming = new URL(request.url)
  const target = `${backendBase()}/api/${path.map((segment) => encodeURIComponent(segment)).join('/')}${incoming.search}`

  const headers = new Headers()
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name)
    if (value !== null) headers.set(name, value)
  }
  // Le backend génère des URLs absolues (emails, redirections) : il doit
  // connaître l'hôte public d'origine.
  const forwardedHost = request.headers.get('host')
  if (forwardedHost && !headers.has('x-forwarded-host')) {
    headers.set('x-forwarded-host', forwardedHost)
  }
  const forwardedProto = incoming.protocol.replace(':', '')
  if (forwardedProto && !headers.has('x-forwarded-proto')) {
    headers.set('x-forwarded-proto', forwardedProto)
  }

  const init: RequestInit = { method: request.method, headers }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.arrayBuffer()
    // `fetch` exige duplex pour un corps streamé/arrayBuffer en Node 22.
    ;(init as RequestInit & { duplex: 'half' }).duplex = 'half'
  }

  let upstream: Response
  try {
    upstream = await fetch(target, init)
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause)
    return NextResponse.json(
      { error: 'backend_unreachable', detail },
      { status: 502 },
    )
  }

  const body = await upstream.arrayBuffer()
  const response = new NextResponse(body, { status: upstream.status })
  const contentType = upstream.headers.get('content-type')
  if (contentType) response.headers.set('content-type', contentType)
  const cookies =
    typeof (upstream.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie === 'function'
      ? (upstream.headers as Headers & { getSetCookie: () => string[] }).getSetCookie()
      : []
  for (const cookie of cookies) response.headers.append('set-cookie', cookie)
  return response
}

export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, context.params)
}

export async function POST(request: Request, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, context.params)
}

export async function PUT(request: Request, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, context.params)
}

export async function PATCH(request: Request, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, context.params)
}

export async function DELETE(request: Request, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, context.params)
}

export async function OPTIONS(request: Request, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, context.params)
}
