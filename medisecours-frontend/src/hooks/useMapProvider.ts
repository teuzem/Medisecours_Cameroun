'use client'

import { useEffect, useState } from 'react'
import {
  getMapProviderConfigs,
  loadGoogleMaps,
  type GoogleMapKind,
  type MapProvider,
} from '../lib/googleMaps'
import { getMapboxToken, loadMapbox } from '../lib/mapboxMaps'
import i18n from '../i18n'

type ProviderState = 'checking' | 'ready'
export type ExtendedMapProvider = MapProvider | 'mapbox'

export interface MapProviderResult {
  provider: ExtendedMapProvider
  state: ProviderState
  fallbackReason: string | null
  googleKind: GoogleMapKind | null
}

const noKeyMessage = () => i18n.t('common.map.noKey')

export function useMapProvider(): MapProviderResult {
  const [result, setResult] = useState<MapProviderResult>(() => {
    const hasGoogle = getMapProviderConfigs().length > 0
    const hasMapbox = Boolean(getMapboxToken())
    return {
      provider: 'leaflet',
      state: hasGoogle || hasMapbox ? 'checking' : 'ready',
      fallbackReason: hasGoogle || hasMapbox ? null : noKeyMessage(),
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
            ? i18n.t('common.map.googleUnavailableWithReason', { reason })
            : i18n.t('common.map.googleUnavailable'),
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
            : i18n.t('common.map.offlineFallbackWithReason', {
              reason: `${reason ? `${reason} ` : ''}${mapbox.reason ?? i18n.t('common.map.mapboxUnavailable')}`,
            }),
          googleKind: null,
        })
      })
    }

    if (configs.length === 0) {
      finishMapboxOrLeaflet(noKeyMessage())
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
