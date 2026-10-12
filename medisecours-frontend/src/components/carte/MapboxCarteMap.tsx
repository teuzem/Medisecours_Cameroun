'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CarteCentre } from '../../lib/carte'
import { clusterBubbleHtml, clusterPoints } from '../../lib/markerCluster'
import type { Position } from '../../hooks/useWayfinding'
import { getMapboxToken } from '../../lib/mapboxMaps'
import { bindFacilityPopupInteractions, FACILITY_GLYPH, facilityMarkerHtml, facilityMarkerPopupHtml, type MarkerGlyph } from '../../lib/facilityMarker'

interface RouteGeometry {
  type: 'LineString'
  coordinates: [number, number][]
}

interface Props {
  centres: CarteCentre[]
  selectedId?: number | null
  position?: Position | null
  picking?: boolean
  onPickPosition?: (pos: { lat: number; lng: number }) => void
  onSelect?: (id: number) => void
  route?: RouteGeometry | null
  isFallback?: boolean
  destination?: { lat: number; lng: number; nom?: string } | null
  basemap?: 'plan' | 'satellite' | 'relief'
  flyTo?: { lat: number; lng: number } | null
  onRequestDirections?: (id: number) => void
  onToggleFavorite?: (id: number) => void
  favoriteIds?: number[]
}

const MAPBOX_STYLES: Record<'plan' | 'satellite' | 'relief', string> = {
  plan: 'mapbox://styles/mapbox/streets-v12',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
  relief: 'mapbox://styles/mapbox/outdoors-v12',
}

const CAMEROUN_CENTER: [number, number] = [11.65, 4.05]

function markerElement(selected: boolean, name: string, glyph: MarkerGlyph) {
  const el = document.createElement('button')
  el.type = 'button'
  el.style.cssText = 'background:transparent;border:0;cursor:pointer;padding:0'
  el.innerHTML = facilityMarkerHtml(selected, name, glyph)
  el.setAttribute('aria-label', name)
  return el
}

function userMarkerElement(label: string) {
  const el = document.createElement('div')
  el.setAttribute('role', 'img')
  el.setAttribute('aria-label', label)
  el.title = label
  el.style.cssText = 'position:relative;width:24px;height:24px;cursor:default'
  el.innerHTML = `
    <span style="position:absolute;inset:-10px;border-radius:9999px;border:2px solid rgba(26,115,232,0.45);animation:medisecours-patient-pulse 1.8s ease-out infinite"></span>
    <span style="position:absolute;inset:0;border-radius:9999px;border:3px solid #fff;background:#1a73e8;box-shadow:0 1px 6px rgba(0,0,0,0.45)"></span>
  `
  return el
}

export default function MapboxCarteMap({ centres, selectedId, position, picking = false, onPickPosition, onSelect, route, isFallback = false, destination, basemap = 'satellite', flyTo = null, onRequestDirections, onToggleFavorite, favoriteIds = [] }: Props) {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const patientMarkerRef = useRef<any>(null)
  const initialBasemapRef = useRef(basemap)
  const [mapZoom, setMapZoom] = useState(5.5)

  // The map instance is intentionally created once; satellite changes are applied by the dedicated style effect below.
  useEffect(() => {
    if (!containerRef.current || !window.mapboxgl || mapRef.current) return
    if (!document.getElementById('mapbox-patient-pulse-style')) {
      const style = document.createElement('style')
      style.id = 'mapbox-patient-pulse-style'
      style.textContent = `
        @keyframes medisecours-patient-pulse {
          0%   { transform: scale(1);   opacity: 0.8; }
          50%  { transform: scale(2.2); opacity: 0; }
          100% { transform: scale(1);   opacity: 0; }
        }`
      document.head.appendChild(style)
    }
    const map = new window.mapboxgl.Map({
      container: containerRef.current,
      style: MAPBOX_STYLES[initialBasemapRef.current] ?? MAPBOX_STYLES.satellite,
      center: CAMEROUN_CENTER,
      zoom: 5.5,
      attributionControl: true,
    })
    map.addControl(new window.mapboxgl.NavigationControl(), 'bottom-right')
    mapRef.current = map
    return () => {
      markersRef.current.forEach((marker) => marker.remove())
      markersRef.current = []
      patientMarkerRef.current?.remove()
      patientMarkerRef.current = null
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (map) map.setStyle(MAPBOX_STYLES[basemap] ?? MAPBOX_STYLES.satellite)
  }, [basemap])

  // Suit le zoom pour le regroupement anti-chevauchement.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const sync = () => setMapZoom(map.getZoom())
    sync()
    map.on('zoomend', sync)
    return () => {
      map.off('zoomend', sync)
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    markersRef.current.forEach((marker) => {
      marker.__medisecoursCleanup?.()
      marker.remove()
    })
    // Regroupement anti-chevauchement : les structures proches fusionnent
    // en pastille de comptage (un toucher zoome pour détailler).
    const groupes = clusterPoints(centres, mapZoom)
    const regroupes = new Set(groupes.filter((groupe) => groupe.ids.length > 1).flatMap((groupe) => groupe.ids))
    const marqueursEtablissements = centres
      .filter((centre) => centre.latitude != null && centre.longitude != null && !regroupes.has(centre.id))
      .map((centre) => {
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
        const popup = new window.mapboxgl.Popup({ offset: 18, closeButton: false, closeOnClick: false }).setDOMContent(popupElement)
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
            popup.remove()
            closeTimer = null
        }, 1800)
        }
        const marker = new window.mapboxgl.Marker({
          element: markerElement(centre.id === selectedId, centre.nom, FACILITY_GLYPH[centre.type] ?? 'pin'),
        })
          .setLngLat([centre.longitude!, centre.latitude!])
          .setPopup(popup)
          .addTo(map)
        const markerElementNode = marker.getElement()
        const handleMarkerEnter = () => {
          clearCloseTimer()
          popup.setLngLat([centre.longitude!, centre.latitude!]).addTo(map)
        }
        const handleMarkerLeave = () => scheduleClose()
        const handleMarkerClick = () => {
          clearCloseTimer()
          popup.setLngLat([centre.longitude!, centre.latitude!]).addTo(map)
        }
        const handleMarkerNameClick = (event: Event) => {
          event.preventDefault()
          event.stopPropagation()
          clearCloseTimer()
          onSelect(centre.id)
        }
        markerElementNode.addEventListener('mouseenter', handleMarkerEnter)
        markerElementNode.addEventListener('mouseleave', handleMarkerLeave)
        markerElementNode.addEventListener('click', handleMarkerClick)
        ;(markerElementNode as HTMLElement).querySelector('.maps-marker-name')?.addEventListener('click', handleMarkerNameClick)
        const handlePopupEnter = () => clearCloseTimer()
        const handlePopupLeave = () => scheduleClose()
        popupElement.addEventListener('mouseenter', handlePopupEnter)
        popupElement.addEventListener('mouseleave', handlePopupLeave)
        popup.on('open', () => {
          clearCloseTimer()
          popupCleanup?.()
          popupCleanup = bindFacilityPopupInteractions(popupElement, centre.id, {
            onSelect,
            onDirections: onRequestDirections,
            onToggleFavorite,
            onEnter: clearCloseTimer,
            onLeave: scheduleClose,
          })
        })
        popup.on('close', () => {
          clearCloseTimer()
          popupCleanup?.()
          popupCleanup = null
        })
        const cleanup = () => {
          clearCloseTimer()
          popupCleanup?.()
          popupCleanup = null
          markerElementNode.removeEventListener('mouseenter', handleMarkerEnter)
          markerElementNode.removeEventListener('mouseleave', handleMarkerLeave)
          markerElementNode.removeEventListener('click', handleMarkerClick)
          ;(markerElementNode as HTMLElement).querySelector('.maps-marker-name')?.removeEventListener('click', handleMarkerNameClick)
          popupElement.removeEventListener('mouseenter', handlePopupEnter)
          popupElement.removeEventListener('mouseleave', handlePopupLeave)
          popup.remove()
          marker.remove()
        }
        ;(marker as any).__medisecoursCleanup = cleanup
        return marker
      })
    const marqueursGroupes = groupes
      .filter((groupe) => groupe.ids.length > 1)
      .map((groupe) => {
        const element = document.createElement('div')
        element.innerHTML = clusterBubbleHtml(groupe.ids.length)
        const bulle = element.firstElementChild as HTMLElement | null
        const marker = new window.mapboxgl.Marker({ element: bulle ?? element })
          .setLngLat([groupe.lng, groupe.lat])
          .addTo(map)
        const zoomer = () => {
          map.flyTo({ center: [groupe.lng, groupe.lat], zoom: Math.min(map.getZoom() + 2, 18), essential: true })
        }
        ;(bulle ?? element).addEventListener('click', zoomer)
        ;(marker as any).__medisecoursCleanup = () => {
          ;(bulle ?? element).removeEventListener('click', zoomer)
          marker.remove()
        }
        return marker
      })
    markersRef.current = [...marqueursEtablissements, ...marqueursGroupes]
  }, [centres, favoriteIds, onRequestDirections, onSelect, onToggleFavorite, selectedId, t, mapZoom])

  // Position GPS de l'utilisateur (dot bleu) — créée une fois,
  // déplacée à chaque changement de position GPS.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (!position) {
      patientMarkerRef.current?.remove()
      patientMarkerRef.current = null
      return
    }
    if (!patientMarkerRef.current) {
      patientMarkerRef.current = new window.mapboxgl.Marker({
        element: userMarkerElement(t('common.map.youAreHere')),
      })
        .setLngLat([position.lng, position.lat])
        .addTo(map)
    } else {
      patientMarkerRef.current.setLngLat([position.lng, position.lat])
    }
  }, [position, t])

  // ── Mode « préciser ma position » : un toucher place le point exact ───
  useEffect(() => {
    const map = mapRef.current
    if (!map || !picking || !onPickPosition) return
    const handler = (event: { lngLat: { lng: number; lat: number } }) => {
      onPickPosition({ lat: event.lngLat.lat, lng: event.lngLat.lng })
    }
    map.on('click', handler)
    return () => {
      map.off('click', handler)
    }
  }, [picking, onPickPosition])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const sourceId = 'medisecours-route'
    const data = route?.coordinates?.length
      ? { type: 'Feature', geometry: { type: 'LineString', coordinates: route.coordinates } }
      : null
    const update = () => {
      if (map.getSource(sourceId)) {
        map.getSource(sourceId).setData(data ?? { type: 'FeatureCollection', features: [] })
        if (map.getLayer(sourceId)) {
          map.setPaintProperty(sourceId, 'line-color', isFallback ? '#E59C00' : '#1D4E89')
          map.setPaintProperty(sourceId, 'line-dasharray', isFallback ? [2, 1.5] : null)
        }
        return
      }
      map.addSource(sourceId, { type: 'geojson', data: data ?? { type: 'FeatureCollection', features: [] } })
      map.addLayer({
        id: sourceId,
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': isFallback ? '#E59C00' : '#1D4E89',
          'line-width': 5,
          'line-opacity': 0.85,
          ...(isFallback ? { 'line-dasharray': [2, 1.5] } : {}),
        },
      })
    }
    if (map.isStyleLoaded()) update()
    map.on('style.load', update)
    return () => map.off('style.load', update)
  }, [isFallback, route])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (destination) {
      map.flyTo({ center: [destination.lng, destination.lat], zoom: 16, essential: true })
    } else if (position) {
      map.flyTo({ center: [position.lng, position.lat], zoom: 13, essential: true })
    }
  }, [destination, position])

  useEffect(() => {
    const map = mapRef.current
    if (map && flyTo) {
      map.flyTo({ center: [flyTo.lng, flyTo.lat], zoom: Math.max(map.getZoom() ?? 0, 16), essential: true })
    }
  }, [flyTo])

  void getMapboxToken
  return <div ref={containerRef} className="h-full w-full" aria-label={t('visitor.carte.title')} />
}
