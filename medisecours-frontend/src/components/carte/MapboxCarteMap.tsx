'use client'

import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { CarteCentre } from '../../lib/carte'
import { FACILITY_COLORS } from '../../lib/carte'
import type { Position } from '../../hooks/useWayfinding'
import { getMapboxToken } from '../../lib/mapboxMaps'
import { bindFacilityPopupInteractions, facilityMarkerHtml, facilityMarkerPopupHtml } from '../../lib/facilityMarker'

interface RouteGeometry {
  type: 'LineString'
  coordinates: [number, number][]
}

interface Props {
  centres: CarteCentre[]
  selectedId?: number | null
  position?: Position | null
  onSelect?: (id: number) => void
  route?: RouteGeometry | null
  destination?: { lat: number; lng: number; nom?: string } | null
  satellite?: boolean
  onRequestDirections?: (id: number) => void
  onToggleFavorite?: (id: number) => void
  favoriteIds?: number[]
}

const CAMEROUN_CENTER: [number, number] = [11.65, 4.05]

function markerElement(color: string, selected: boolean, name: string) {
  const el = document.createElement('button')
  el.type = 'button'
  el.style.cssText = 'background:transparent;border:0;cursor:pointer;padding:0'
  el.innerHTML = facilityMarkerHtml(color, selected, name)
  el.setAttribute('aria-label', name)
  return el
}

export default function MapboxCarteMap({ centres, selectedId, position, onSelect, route, destination, satellite = false, onRequestDirections, onToggleFavorite, favoriteIds = [] }: Props) {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const initialSatelliteRef = useRef(satellite)

  // The map instance is intentionally created once; satellite changes are applied by the dedicated style effect below.
  useEffect(() => {
    if (!containerRef.current || !window.mapboxgl || mapRef.current) return
    const map = new window.mapboxgl.Map({
      container: containerRef.current,
      style: initialSatelliteRef.current ? 'mapbox://styles/mapbox/satellite-streets-v12' : 'mapbox://styles/mapbox/streets-v12',
      center: CAMEROUN_CENTER,
      zoom: 5.5,
      attributionControl: true,
    })
    map.addControl(new window.mapboxgl.NavigationControl(), 'bottom-right')
    mapRef.current = map
    return () => {
      markersRef.current.forEach((marker) => marker.remove())
      markersRef.current = []
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (map) map.setStyle(satellite ? 'mapbox://styles/mapbox/satellite-streets-v12' : 'mapbox://styles/mapbox/streets-v12')
  }, [satellite])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    markersRef.current.forEach((marker) => {
      marker.__medisecoursCleanup?.()
      marker.remove()
    })
    markersRef.current = centres
      .filter((centre) => centre.latitude != null && centre.longitude != null)
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
          element: markerElement(FACILITY_COLORS[centre.type] ?? '#64748B', centre.id === selectedId, centre.nom),
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
  }, [centres, favoriteIds, onRequestDirections, onSelect, onToggleFavorite, selectedId, t])

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
        return
      }
      map.addSource(sourceId, { type: 'geojson', data: data ?? { type: 'FeatureCollection', features: [] } })
      map.addLayer({
        id: sourceId,
        type: 'line',
        source: sourceId,
        paint: { 'line-color': '#1D4E89', 'line-width': 5, 'line-opacity': 0.85 },
      })
    }
    if (map.isStyleLoaded()) update()
    map.on('style.load', update)
    return () => map.off('style.load', update)
  }, [route])

  useEffect(() => {
    const map = mapRef.current
    const target = destination ?? (position ? { lat: position.lat, lng: position.lng } : null)
    if (map && target) map.flyTo({ center: [target.lng, target.lat], zoom: 13, essential: true })
  }, [destination, position])

  void getMapboxToken
  return <div ref={containerRef} className="h-full w-full" aria-label="Carte Mapbox" />
}
