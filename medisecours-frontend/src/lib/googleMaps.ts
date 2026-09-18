'use client'

export type MapProvider = 'google' | 'leaflet'
export type GoogleMapKind = 'forge' | 'google'

export interface MapProviderConfig {
  kind: GoogleMapKind
  scriptUrl: string
  displayName: string
}

export interface GoogleMapsLoadResult {
  loaded: boolean
  displayName: string | null
  kind: GoogleMapKind | null
  probeReason: string | null
}

declare global {
  interface Window {
    gm_authFailure?: () => void
  }
}

const DEFAULT_FORGE_BASE_URL = 'https://forge.butterfly-effect.dev'
const FORGE_KEY =
  process.env.NEXT_PUBLIC_FRONTEND_FORGE_API_KEY ||
  process.env.VITE_FRONTEND_FORGE_API_KEY ||
  process.env.NEXT_PUBLIC_BUILT_IN_FORGE_API_KEY ||
  process.env.BUILT_IN_FORGE_API_KEY ||
  ''
const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''
const FORGE_BASE_URL =
  process.env.NEXT_PUBLIC_FRONTEND_FORGE_API_URL ||
  process.env.VITE_FRONTEND_FORGE_API_URL ||
  process.env.NEXT_PUBLIC_BUILT_IN_FORGE_API_URL ||
  process.env.BUILT_IN_FORGE_API_URL ||
  DEFAULT_FORGE_BASE_URL
const LIBRARIES = 'marker,places,geocoding,geometry'
const FORGE_DISPLAY_NAME = 'Google Maps (Frontend Forge)'
const GOOGLE_DISPLAY_NAME = 'Google Maps'

export function getMapProviderConfigs(): MapProviderConfig[] {
  const configs: MapProviderConfig[] = []

  if (FORGE_KEY) {
    configs.push({
      kind: 'forge',
      scriptUrl: `${FORGE_BASE_URL}/v1/maps/proxy/maps/api/js?key=${encodeURIComponent(FORGE_KEY)}&v=weekly&libraries=${LIBRARIES}`,
      displayName: FORGE_DISPLAY_NAME,
    })
  }

  if (GOOGLE_KEY) {
    configs.push({
      kind: 'google',
      scriptUrl: `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_KEY)}&v=weekly&libraries=${LIBRARIES}`,
      displayName: GOOGLE_DISPLAY_NAME,
    })
  }

  return configs
}

export function getMapProviderConfig(): MapProviderConfig | null {
  return getMapProviderConfigs()[0] ?? null
}

let loadPromise: Promise<GoogleMapsLoadResult> | null = null
let loadedConfig: MapProviderConfig | null = null

function loadScript(src: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    let settled = false
    const previousAuthFailure = window.gm_authFailure
    const script = document.createElement('script')
    const timeout = window.setTimeout(() => finish(false), 20_000)

    function finish(success: boolean) {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      window.gm_authFailure = previousAuthFailure
      script.remove()
      resolve(success)
    }

    script.src = src
    script.async = true
    script.crossOrigin = 'anonymous'
    window.gm_authFailure = () => {
      console.error('[googleMaps] Google Maps authentication failed.')
      finish(false)
    }
    script.onload = async () => {
      try {
        if (!window.google?.maps) {
          finish(false)
          return
        }
        await Promise.all([
          window.google.maps.importLibrary('maps'),
          window.google.maps.importLibrary('marker'),
          window.google.maps.importLibrary('places'),
          window.google.maps.importLibrary('geocoding'),
          window.google.maps.importLibrary('geometry'),
        ])
        finish(Boolean(window.google.maps.Map && window.google.maps.marker?.AdvancedMarkerElement))
      } catch (error) {
        console.error('[googleMaps] Google libraries failed to initialize.', error)
        finish(false)
      }
    }
    script.onerror = () => finish(false)
    document.head.appendChild(script)
  })
}

async function probeScriptUrl(src: string): Promise<string> {
  try {
    const response = await fetch(src, { method: 'GET', cache: 'no-store' })
    const body = await response.text()
    const snippet = body
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 140)
    return snippet ? `HTTP ${response.status} - ${snippet}` : `HTTP ${response.status}`
  } catch (error) {
    const cause = error instanceof Error ? error.message : String(error)
    return `network response blocked (${cause})`
  }
}

export function loadGoogleMaps(): Promise<GoogleMapsLoadResult> {
  if (loadedConfig) {
    return Promise.resolve({
      loaded: true,
      displayName: loadedConfig.displayName,
      kind: loadedConfig.kind,
      probeReason: null,
    })
  }
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    const configs = getMapProviderConfigs()
    if (configs.length === 0) {
      console.warn(
        '[googleMaps] No Google Maps key was embedded at build time. ' +
          'Set NEXT_PUBLIC_FRONTEND_FORGE_API_KEY or VITE_FRONTEND_FORGE_API_KEY as a build variable.',
      )
      return { loaded: false, displayName: null, kind: null, probeReason: null }
    }

    for (const config of configs) {
      console.info(`[googleMaps] Loading ${config.displayName}.`)
      if (await loadScript(config.scriptUrl)) {
        loadedConfig = config
        return {
          loaded: true,
          displayName: config.displayName,
          kind: config.kind,
          probeReason: null,
        }
      }
    }

    const last = configs[configs.length - 1]
    const probeReason = await probeScriptUrl(last.scriptUrl)
    console.error(`[googleMaps] Failed to load ${last.displayName}: ${probeReason}.`)
    loadPromise = null
    return { loaded: false, displayName: null, kind: null, probeReason }
  })()

  return loadPromise
}

export function isGoogleMapsLoaded(): boolean {
  return Boolean(loadedConfig || (typeof window !== 'undefined' && window.google?.maps))
}
