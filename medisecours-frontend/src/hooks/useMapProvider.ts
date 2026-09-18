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

const NO_KEY_MESSAGE =
  'Aucune clé Google Maps configurée au build (NEXT_PUBLIC_FRONTEND_FORGE_API_KEY / VITE_FRONTEND_FORGE_API_KEY) — mode hors-ligne (Leaflet). Reconstruire l\'image avec la clé (variable de build).'

/**
 * Résout le fournisseur de carte au montage :
 *  1. aucune clé inlinée au build → Leaflet immédiatement (repli nominal) ;
 *  2. clé configurée → tente le chargement de Google Maps → Google ou Leaflet.
 */
export function useMapProvider(): MapProviderResult {
  const [result, setResult] = useState<MapProviderResult>(() => {
    const hasConfig = getMapProviderConfig() != null
    return {
      provider: 'leaflet',
      state: hasConfig ? 'checking' : 'ready',
      fallbackReason: hasConfig ? null : NO_KEY_MESSAGE,
    }
  })

  useEffect(() => {
    let alive = true

    const config = getMapProviderConfig()
    if (!config) {
      // Pas de clé inlinée au build : le repli Leaflet (et son bandeau
      // explicatif) a déjà été posé dans l'initialiseur d'état.
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