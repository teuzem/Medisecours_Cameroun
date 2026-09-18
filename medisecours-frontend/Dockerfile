# ============================================================================
# MediSecours+ frontend — production Dockerfile (Next.js 16 standalone)
# ============================================================================
# Multi-stage build produces a small self-contained image (~120 MB).
# Build arg  NODE_ENV defaults to production; API_BASE_URL is baked in at
# build time so the Next.js rewrite proxy is resolved server-side.
# ============================================================================

# ── Stage 1: build ────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

RUN apk add --no-cache git python3 make g++

WORKDIR /app

# Install all dependencies (including devDeps needed for build: @tailwindcss/postcss, typescript, etc.)
# --include=dev ensures devDependencies install even when Coolify sets NODE_ENV=production.
# Do NOT set NODE_ENV=development here — Next.js requires NODE_ENV=production at build time.
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --include=dev \
    && npm rebuild sharp --ignore-scripts=false

# NOTE: `--webpack` avoids a Turbopack prerender bug ("useContext null" during
# prerender of /medecin). Next.js 16 defaults to Turbopack for `next build`;
# forcing the webpack bundler fixes the runtime while we wait for the fix.

# Copy application source
COPY . .

# Next.js rewrite uses API_BASE_URL at build time.
# On Coolify/Vercel it can be unset (same-domain) or set to the public API URL.
# NEXT_PUBLIC_* variables are inlined by Next.js at build time.
ARG API_BASE_URL=https://api.medisecours.batirlepays.com
ARG NEXT_PUBLIC_WS_URL=wss://ws.medisecours.batirlepays.com/ws
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ARG NEXT_PUBLIC_FRONTEND_FORGE_API_KEY
ARG NEXT_PUBLIC_FRONTEND_FORGE_API_URL=https://forge.butterfly-effect.dev
ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
# Noms exacts du projet de référence Manus : acceptés en entrée puis
# canonicalisés dans les NEXT_PUBLIC_* inlinés par Next.js au build.
ARG VITE_FRONTEND_FORGE_API_KEY
ARG VITE_FRONTEND_FORGE_API_URL
ENV API_BASE_URL=${API_BASE_URL} \
    NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL} \
    NEXT_PUBLIC_GOOGLE_CLIENT_ID=${NEXT_PUBLIC_GOOGLE_CLIENT_ID} \
    NEXT_PUBLIC_FRONTEND_FORGE_API_KEY=${NEXT_PUBLIC_FRONTEND_FORGE_API_KEY:-${VITE_FRONTEND_FORGE_API_KEY}} \
    NEXT_PUBLIC_FRONTEND_FORGE_API_URL=${NEXT_PUBLIC_FRONTEND_FORGE_API_URL:-${VITE_FRONTEND_FORGE_API_URL:-https://forge.butterfly-effect.dev}} \
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=${NEXT_PUBLIC_GOOGLE_MAPS_API_KEY} \
    NEXT_TELEMETRY_DISABLED=1

RUN npm run build -- --webpack

# ── Stage 2: production ──────────────────────────────────────────────────
FROM node:22-alpine AS runner

RUN apk add --no-cache curl \
    && addgroup --system --gid 1001 nodejs \
    && adduser  --system --uid 1001 nextjs

WORKDIR /app

# Copy only what is needed for standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

CMD ["node", "server.js"]
