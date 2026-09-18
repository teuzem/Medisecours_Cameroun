'use client'

import { useEffect, useState } from 'react'
import {
  getMapProviderConfigs,
  loadGoogleMaps,
  type GoogleMapKind,
  type MapProvider,
} from '../lib/googleMaps'
import { getMapboxToken, loadMapbox } from '../lib/mapboxMaps'

type ProviderState = 'checking' | 'ready'
export type ExtendedMapProvider = MapProvider | 'mapbox'

export interface MapProviderResult {
  provider: ExtendedMapProvider
  state: ProviderState
  fallbackReason: string | null
  googleKind: GoogleMapKind | null
}

const NO_KEY_MESSAGE =
  'Aucune clé Google Maps ou Mapbox configurée au build — mode hors-ligne (Leaflet). Reconstruire l’image avec les variables publiques.'

export function useMapProvider(): MapProviderResult {
  const [result, setResult] = useState<MapProviderResult>(() => {
    const hasGoogle = getMapProviderConfigs().length > 0
    const hasMapbox = Boolean(getMapboxToken())
    return {
      provider: 'leaflet',
      state: hasGoogle || hasMapbox ? 'checking' : 'ready',
      fallbackReason: hasGoogle || hasMapbox ? null : NO_KEY_MESSAGE,
      googleKind: null,
    }
  })

  useEffect(() => {
    let alive = true
    const configs = getMapProviderConfigs()

    const finishMapboxOrLeaflet = (reason: string | null) => {
      if (!getMapboxToken()) {
        if (!alive) return
        setResult({
          provider: 'leaflet',
          state: 'ready',
          fallbackReason: reason
            ? `Services Google Maps indisponibles (${reason}) — mode hors-ligne (Leaflet).`
            : 'Services Google Maps indisponibles — mode hors-ligne (Leaflet).',
          googleKind: null,
        })
        return
      }

      loadMapbox().then((mapbox) => {
        if (!alive) return
        setResult({
          provider: mapbox.loaded ? 'mapbox' : 'leaflet',
          state: 'ready',
          fallbackReason: mapbox.loaded
            ? null
            : `${reason ? `${reason} ` : ''}${mapbox.reason ?? 'Mapbox indisponible'} — mode hors-ligne (Leaflet).`,
          googleKind: null,
        })
      })
    }

    if (configs.length === 0) {
      finishMapboxOrLeaflet(NO_KEY_MESSAGE)
      return () => {
        alive = false
      }
    }

    loadGoogleMaps().then((res) => {
      if (!alive) return
      if (res.loaded) {
        setResult({
          provider: 'google',
          state: 'ready',
          fallbackReason: null,
          googleKind: res.kind,
        })
      } else {
        finishMapboxOrLeaflet(res.probeReason)
      }
    })

    return () => {
      alive = false
    }
  }, [])

  return result
}
