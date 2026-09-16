import { NextResponse } from 'next/server'

const PROTECTED_PREFIXES = ['/messages', '/profil', '/admin', '/medecin', '/patient']
const ADMIN_PREFIXES = ['/admin']
const MEDECIN_PREFIXES = ['/medecin']

function decodeRoles(token: string) {
  try {
    const payload = token.split('.')[1]
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    const data = JSON.parse(json)
    return data.roles || []
  } catch {
    return []
  }
}

export function proxy(request: any) {
  const { pathname } = request.nextUrl
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))
  if (!isProtected) return NextResponse.next()

  const token = request.cookies.get('medisecours_access')?.value

  if (!token) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  const isAdminRoute = ADMIN_PREFIXES.some((p) => pathname.startsWith(p))
  if (isAdminRoute) {
    const roles = decodeRoles(token)
    if (!roles.includes('ROLE_ADMIN')) {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  const isMedecinRoute = MEDECIN_PREFIXES.some((p) => pathname.startsWith(p))
  if (isMedecinRoute) {
    const roles = decodeRoles(token)
    if (!roles.includes('ROLE_MEDECIN')) {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/messages/:path*', '/profil/:path*', '/admin/:path*', '/medecin/:path*', '/patient/:path*'],
}
