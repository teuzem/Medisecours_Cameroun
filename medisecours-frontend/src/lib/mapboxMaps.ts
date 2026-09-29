'use client'

import i18n from '../i18n'

export interface MapboxLoadResult {
  loaded: boolean
  reason: string | null
}

declare global {
  interface Window {
    mapboxgl?: any
  }
}

const MAPBOX_TOKEN =
  process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ||
  process.env.VITE_MAPBOX_ACCESS_TOKEN ||
  process.env.MAPBOX_ACCESS_TOKEN ||
  ''

const MAPBOX_SCRIPT = 'https://api.mapbox.com/mapbox-gl-js/v3.15.0/mapbox-gl.js'
const MAPBOX_STYLE = 'https://api.mapbox.com/mapbox-gl-js/v3.15.0/mapbox-gl.css'

let loadPromise: Promise<MapboxLoadResult> | null = null

function ensureStylesheet() {
  if (document.querySelector('link[data-medisecours-mapbox]')) return
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = MAPBOX_STYLE
  link.dataset.medisecoursMapbox = 'true'
  document.head.appendChild(link)
}

export function getMapboxToken(): string {
  return MAPBOX_TOKEN
}

export function loadMapbox(): Promise<MapboxLoadResult> {
  if (loadPromise) return loadPromise
  loadPromise = new Promise<MapboxLoadResult>((resolve) => {
    if (!MAPBOX_TOKEN) {
      resolve({ loaded: false, reason: i18n.t('common.map.mapboxTokenMissing') })
      return
    }
    if (window.mapboxgl) {
      window.mapboxgl.accessToken = MAPBOX_TOKEN
      ensureStylesheet()
      resolve({ loaded: true, reason: null })
      return
    }

    const script = document.createElement('script')
    const timeout = window.setTimeout(() => {
      script.remove()
      resolve({ loaded: false, reason: i18n.t('common.map.mapboxTimeout') })
    }, 15_000)
    script.src = MAPBOX_SCRIPT
    script.async = true
    script.onload = () => {
      window.clearTimeout(timeout)
      if (!window.mapboxgl) {
        resolve({ loaded: false, reason: i18n.t('common.map.mapboxUnavailable') })
        return
      }
      window.mapboxgl.accessToken = MAPBOX_TOKEN
      ensureStylesheet()
      resolve({ loaded: true, reason: null })
    }
    script.onerror = () => {
      window.clearTimeout(timeout)
      resolve({ loaded: false, reason: i18n.t('common.map.mapboxLoadRejected') })
    }
    document.head.appendChild(script)
  })
  return loadPromise
}
