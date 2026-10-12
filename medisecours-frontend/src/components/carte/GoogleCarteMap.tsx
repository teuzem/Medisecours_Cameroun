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
import { bindFacilityPopupInteractions, facilityMarkerHtml, facilityMarkerPopupHtml } from '../../lib/facilityMarker'
import { useTranslation } from 'react-i18next'

interface RouteGeometry {
  type: 'LineString'
  coordinates: [number, number][]
}

export type BasemapMode = 'plan' | 'satellite' | 'relief'

interface GoogleCarteMapProps {
  centres: CarteCentre[]
  selectedId?: number | null
  position?: Position | null
  accuracy?: number | null
  onSelect?: (id: number) => void
  route?: RouteGeometry | null
  isFallback?: boolean
  destination?: { lat: number; lng: number; nom?: string } | null
  basemap?: BasemapMode
  traffic?: boolean
  transit?: boolean
  cycling?: boolean
  flyTo?: { lat: number; lng: number } | null
  onRequestDirections?: (id: number) => void
  onToggleFavorite?: (id: number) => void
  favoriteIds?: number[]
}

const CAMEROUN_CENTER = { lat: 4.05, lng: 11.65 }
const DEFAULT_ZOOM = 6

function FACILITY_COLOR(type: string): string {
  return FACILITY_COLORS[type as keyof typeof FACILITY_COLORS] ?? '#64748B'
}

/** Épingle ronde colorée par type — mêmes couleurs que la version Leaflet. */
function makePinContent(color: string, selected: boolean, name: string): HTMLDivElement {
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
  element.style.cssText = 'cursor:pointer'
  element.innerHTML = facilityMarkerHtml(color, selected, name)
  return element
}

/** Dot bleu « Vous êtes ici » avec double halo pulsant — position GPS de l'utilisateur. */
function makeUserContent(): HTMLDivElement {
  const element = document.createElement('div')
  element.style.cssText = 'position:relative;width:24px;height:24px;'
  element.innerHTML = `
    <div style="position:absolute;inset:-4px;border-radius:50%;border:2px solid rgba(26,115,232,0.55);animation:cartePatientPulse 1.6s ease-out infinite;"></div>
    <div style="position:absolute;inset:-4px;border-radius:50%;border:2px solid rgba(26,115,232,0.4);animation:cartePatientPulse 1.6s ease-out 0.8s infinite;"></div>
    <div style="position:absolute;inset:0;border-radius:50%;background:#1a73e8;border:3px solid #fff;box-shadow:0 1px 8px rgba(26,115,232,0.65);"></div>`
  const style = document.createElement('style')
  style.textContent = `
    @keyframes cartePatientPulse {
      0%   { transform: scale(1);   opacity: 0.8; }
      50%  { transform: scale(2.2); opacity: 0; }
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
  accuracy = null,
  onSelect,
  route,
  isFallback = false,
  destination,
  basemap = 'plan',
  traffic = false,
  transit = false,
  cycling = false,
  flyTo = null,
  onRequestDirections,
  onToggleFavorite,
  favoriteIds = [],
}: GoogleCarteMapProps) {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const clustererRef = useRef<MarkerClusterer | null>(null)
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([])
  const patientRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null)
  const accuracyCircleRef = useRef<google.maps.Circle | null>(null)
  const destinationRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null)
  const polylineRef = useRef<google.maps.Polyline | null>(null)
  const recenteredRef = useRef(false)
  const trafficLayerRef = useRef<google.maps.TrafficLayer | null>(null)
  const transitLayerRef = useRef<google.maps.TransitLayer | null>(null)
  const cyclingLayerRef = useRef<{ setMap: (map: google.maps.Map | null) => void } | null>(null)

  const routePath = useMemo(() => {
    return route ? route.coordinates.map(([lng, lat]) => ({ lat, lng })) : null
  }, [route])

  // ── Création de la carte (une fois) ───────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || !window.google?.maps) return
    const map = new window.google.maps.Map(containerRef.current, {
      zoom: DEFAULT_ZOOM,
      center: CAMEROUN_CENTER,
      mapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID',
      mapTypeId: 'roadmap',
      fullscreenControl: false,
      mapTypeControl: false,
      streetViewControl: false,
      zoomControl: true,
      zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_BOTTOM },
    })
    mapRef.current = map

    return () => {
      clustererRef.current?.clearMarkers()
      markersRef.current.forEach((marker) => (marker.map = null))
      markersRef.current = []
      if (patientRef.current) patientRef.current.map = null
      if (accuracyCircleRef.current) accuracyCircleRef.current.setMap(null)
      if (destinationRef.current) destinationRef.current.map = null
      polylineRef.current?.setMap(null)
      trafficLayerRef.current?.setMap(null)
      transitLayerRef.current?.setMap(null)
      cyclingLayerRef.current?.setMap(null)
      mapRef.current = null
      clustererRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (map && flyTo) {
      map.panTo({ lat: flyTo.lat, lng: flyTo.lng })
      if (map.getZoom() != null && map.getZoom() < 13) map.setZoom(13)
    }
  }, [flyTo])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    map.setMapTypeId(basemap === 'satellite' ? 'satellite' : basemap === 'relief' ? 'terrain' : 'roadmap')
  }, [basemap])

  // ── Calques superposés (Google uniquement) ───────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !window.google?.maps) return
    try {
      trafficLayerRef.current?.setMap(traffic ? map : null)
      if (traffic && !trafficLayerRef.current) {
        trafficLayerRef.current = new window.google.maps.TrafficLayer()
        trafficLayerRef.current.setMap(map)
      }
    } catch { /* SDK sans TrafficLayer */ }
  }, [traffic])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !window.google?.maps) return
    try {
      transitLayerRef.current?.setMap(transit ? map : null)
      if (transit && !transitLayerRef.current) {
        transitLayerRef.current = new window.google.maps.TransitLayer()
        transitLayerRef.current.setMap(map)
      }
    } catch { /* SDK sans TransitLayer */ }
  }, [transit])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !window.google?.maps) return
    try {
      cyclingLayerRef.current?.setMap(cycling ? map : null)
      if (cycling && !cyclingLayerRef.current) {
        const LayerCtor = (window.google.maps as any).BicyclingLayer
        if (LayerCtor) {
          cyclingLayerRef.current = new LayerCtor()
          cyclingLayerRef.current.setMap(map)
        }
      }
    } catch { /* SDK sans BicyclingLayer */ }
  }, [cycling])

  // ── Marqueurs des établissements (regroupés) ─────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    markersRef.current.forEach((marker) => {
      ;(marker as any).__medisecoursCleanup?.()
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
        content: makePinContent(FACILITY_COLOR(centre.type), selected, centre.nom),
        zIndex: selected ? 1000 : undefined,
      })
      const markerContent = marker.content as HTMLElement | null
      const popupElement = document.createElement('div')
      popupElement.innerHTML = facilityMarkerPopupHtml(centre, {
        directions: t('visitor.carte.markerDirections'),
        save: t('visitor.carte.markerSave'),
        saved: t('visitor.carte.markerSaved'),
        isSaved: favoriteIds.includes(centre.id),
        open: t('visitor.carte.markerOpen'),
        closed: t('visitor.carte.markerClosed'),
        unknown: t('visitor.carte.markerUnknown'),
        closesAt: t('visitor.carte.markerClosesAt'),
        accessibility: t('visitor.carte.markerAccessibility'),
        ambulances: t('visitor.carte.markerAmbulances'),
        gallery: t('visitor.carte.markerGallery'),
        galleryPrevious: t('visitor.carte.markerGalleryPrevious'),
        galleryNext: t('visitor.carte.markerGalleryNext'),
        holiday: t('visitor.carte.markerHoliday'),
        emergency: t('visitor.carte.markerEmergency'),
        reviews: t('common.map.reviews'),
      })
      const popup = new window.google.maps.InfoWindow({
        content: popupElement,
      })
      let closeTimer: number | null = null
      let popupCleanup: (() => void) | null = null
      const clearCloseTimer = () => {
        if (closeTimer != null) {
          window.clearTimeout(closeTimer)
          closeTimer = null
        }
      }
      const scheduleClose = () => {
        clearCloseTimer()
        closeTimer = window.setTimeout(() => {
          popup.close()
          closeTimer = null
        }, 1800)
      }
      const openPopup = () => {
        clearCloseTimer()
        popup.open({ map, anchor: marker })
      }
      const handleMarkerEnter = () => openPopup()
      const handleMarkerLeave = () => scheduleClose()
      const handleMarkerNameClick = (event: Event) => {
        event.preventDefault()
        event.stopPropagation()
        clearCloseTimer()
        onSelect(centre.id)
      }
      markerContent?.addEventListener('mouseenter', handleMarkerEnter)
      markerContent?.addEventListener('mouseleave', handleMarkerLeave)
      const markerName = markerContent?.querySelector<HTMLElement>('.maps-marker-name')
      markerName?.addEventListener('click', handleMarkerNameClick)
      const handlePopupEnter = () => clearCloseTimer()
      const handlePopupLeave = () => scheduleClose()
      popupElement.addEventListener('mouseenter', handlePopupEnter)
      popupElement.addEventListener('mouseleave', handlePopupLeave)
      const bindPopup = () => {
        popupCleanup?.()
        popupCleanup = bindFacilityPopupInteractions(popupElement, centre.id, {
          onSelect,
          onDirections: onRequestDirections,
          onToggleFavorite,
          onEnter: clearCloseTimer,
          onLeave: scheduleClose,
        })
      }
      const domReadyListener = popup.addListener('domready', bindPopup)
      marker.addEventListener('gmp-click', () => {
        openPopup()
      })
      const closeListener = popup.addListener('closeclick', () => {
        clearCloseTimer()
        popupCleanup?.()
        popupCleanup = null
      })
      ;(marker as any).__medisecoursCleanup = () => {
        clearCloseTimer()
        popupCleanup?.()
        popupCleanup = null
        closeListener.remove()
        domReadyListener.remove()
        markerContent?.removeEventListener('mouseenter', handleMarkerEnter)
        markerContent?.removeEventListener('mouseleave', handleMarkerLeave)
        markerName?.removeEventListener('click', handleMarkerNameClick)
        popupElement.removeEventListener('mouseenter', handlePopupEnter)
        popupElement.removeEventListener('mouseleave', handlePopupLeave)
        popup.close()
      }
      markers.push(marker)
    })
    markersRef.current = markers

    if (clustererRef.current) {
      clustererRef.current.clearMarkers()
      clustererRef.current.addMarkers(markers)
    } else {
      clustererRef.current = new MarkerClusterer({ map, markers })
    }
  }, [centres, favoriteIds, onRequestDirections, onSelect, onToggleFavorite, selectedId, t])

  // ── Dot bleu "Vous êtes ici" + cercle de précision GPS ────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (!position) {
      if (patientRef.current) patientRef.current.map = null
      patientRef.current = null
      if (accuracyCircleRef.current) accuracyCircleRef.current.setMap(null)
      accuracyCircleRef.current = null
      return
    }
    if (!patientRef.current) {
      patientRef.current = new window.google.maps.marker.AdvancedMarkerElement({
        map,
        position,
        title: t('common.map.youAreHere'),
        content: makeUserContent(),
        zIndex: 9999,
      })
    } else {
      patientRef.current.position = position
      patientRef.current.title = t('common.map.youAreHere')
      patientRef.current.zIndex = 9999
    }
    if (accuracy != null && accuracy > 0) {
      if (!accuracyCircleRef.current) {
        accuracyCircleRef.current = new window.google.maps.Circle({
          map,
          center: position,
          radius: accuracy,
          clickable: false,
          strokeColor: '#1a73e8',
          strokeOpacity: 0.3,
          strokeWeight: 1,
          fillColor: '#1a73e8',
          fillOpacity: 0.1,
        })
      } else {
        accuracyCircleRef.current.setCenter(position)
        accuracyCircleRef.current.setRadius(accuracy)
        accuracyCircleRef.current.setMap(map)
      }
    } else if (accuracyCircleRef.current) {
      accuracyCircleRef.current.setMap(null)
      accuracyCircleRef.current = null
    }
  }, [position, accuracy, t])

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
