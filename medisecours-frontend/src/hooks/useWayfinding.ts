'use client'

import { useEffect, useState, useCallback, useRef } from 'react'

// ─── Types ──────────────────────────────────────────────────────────────────
export interface Position {
  lat: number
  lng: number
}

export interface Destination extends Position {
  nom: string
}

export type WayfindingMode = 'driving' | 'walking' | 'bicycling'

interface UseWayfindingParams {
  patientPosition: Position | null
  destination: Destination | null
  mode: WayfindingMode
}

export interface RouteStep {
  instruction: string
  distance: number
  duration: number
  name: string
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
  steps: RouteStep[]
}

interface UseWayfindingResult {
  route: RouteGeometry | null
  distance: number | null
  duration: number | null
  steps: RouteStep[]
  loading: boolean
  error: string | null
  isFallback: boolean
  clear: () => void
}

// ─── Constants ──────────────────────────────────────────────────────────────

const OSRM_BASE = 'https://router.project-osrm.org/route/v1'
const OSRM_TIMEOUT_MS = 8000

// OSRM demo server only supports the "driving" profile.
// For "walking" / "bicycling", we reuse the driving geometry but recalculate
// the duration from the average speed of the mode.
const WALKING_SPEED_KMH = 5
const BICYCLING_SPEED_KMH = 15
const DRIVING_SPEED_KMH = 40

const MODE_SPEED_KMH: Record<WayfindingMode, number> = {
  driving: DRIVING_SPEED_KMH,
  walking: WALKING_SPEED_KMH,
  bicycling: BICYCLING_SPEED_KMH,
}

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
  const [steps, setSteps] = useState<RouteStep[]>([])
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
    setSteps([])
    setLoading(false)
    setError(null)
    setIsFallback(false)
  }, [])

  useEffect(() => {
    // Both positions are required to calculate a route
    if (!patientPosition || !destination) {
      // Reset only if something is actually set (avoids cascading renders)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (route !== null) setRoute(null)
      if (distance !== null) setDistance(null)
      if (duration !== null) setDuration(null)
      if (steps.length > 0) setSteps([])
      if (loading) setLoading(false)
      if (error !== null) setError(null)
      if (isFallback) setIsFallback(false)
      return
    }

    // ── Check cache first → instant hit, zero network ───────────────────
    const key = cacheKey(destination, mode)
    const cached = cacheRef.current.get(key)
    if (cached) {
      setRoute(cached.route)
      setDistance(cached.distance)
      setDuration(cached.duration)
      setSteps(cached.steps)
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

        // Driving uses the real OSRM duration ; walking/bicycling are
        // recalculated from the average speed of the mode.
        let routeDuration: number = osrmRoute.legs[0].duration
        if (mode !== 'driving') {
          routeDuration = (routeDistance / 1000 / MODE_SPEED_KMH[mode]) * 3600
        }

        const osrmSteps: {
          maneuver?: { instruction?: string; type?: string; modifier?: string }
          distance: number
          duration: number
          name?: string
        }[] = osrmRoute.legs[0].steps ?? []

        const routeSteps: RouteStep[] = osrmSteps.map((step) => ({
          instruction: step.maneuver?.instruction ?? 'Continuer tout droit',
          distance: step.distance,
          duration: step.duration,
          name: step.name ?? '',
        }))

        if (!controller.signal.aborted) {
          // Store in cache
          cacheRef.current.set(key, {
            route: geometry,
            distance: routeDistance,
            duration: routeDuration,
            isFallback: false,
            steps: routeSteps,
          })
          setRoute(geometry)
          setDistance(routeDistance)
          setDuration(routeDuration)
          setSteps(routeSteps)
          setIsFallback(false)
          setError(null)
        }
      } catch (err: unknown) {
        if (controller.signal.aborted) return

        console.error('[useWayfinding] OSRM error, falling back to straight line:', err)

        // ─── Fallback: straight-line ────────────────────────────────
        const fallbackRoute = buildStraightLine(patientPosition, destination)
        const straightDist = haversineMeters(patientPosition, destination)
        const fallbackDuration = (straightDist / 1000 / MODE_SPEED_KMH[mode]) * 3600

        // Cache the fallback too (avoid re-fetching a known-broken route)
        cacheRef.current.set(key, {
          route: fallbackRoute,
          distance: straightDist,
          duration: fallbackDuration,
          isFallback: true,
          steps: [],
        })

        setRoute(fallbackRoute)
        setDistance(straightDist)
        setDuration(fallbackDuration)
        setSteps([])
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientPosition?.lat, patientPosition?.lng, destination?.lat, destination?.lng, mode])

  return { route, distance, duration, steps, loading, error, isFallback, clear }
}
