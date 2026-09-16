'use client'
import { useState, useCallback, useRef } from 'react'

export function useGeolocation() {
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const watchIdRef = useRef<number | null>(null)

  const errorMessages: Record<number, string> = {
    1: 'Accès à la localisation refusé.',
    2: 'Position introuvable.',
    3: 'Délai dépassé.',
  }

  const handleError = useCallback((err: GeolocationPositionError) => {
    setError(errorMessages[err.code] ?? "Impossible d'obtenir votre position.")
    setLoading(false)
  }, [])

  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setError("La géolocalisation n'est pas disponible sur cet appareil.")
      return
    }
    setLoading(true)
    setError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLoading(false)
      },
      handleError,
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    )
  }, [handleError])

  /** Start continuous GPS tracking (essential for mobile users walking to a clinic). */
  const watch = useCallback(() => {
    if (!navigator.geolocation) {
      setError("La géolocalisation n'est pas disponible sur cet appareil.")
      return
    }
    // Stop any existing watch before starting a new one
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
    }
    setLoading(true)
    setError(null)
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLoading(false)
      },
      handleError,
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000, distanceFilter: 1 } as PositionOptions & { distanceFilter?: number }
    )
    watchIdRef.current = id
  }, [handleError])

  /** Stop continuous GPS tracking. */
  const stopWatch = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
  }, [])

  return {
    position,
    error,
    loading,
    locate,
    watch,
    stopWatch,
    isWatching: watchIdRef.current !== null,
  }
}
