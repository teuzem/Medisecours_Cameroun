'use client'

import { useEffect, useRef } from 'react'
import type { CarteCentre } from '../../lib/carte'
import { FACILITY_COLORS } from '../../lib/carte'
import type { Position } from '../../hooks/useWayfinding'
import { getMapboxToken } from '../../lib/mapboxMaps'

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
}

const CAMEROUN_CENTER: [number, number] = [11.65, 4.05]

function markerElement(color: string, selected: boolean) {
  const el = document.createElement('button')
  el.type = 'button'
  el.style.cssText = [
    `width:${selected ? 34 : 28}px`,
    `height:${selected ? 34 : 28}px`,
    'border-radius:50% 50% 50% 0',
    'transform:rotate(-45deg)',
    `background:${color}`,
    'border:3px solid #fff',
    'box-shadow:0 3px 10px rgba(0,0,0,.35)',
    'cursor:pointer',
  ].join(';')
  const dot = document.createElement('span')
  dot.style.cssText = 'display:block;width:9px;height:9px;border-radius:50%;background:#fff;transform:rotate(45deg);margin:auto'
  el.appendChild(dot)
  return el
}

export default function MapboxCarteMap({ centres, selectedId, position, onSelect, route, destination }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])

  useEffect(() => {
    if (!containerRef.current || !window.mapboxgl || mapRef.current) return
    const map = new window.mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: CAMEROUN_CENTER,
      zoom: 5.5,
      attributionControl: true,
    })
    map.addControl(new window.mapboxgl.NavigationControl(), 'top-right')
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
    if (!map) return
    markersRef.current.forEach((marker) => marker.remove())
    markersRef.current = centres
      .filter((centre) => centre.latitude != null && centre.longitude != null)
      .map((centre) => {
        const marker = new window.mapboxgl.Marker({
          element: markerElement(FACILITY_COLORS[centre.type] ?? '#64748B', centre.id === selectedId),
        })
          .setLngLat([centre.longitude, centre.latitude])
          .setPopup(new window.mapboxgl.Popup({ offset: 18 }).setHTML(`<strong>${centre.nom}</strong><br>${centre.adresse ?? ''}`))
          .addTo(map)
        marker.getElement().addEventListener('click', () => onSelect?.(centre.id))
        return marker
      })
  }, [centres, onSelect, selectedId])

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
      map.addSource(sourceId, {
        type: 'geojson',
        data: data ?? { type: 'FeatureCollection', features: [] },
      })
      map.addLayer({
        id: sourceId,
        type: 'line',
        source: sourceId,
        paint: { 'line-color': '#1D4E89', 'line-width': 5, 'line-opacity': 0.85 },
      })
    }
    if (map.isStyleLoaded()) update()
    else map.once('load', update)
  }, [route])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const target = destination ?? (position ? { lat: position.lat, lng: position.lng } : null)
    if (target) map.flyTo({ center: [target.lng, target.lat], zoom: 13, essential: true })
  }, [destination, position])

  void getMapboxToken
  return <div ref={containerRef} className="h-full w-full" aria-label="Carte Mapbox" />
}
