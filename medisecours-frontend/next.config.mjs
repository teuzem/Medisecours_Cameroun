const isProduction = process.env.NODE_ENV === 'production'

// URL du backend — Railway en prod, localhost en dev
const BACKEND_URL = (
  process.env.API_BASE_URL
  || process.env.NEXT_PUBLIC_API_BASE_URL
  || 'http://127.0.0.1:8000'
).replace(/\/$/, '')

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProduction ? '' : " 'unsafe-eval'"} https://accounts.google.com https://maps.googleapis.com https://maps.gstatic.com https://forge.butterfly-effect.dev`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com",
  "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com",
  `img-src 'self' data: blob: https:${isProduction ? '' : ' http://127.0.0.1:8000 http://localhost:8000'}`,
  "font-src 'self' data: https://fonts.gstatic.com",
  "worker-src 'self' blob:",
  `media-src 'self' blob: https:${isProduction ? '' : ' http://127.0.0.1:8000 http://localhost:8000'}`,
  `connect-src 'self' https: wss:${isProduction ? '' : ' http://127.0.0.1:8000 http://localhost:8000 ws://127.0.0.1:8081 ws://localhost:8081'}`,
  "frame-src 'self' https://accounts.google.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isProduction ? ['upgrade-insecure-requests'] : []),
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=(self)' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
  ...(isProduction
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' }]
    : []),
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  // Accepte les noms exacts du projet de référence Manus (VITE_FRONTEND_FORGE_*)
  // comme alias des NEXT_PUBLIC_FRONTEND_FORGE_* inlinés au build par Next.js.
  // Sans ce mapping, ces variables seraient ignorées sur un build non-Docker
  // (Vercel/Netlify) et la carte retomberait silencieusement sur Leaflet.
  env: {
    NEXT_PUBLIC_FRONTEND_FORGE_API_KEY:
      process.env.NEXT_PUBLIC_FRONTEND_FORGE_API_KEY ||
      process.env.VITE_FRONTEND_FORGE_API_KEY ||
      process.env.NEXT_PUBLIC_BUILT_IN_FORGE_API_KEY ||
      process.env.BUILT_IN_FORGE_API_KEY ||
      '',
    NEXT_PUBLIC_FRONTEND_FORGE_API_URL:
      process.env.NEXT_PUBLIC_FRONTEND_FORGE_API_URL ||
      process.env.VITE_FRONTEND_FORGE_API_URL ||
      process.env.NEXT_PUBLIC_BUILT_IN_FORGE_API_URL ||
      process.env.BUILT_IN_FORGE_API_URL ||
      'https://forge.butterfly-effect.dev',
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${BACKEND_URL}/api/:path*`,
      },
    ]
  },
}

export default nextConfig
