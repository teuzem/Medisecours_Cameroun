'use client'

import { useEffect, useState } from 'react'
import {
  getMapProviderConfigs,
  loadGoogleMaps,
  type GoogleMapKind,
  type MapProvider,
} from '../lib/googleMaps'

type ProviderState = 'checking' | 'ready'

export interface MapProviderResult {
  /** Fournisseur actif. 'leaflet' = repli (aucune clé ou échec de chargement). */
  provider: MapProvider
  state: ProviderState
  /** Non-null quand une clé Google était configurée mais que le chargement a échoué. */
  fallbackReason: string | null
  /** Fournisseur effectivement chargé ('forge'/'google') ou null en repli. */
  googleKind: GoogleMapKind | null
}

const NO_KEY_MESSAGE =
  'Aucune clé Google Maps configurée au build (NEXT_PUBLIC_FRONTEND_FORGE_API_KEY / VITE_FRONTEND_FORGE_API_KEY) — mode hors-ligne (Leaflet). Reconstruire l\'image avec la clé (variable de build).'

/**
 * Résout le fournisseur de carte au montage :
 *  1. aucune clé inlinée au build → Leaflet immédiatement (repli nominal) ;
 *  2. clé(s) configurée(s) → tente le chargement (Forge puis clé directe) ;
 *  3. échec total → Leaflet + bannière avec le diagnostic HTTP exact.
 */
export function useMapProvider(): MapProviderResult {
  const [result, setResult] = useState<MapProviderResult>(() => {
    const hasConfig = getMapProviderConfigs().length > 0
    return {
      provider: 'leaflet',
      state: hasConfig ? 'checking' : 'ready',
      fallbackReason: hasConfig ? null : NO_KEY_MESSAGE,
      googleKind: null,
    }
  })

  useEffect(() => {
    let alive = true

    const configs = getMapProviderConfigs()
    if (configs.length === 0) {
      // Pas de clé inlinée au build : le repli Leaflet (et son bandeau
      // explicatif) a déjà été posé dans l'initialiseur d'état.
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
        setResult({
          provider: 'leaflet',
          state: 'ready',
          fallbackReason: res.probeReason
            ? `Services Google Maps indisponibles (${res.probeReason}) — mode hors-ligne (Leaflet).`
            : 'Services Google Maps indisponibles — mode hors-ligne (Leaflet).',
          googleKind: null,
        })
      }
    })

    return () => {
      alive = false
    }
  }, [])

  return result
}
