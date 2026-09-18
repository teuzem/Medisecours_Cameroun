'use client'

import { useEffect, useState } from 'react'
import { getMapProviderConfig, loadGoogleMaps, type MapProvider } from '../lib/googleMaps'

type ProviderState = 'checking' | 'ready'

export interface MapProviderResult {
  /** Fournisseur actif. 'leaflet' = repli (aucune clé ou échec de chargement). */
  provider: MapProvider
  state: ProviderState
  /** Non-null uniquement quand une clé Google était configurée mais que le chargement a échoué. */
  fallbackReason: string | null
}

/**
 * Résout le fournisseur de carte au montage :
 *  1. aucune clé configurée → Leaflet immédiatement (repli nominal) ;
 *  2. clé configurée → tente le chargement de Google Maps → Google ou Leaflet.
 */
export function useMapProvider(): MapProviderResult {
  const [result, setResult] = useState<MapProviderResult>(() => {
    const hasConfig = getMapProviderConfig() != null
    return {
      provider: 'leaflet',
      state: hasConfig ? 'checking' : 'ready',
      fallbackReason: null,
    }
  })

  useEffect(() => {
    let alive = true

    const config = getMapProviderConfig()
    if (!config) {
      return () => {
        alive = false
      }
    }

    loadGoogleMaps().then((ok) => {
      if (!alive) return
      if (ok) {
        setResult({ provider: 'google', state: 'ready', fallbackReason: null })
      } else {
        setResult({
          provider: 'leaflet',
          state: 'ready',
          fallbackReason: `Services ${config.displayName} indisponibles — mode hors-ligne (Leaflet).`,
        })
      }
    })

    return () => {
      alive = false
    }
  }, [])

  return result
}