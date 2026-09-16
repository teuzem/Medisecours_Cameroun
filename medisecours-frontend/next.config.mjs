const isProduction = process.env.NODE_ENV === 'production'

// URL du backend — Railway en prod, localhost en dev
const BACKEND_URL = (
  process.env.API_BASE_URL
  || process.env.NEXT_PUBLIC_API_BASE_URL
  || 'http://127.0.0.1:8000'
).replace(/\/$/, '')

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProduction ? '' : " 'unsafe-eval'"} https://accounts.google.com`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com",
  "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com",
  `img-src 'self' data: blob: https:${isProduction ? '' : ' http://127.0.0.1:8000 http://localhost:8000'}`,
  "font-src 'self' data: https://fonts.gstatic.com",
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
