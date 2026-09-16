'use client'

import { useEffect, useState, useCallback, useRef } from 'react'

// ─── Types ──────────────────────────────────────────────────────────────────
interface Position {
  lat: number
  lng: number
}

interface Destination extends Position {
  nom: string
}

interface UseWayfindingParams {
  patientPosition: Position | null
  destination: Destination | null
  mode: 'driving' | 'walking'
}

interface RouteGeometry {
  type: 'LineString'
  coordinates: [number, number][]
}

interface CachedRoute {
  route: RouteGeometry
  distance: number
  duration: number
  isFallback: boolean
}

interface UseWayfindingResult {
  route: RouteGeometry | null
  distance: number | null
  duration: number | null
  loading: boolean
  error: string | null
  isFallback: boolean
  clear: () => void
}

// ─── Constants ──────────────────────────────────────────────────────────────

const OSRM_BASE = 'https://router.project-osrm.org/route/v1'
const OSRM_TIMEOUT_MS = 8000

// OSRM demo server only supports "driving" profile.
// For "walking", we use "driving" geometry but recalculate duration using walking speed.
const WALKING_SPEED_KMH = 5
const DRIVING_SPEED_KMH = 40

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Build a synthetic straight-line GeoJSON LineString between two points.
 * Used as fallback when OSRM is unavailable.
 */
function buildStraightLine(from: Position, to: Position): RouteGeometry {
  return {
    type: 'LineString',
    coordinates: [
      [from.lng, from.lat],
      [to.lng, to.lat],
    ],
  }
}

/**
 * Haversine distance in meters between two lat/lng points.
 */
function haversineMeters(a: Position, b: Position): number {
  const R = 6_371_000 // Earth radius in meters
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

/**
 * Build a stable cache key from destination coordinates + travel mode.
 * Patient position is NOT part of the key because the patient may move slightly
 * during live tracking — we only re-fetch if the DESTINATION or MODE changes.
 * For significant patient movement, the useEffect dependency array handles it.
 */
function cacheKey(dest: Position, mode: string): string {
  return `${dest.lat.toFixed(5)},${dest.lng.toFixed(5)}|${mode}`
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useWayfinding({
  patientPosition,
  destination,
  mode,
}: UseWayfindingParams): UseWayfindingResult {
  const [route, setRoute] = useState<RouteGeometry | null>(null)
  const [distance, setDistance] = useState<number | null>(null)
  const [duration, setDuration] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isFallback, setIsFallback] = useState(false)

  const abortRef = useRef<AbortController | null>(null)

  // ── Route cache: Map<"lat,lng|mode", CachedRoute> ─────────────────────
  const cacheRef = useRef<Map<string, CachedRoute>>(new Map())

  const clear = useCallback(() => {
    // Cancel any in-flight request
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    setRoute(null)
    setDistance(null)
    setDuration(null)
    setLoading(false)
    setError(null)
    setIsFallback(false)
  }, [])

  useEffect(() => {
    // Both positions are required to calculate a route
    if (!patientPosition || !destination) {
      setRoute(null)
      setDistance(null)
      setDuration(null)
      setLoading(false)
      setError(null)
      setIsFallback(false)
      return
    }

    // ── Check cache first → instant hit, zero network ───────────────────
    const key = cacheKey(destination, mode)
    const cached = cacheRef.current.get(key)
    if (cached) {
      setRoute(cached.route)
      setDistance(cached.distance)
      setDuration(cached.duration)
      setIsFallback(cached.isFallback)
      setError(cached.isFallback ? 'Itinéraire approximatif (hors ligne)' : null)
      setLoading(false)
      return
    }

    // ── Abort previous in-flight request ────────────────────────────────
    if (abortRef.current) {
      abortRef.current.abort()
    }

    const controller = new AbortController()
    abortRef.current = controller

    // ── Manual timeout: abort after OSRM_TIMEOUT_MS ─────────────────────
    const timeoutId = setTimeout(() => controller.abort(), OSRM_TIMEOUT_MS)

    const fetchRoute = async () => {
      setLoading(true)
      setError(null)
      setIsFallback(false)

      try {
        // OSRM expects: /route/v1/{profile}/{lng1},{lat1};{lng2},{lat2}
        const profile = 'driving'
        const coords = `${patientPosition.lng},${patientPosition.lat};${destination.lng},${destination.lat}`
        const url = `${OSRM_BASE}/${profile}/${coords}?overview=full&geometries=geojson&steps=true&annotations=false`

        const response = await fetch(url, { signal: controller.signal })

        if (!response.ok) {
          throw new Error(`OSRM HTTP ${response.status}`)
        }

        const data = await response.json()

        if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
          throw new Error('Aucun itinéraire trouvé par OSRM.')
        }

        const osrmRoute = data.routes[0]
        const geometry: RouteGeometry = osrmRoute.geometry
        const routeDistance: number = osrmRoute.legs[0].distance
        let routeDuration: number = osrmRoute.legs[0].duration

        // If walking mode, recalculate duration based on walking speed
        if (mode === 'walking') {
          routeDuration = (routeDistance / 1000 / WALKING_SPEED_KMH) * 3600
        }

        if (!controller.signal.aborted) {
          // Store in cache
          cacheRef.current.set(key, {
            route: geometry,
            distance: routeDistance,
            duration: routeDuration,
            isFallback: false,
          })
          setRoute(geometry)
          setDistance(routeDistance)
          setDuration(routeDuration)
          setIsFallback(false)
          setError(null)
        }
      } catch (err: unknown) {
        if (controller.signal.aborted) return

        console.error('[useWayfinding] OSRM error, falling back to straight line:', err)

        // ─── Fallback: straight-line ────────────────────────────────
        const fallbackRoute = buildStraightLine(patientPosition, destination)
        const straightDist = haversineMeters(patientPosition, destination)
        const speed = mode === 'walking' ? WALKING_SPEED_KMH : DRIVING_SPEED_KMH
        const fallbackDuration = (straightDist / 1000 / speed) * 3600

        // Cache the fallback too (avoid re-fetching a known-broken route)
        cacheRef.current.set(key, {
          route: fallbackRoute,
          distance: straightDist,
          duration: fallbackDuration,
          isFallback: true,
        })

        setRoute(fallbackRoute)
        setDistance(straightDist)
        setDuration(fallbackDuration)
        setIsFallback(true)
        setError('Itinéraire approximatif (hors ligne)')
      } finally {
        clearTimeout(timeoutId)
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    fetchRoute()

    // Cleanup: abort on unmount or when inputs change
    return () => {
      clearTimeout(timeoutId)
      controller.abort()
    }
  }, [patientPosition?.lat, patientPosition?.lng, destination?.lat, destination?.lng, mode])

  return { route, distance, duration, loading, error, isFallback, clear }
}
