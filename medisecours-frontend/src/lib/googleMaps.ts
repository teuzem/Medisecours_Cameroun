'use client'

/**
 * Intégration "Carte Santé" — fournisseur de cartographie.
 *
 * Défaut : Google Maps via le proxy officiel de la plateforme Frontend Forge
 * (intégration Manus) ou, à défaut, via une clé Google Maps directe.
 * Repli : Leaflet (aucune clé configurée / services Google indisponibles) —
 * l'application reste 100 % fonctionnelle sans interrompre les services.
 */

export type MapProvider = 'google' | 'leaflet'

export type GoogleMapKind = 'forge' | 'google'

export interface MapProviderConfig {
  kind: GoogleMapKind
  /** URL du script Google Maps à injecter. */
  scriptUrl: string
  /** Fournisseur "source" pour l'information utilisateur. */
  displayName: string
}

const DEFAULT_FORGE_BASE_URL = 'https://forge.butterfly-effect.dev'

// Valeurs NEXT_PUBLIC_* inlinées par Next.js au build du client, avec repli
// sur les noms exacts du projet de référence Manus (VITE_FRONTEND_FORGE_API_*).
const FORGE_KEY =
  process.env.NEXT_PUBLIC_FRONTEND_FORGE_API_KEY || process.env.VITE_FRONTEND_FORGE_API_KEY || ''
const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''
const FORGE_BASE_URL =
  process.env.NEXT_PUBLIC_FRONTEND_FORGE_API_URL ||
  process.env.VITE_FRONTEND_FORGE_API_URL ||
  DEFAULT_FORGE_BASE_URL

const LIBRARIES = 'marker,places,geocoding,geometry,routes'

/** Résolution du fournisseur depuis les variables d'environnement (build). */
export function getMapProviderConfig(): MapProviderConfig | null {
  if (FORGE_KEY) {
    return {
      kind: 'forge',
      scriptUrl: `${FORGE_BASE_URL}/v1/maps/proxy/maps/api/js?key=${encodeURIComponent(FORGE_KEY)}&v=weekly&libraries=${LIBRARIES}`,
      displayName: 'Google Maps (Frontend Forge)',
    }
  }

  if (GOOGLE_KEY) {
    return {
      kind: 'google',
      scriptUrl: `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_KEY)}&v=weekly&libraries=${LIBRARIES}`,
      displayName: 'Google Maps',
    }
  }

  return null
}

let loadPromise: Promise<boolean> | null = null
let loaded = false

/** Charge le script Google Maps une seule fois (singleton). */
export function loadGoogleMaps(): Promise<boolean> {
  if (loaded) return Promise.resolve(true)
  if (loadPromise) return loadPromise

  loadPromise = new Promise<boolean>((resolve) => {
    const config = getMapProviderConfig()
    if (!config) {
      resolve(false)
      return
    }

    const script = document.createElement('script')
    script.src = config.scriptUrl
    script.async = true
    script.crossOrigin = 'anonymous'
    script.onload = () => {
      loaded = true
      script.remove()
      resolve(true)
    }
    script.onerror = () => {
      console.error('[googleMaps] Impossible de charger le script Google Maps — repli Leaflet.')
      script.remove()
      resolve(false)
    }
    document.head.appendChild(script)
  })

  return loadPromise
}

export function isGoogleMapsLoaded(): boolean {
  return loaded || Boolean(typeof window !== 'undefined' && window.google?.maps)
}