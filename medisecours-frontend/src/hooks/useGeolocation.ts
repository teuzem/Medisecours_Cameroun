'use client'
import { useState, useCallback, useEffect, useRef } from 'react'
import i18n from '../i18n'

const ERROR_MESSAGE_KEYS: Record<number, string> = {
  1: 'common.geo.denied',
  2: 'common.geo.unavailablePosition',
  3: 'common.geo.timeout',
}

export function useGeolocation() {
  const [gpsPosition, setGpsPosition] = useState<{ lat: number; lng: number } | null>(null)
  const [manualPosition, setManualPositionState] = useState<{ lat: number; lng: number } | null>(null)
  // Position effective : le point placé manuellement prime sur le GPS.
  // Indispensable quand le capteur du navigateur est faux (géolocalisation
  // IP à plusieurs kilomètres) : l'itinéraire — notamment SOS — part alors
  // du quartier exact au lieu d'une position fantôme.
  const position = manualPosition ?? gpsPosition
  const [accuracy, setAccuracy] = useState<number | null>(null)
  const [permission, setPermission] = useState<'granted' | 'prompt' | 'denied' | 'unknown'>('unknown')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [isWatching, setIsWatching] = useState(false)
  const watchIdRef = useRef<number | null>(null)

  // Demande d'autorisation explicite : suit l'état de l'autorisation
  // « position exacte » du navigateur pour déclencher son invite.
  useEffect(() => {
    let cancelled = false
    const permissions = (navigator as Navigator & { permissions?: { query: (options: { name: string }) => Promise<{ state: string; onchange: (() => void) | null }> } }).permissions
    if (typeof navigator === 'undefined' || !permissions?.query) return
    permissions.query({ name: 'geolocation' }).then((status) => {
      if (!cancelled) setPermission(status.state as 'granted' | 'prompt' | 'denied')
      status.onchange = () => {
        if (!cancelled) setPermission(status.state as 'granted' | 'prompt' | 'denied')
      }
    }).catch(() => {
      // Permissions API indisponible : le navigateur invitera à la demande
    })
    return () => { cancelled = true }
  }, [])

  const applyPosition = useCallback((pos: GeolocationPosition) => {
    setGpsPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude })
    setAccuracy(Number.isFinite(pos.coords.accuracy) && pos.coords.accuracy > 0 ? pos.coords.accuracy : null)
    setPermission('granted')
    setLoading(false)
  }, [])

  const handleError = useCallback((err: GeolocationPositionError) => {
    const key = ERROR_MESSAGE_KEYS[err.code]
    setError(key ? i18n.t(key) : i18n.t('common.geo.unknown'))
    if (err.code === 1) setPermission('denied')
    setLoading(false)
    setIsWatching(false)
  }, [])

  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setError(i18n.t('common.geo.notSupported'))
      return
    }
    setLoading(true)
    setError(null)
    // Fix frais et exact (maximumAge: 0) : aucune position en cache,
    // la mesure la plus précise possible du capteur.
    navigator.geolocation.getCurrentPosition(
      applyPosition,
      handleError,
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    )
  }, [applyPosition, handleError])

  /** Start continuous GPS tracking (essential for mobile users walking to a clinic). */
  const watch = useCallback(() => {
    if (!navigator.geolocation) {
      setError(i18n.t('common.geo.notSupported'))
      return
    }
    // Stop any existing watch before starting a new one
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
    }
    setLoading(true)
    setError(null)
    const id = navigator.geolocation.watchPosition(
      applyPosition,
      handleError,
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000, distanceFilter: 1 } as PositionOptions & { distanceFilter?: number }
    )
    watchIdRef.current = id
    setIsWatching(true)
  }, [applyPosition, handleError])

  /** Stop continuous GPS tracking. */
  const stopWatch = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    setIsWatching(false)
  }, [])

  /**
   * Placement manuel exact (« toucher la carte ») : remplace le fix GPS
   * jusqu'à restauration explicite. La précision repasse à null (point
   * exact placé par l'utilisateur : aucun cercle d'incertitude).
   */
  const setManualPosition = useCallback((point: { lat: number; lng: number }) => {
    setManualPositionState(point)
    setAccuracy(null)
    setError(null)
    setLoading(false)
  }, [])

  /** Restaure le fix GPS live (abandonne le point manuel). */
  const clearManualPosition = useCallback(() => {
    setManualPositionState(null)
  }, [])

  return {
    position,
    accuracy,
    permission,
    isManual: manualPosition !== null,
    setManualPosition,
    clearManualPosition,
    error,
    loading,
    locate,
    watch,
    stopWatch,
    isWatching,
  }
}
