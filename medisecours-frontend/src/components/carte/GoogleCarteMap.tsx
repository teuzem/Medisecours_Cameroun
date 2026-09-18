'use client'

/**
 * GoogleCarteMap — rendu plein écran type Google Maps (intégration Manus).
 *
 * - Marqueurs modernes AdvancedMarkerElement, colorés par type d'établissement.
 * - Regroupement automatique (MarkerClusterer) pour supporter des milliers
 *   d'établissements dans tout le Cameroun.
 * - Dot "Vous êtes ici" pulsant, épingle destination, itinéraire Google
 *   Directions (ou ligne approximative grisée en repli).
 * - UI native Google (zoom, plein écran, gestes), look & feel identique au
 *   module Google Maps d'origine.
 *
 * Repli Leaflet : voir CarteMap.tsx (mêmes props — échange transparent).
 */

import { useEffect, useMemo, useRef } from 'react'
import { MarkerClusterer } from '@googlemaps/markerclusterer'
import { FACILITY_COLORS, type CarteCentre } from '../../lib/carte'
import type { Position } from '../../hooks/useWayfinding'

interface RouteGeometry {
  type: 'LineString'
  coordinates: [number, number][]
}

interface GoogleCarteMapProps {
  centres: CarteCentre[]
  selectedId?: number | null
  position?: Position | null
  onSelect?: (id: number) => void
  route?: RouteGeometry | null
  isFallback?: boolean
  destination?: { lat: number; lng: number; nom?: string } | null
}

const CAMEROUN_CENTER = { lat: 4.05, lng: 11.65 }
const DEFAULT_ZOOM = 6

function FACILITY_COLOR(type: string): string {
  return FACILITY_COLORS[type as keyof typeof FACILITY_COLORS] ?? '#64748B'
}

/** Épingle ronde colorée par type — mêmes couleurs que la version Leaflet. */
function makePinContent(color: string, selected: boolean): HTMLDivElement {
  const size = selected ? 34 : 26
  const element = document.createElement('div')
  element.setAttribute('aria-hidden', 'true')
  element.style.cssText = [
    `width:${size}px`,
    `height:${size}px`,
    'border-radius:50% 50% 50% 0',
    'transform:rotate(-45deg)',
    `background:${color}`,
    'border:3px solid #fff',
    'box-shadow:0 3px 10px rgba(0,0,0,0.35)',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'cursor:pointer',
  ].join(';')

  if (selected) {
    element.style.boxShadow = `0 0 0 4px rgba(255,255,255,0.92), 0 0 0 7px ${color}, 0 6px 14px rgba(0,0,0,0.35)`
  }

  const pin = document.createElement('span')
  pin.style.cssText = [
    'transform:rotate(45deg)',
    `width:${size - 12}px`,
    `height:${size - 12}px`,
    'border-radius:50%',
    'background:#fff',
    'display:block',
  ].join(';')
  element.appendChild(pin)
  return element
}

/** Dot bleu "Vous êtes ici" avec halo pulsant. */
function makePatientContent(): HTMLDivElement {
  const element = document.createElement('div')
  element.style.cssText = 'position:relative;width:20px;height:20px;'
  element.innerHTML = `
    <div style="position:absolute;inset:0;border-radius:50%;background:rgba(29,78,137,0.25);animation:cartePatientPulse 2s ease-in-out infinite;"></div>
    <div style="position:absolute;inset:0;border-radius:50%;background:#1D4E89;border:3px solid #fff;box-shadow:0 0 0 3px #1D4E89;"></div>`
  const style = document.createElement('style')
  style.textContent = `
    @keyframes cartePatientPulse {
      0%   { transform: scale(1);   opacity: 0.7; }
      50%  { transform: scale(2.4); opacity: 0; }
      100% { transform: scale(1);   opacity: 0; }
    }`
  element.appendChild(style)
  return element
}

/** Épingle rouge pour une destination hors-établissement. */
function makeDestinationContent(): HTMLDivElement {
  const element = document.createElement('div')
  element.style.cssText = [
    'width:24px',
    'height:24px',
    'border-radius:50%',
    'background:#D32F2F',
    'border:3px solid #fff',
    'box-shadow:0 0 0 3px rgba(211,47,47,0.55), 0 2px 8px rgba(211,47,47,0.4)',
  ].join(';')
  return element
}

export default function GoogleCarteMap({
  centres,
  selectedId,
  position,
  onSelect,
  route,
  isFallback = false,
  destination,
}: GoogleCarteMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const clustererRef = useRef<MarkerClusterer | null>(null)
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([])
  const patientRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null)
  const destinationRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null)
  const polylineRef = useRef<google.maps.Polyline | null>(null)
  const recenteredRef = useRef(false)

  const routePath = useMemo(() => {
    return route ? route.coordinates.map(([lng, lat]) => ({ lat, lng })) : null
  }, [route])

  // ── Création de la carte (une fois) ───────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || !window.google?.maps) return
    const map = new window.google.maps.Map(containerRef.current, {
      zoom: DEFAULT_ZOOM,
      center: CAMEROUN_CENTER,
      mapTypeId: 'roadmap',
      fullscreenControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      zoomControl: true,
    })
    mapRef.current = map

    return () => {
      clustererRef.current?.clearMarkers()
      markersRef.current.forEach((marker) => (marker.map = null))
      markersRef.current = []
      if (patientRef.current) patientRef.current.map = null
      if (destinationRef.current) destinationRef.current.map = null
      polylineRef.current?.setMap(null)
      mapRef.current = null
      clustererRef.current = null
    }
  }, [])

  // ── Marqueurs des établissements (regroupés) ─────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    markersRef.current.forEach((marker) => {
      marker.map = null
    })
    markersRef.current = []

    const markers: google.maps.marker.AdvancedMarkerElement[] = []
    centres.forEach((centre) => {
      if (centre.latitude == null || centre.longitude == null) return
      const selected = centre.id === selectedId
      const marker = new window.google.maps.marker.AdvancedMarkerElement({
        map,
        position: { lat: centre.latitude, lng: centre.longitude },
        title: centre.nom,
        content: makePinContent(FACILITY_COLOR(centre.type), selected),
        zIndex: selected ? 1000 : undefined,
      })
      marker.addEventListener('click', () => onSelect?.(centre.id))
      markers.push(marker)
    })
    markersRef.current = markers

    if (clustererRef.current) {
      clustererRef.current.clearMarkers()
      clustererRef.current.addMarkers(markers)
    } else {
      clustererRef.current = new MarkerClusterer({ map, markers })
    }
  }, [centres, onSelect, selectedId])

  // ── Dot patient "Vous êtes ici" ─────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (!position) {
      if (patientRef.current) patientRef.current.map = null
      patientRef.current = null
      return
    }
    if (!patientRef.current) {
      patientRef.current = new window.google.maps.marker.AdvancedMarkerElement({
        map,
        position,
        title: 'Vous êtes ici',
        content: makePatientContent(),
      })
    } else {
      patientRef.current.position = position
    }
  }, [position])

  // ── Épingle destination (hors-establishment) ─────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const isKnownCentre =
      destination != null &&
      centres.some((c) => c.latitude === destination.lat && c.longitude === destination.lng)
    if (!destination || isKnownCentre) {
      if (destinationRef.current) destinationRef.current.map = null
      destinationRef.current = null
      return
    }
    if (!destinationRef.current) {
      destinationRef.current = new window.google.maps.marker.AdvancedMarkerElement({
        map,
        position: { lat: destination.lat, lng: destination.lng },
        title: destination.nom,
        content: makeDestinationContent(),
      })
    } else {
      destinationRef.current.position = { lat: destination.lat, lng: destination.lng }
    }
  }, [centres, destination])

  // ── Itinéraire (polyline) ───────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    polylineRef.current?.setMap(null)
    polylineRef.current = null
    if (!routePath || routePath.length < 2) return

    polylineRef.current = new window.google.maps.Polyline({
      map,
      path: routePath,
      strokeColor: isFallback ? '#E59C00' : '#1D4E89',
      strokeWeight: 5,
      strokeOpacity: 0.85,
      icons: isFallback
        ? [
            {
              icon: { path: 'M 0 -1 0 1' },
              offset: '0',
              repeat: '12px',
            },
          ]
        : undefined,
    })
  }, [isFallback, routePath])

  // ── Recentrage / cadrage ────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (position && destination) {
      const bounds = new window.google.maps.LatLngBounds()
      bounds.extend(position)
      bounds.extend(destination)
      map.fitBounds(bounds, { top: 72, bottom: 40, left: 40, right: 40 })
      recenteredRef.current = true
      return
    }

    if (position && !recenteredRef.current) {
      map.panTo(position)
      map.setZoom(13)
      recenteredRef.current = true
    }
  }, [position, destination])

  return <div ref={containerRef} className="h-full w-full" aria-label="Carte Google" />
}