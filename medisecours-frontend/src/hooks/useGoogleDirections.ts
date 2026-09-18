'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Destination, Position, WayfindingMode, RouteStep } from './useWayfinding'
import { isGoogleMapsLoaded } from '../lib/googleMaps'

interface RouteGeometry {
  type: 'LineString'
  coordinates: [number, number][]
}

interface UseGoogleDirectionsParams {
  enabled: boolean
  position: Position | null
  destination: Destination | null
  mode: WayfindingMode
}

export interface UseGoogleDirectionsResult {
  route: RouteGeometry | null
  distance: number | null
  duration: number | null
  steps: RouteStep[]
  loading: boolean
  error: string | null
  isFallback: boolean
  clear: () => void
}

// Chaînes acceptées par google.maps.TravelMode — évite de toucher au global
// `google` au chargement du module (le script est injecté plus tard).
const TRAVEL_MODE: Record<WayfindingMode, string> = {
  driving: 'DRIVING',
  walking: 'WALKING',
  bicycling: 'BICYCLING',
}

function stripHtml(value: string): string {
  // Les instructions Google arrivent avec du HTML (<b>, <div>…) — on extrait le texte.
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Itinéraire temps réel via Google DirectionsService (DRIVING / WALKING / BICYCLING).
 * Utilisé quand Google Maps est le fournisseur actif ; sinon l'hook ne fait rien.
 * La forme du résultat est identique à useWayfinding (mêmes types RouteGeometry/RouteStep).
 */
export function useGoogleDirections({
  enabled,
  position,
  destination,
  mode,
}: UseGoogleDirectionsParams): UseGoogleDirectionsResult {
  const [route, setRoute] = useState<RouteGeometry | null>(null)
  const [distance, setDistance] = useState<number | null>(null)
  const [duration, setDuration] = useState<number | null>(null)
  const [steps, setSteps] = useState<RouteStep[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clear = useCallback(() => {
    setRoute(null)
    setDistance(null)
    setDuration(null)
    setSteps([])
    setLoading(false)
    setError(null)
  }, [])

  const googleReady = isGoogleMapsLoaded()

  const params = useMemo(
    () => ({ origin: position, destination }),
    [destination, position],
  )

  // Réinitialisation au rendu (pattern React "adjust state during render") :
  // dès que la demande expire (fournisseur désactivé / géolocalisation absente),
  // on purge l'ancien itinéraire sans setState dans un effet.
  const shouldReset =
    (!enabled || !googleReady || !params.origin || !params.destination) &&
    (route !== null || distance !== null || duration !== null || steps.length > 0 || loading || error !== null)
  if (shouldReset) {
    setRoute(null)
    setDistance(null)
    setDuration(null)
    setSteps([])
    setLoading(false)
    setError(null)
  }

  useEffect(() => {
    if (!enabled || !googleReady || !params.origin || !params.destination) return

    const service = new window.google.maps.DirectionsService()
    let cancelled = false

    const fetchRoute = async () => {
      setLoading(true)
      setError(null)

      service.route(
        {
          origin: params.origin,
          destination: params.destination,
          travelMode: TRAVEL_MODE[mode] as google.maps.TravelMode,
          provideRouteAlternatives: false,
          unitSystem: window.google.maps.UnitSystem.METRIC,
        },
        (result, status) => {
          if (cancelled) return
          setLoading(false)

          if (status === 'OK' && result && result.routes.length > 0) {
            const selected = result.routes[0]
            const overview = selected.overview_path ?? []
            if (overview.length < 2) {
              setRoute(null)
              setDistance(null)
              setDuration(null)
              setSteps([])
              setError('Aucun itinéraire calculé par Google.')
              return
            }

            const geometry: RouteGeometry = {
              type: 'LineString',
              coordinates: overview.map((p) => [p.lng(), p.lat()] as [number, number]),
            }

            const leg = selected.legs[0]
            const routeSteps: RouteStep[] = (leg?.steps ?? []).map((step) => ({
              instruction: stripHtml(step.instructions ?? ''),
              distance: step.distance?.value ?? 0,
              duration: step.duration?.value ?? 0,
              name: '',
            }))

            setRoute(geometry)
            setDistance(leg?.distance?.value ?? null)
            setDuration(leg?.duration?.value ?? null)
            setSteps(routeSteps)
            setError(null)
          } else {
            setRoute(null)
            setDistance(null)
            setDuration(null)
            setSteps([])
            setError(
              status === 'ZERO_RESULTS'
                ? 'Aucun itinéraire trouvé par Google.'
                : `Directions indisponibles (${status}).`,
            )
          }
        },
      )
    }

    void fetchRoute()

    return () => {
      cancelled = true
    }
  }, [enabled, googleReady, params, mode])

  return { route, distance, duration, steps, loading, error, isFallback: false, clear }
}