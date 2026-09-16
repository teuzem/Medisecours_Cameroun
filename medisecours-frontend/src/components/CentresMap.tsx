'use client'

import React, { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import { useTranslation } from 'react-i18next'

// ─── Fix default Leaflet icon paths ─────────────────────────────────────────
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// ─── Constants ──────────────────────────────────────────────────────────────
const CAMEROUN_CENTER: [number, number] = [4.0, 12.35]
const DEFAULT_ZOOM = 6

// ─── Custom Icons ───────────────────────────────────────────────────────────

/** Pulsating blue dot for the patient's live GPS position */
const patientIcon = L.divIcon({
  html: `
    <div style="position:relative;width:18px;height:18px;">
      <div style="
        position:absolute;inset:0;
        border-radius:50%;
        background:rgba(29,78,137,0.25);
        animation:patientPulse 2s ease-in-out infinite;
      "></div>
      <div style="
        position:absolute;inset:0;
        width:18px;height:18px;
        border-radius:50%;
        background:#1D4E89;
        border:3px solid #fff;
        box-shadow:0 0 0 3px #1D4E89;
      "></div>
    </div>
  `,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  className: '',
})

/** Red pin for the selected destination center */
const destinationIcon = L.divIcon({
  html: `<div style="
    width:22px;height:22px;
    border-radius:50%;
    background:#D32F2F;
    border:3px solid #fff;
    box-shadow:0 0 0 3px #D32F2F, 0 2px 8px rgba(211,47,47,0.4);
  "></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  className: '',
})

// ─── CSS injection for pulse animation ──────────────────────────────────────
const PULSE_STYLE = `
@keyframes patientPulse {
  0%   { transform: scale(1);   opacity: 0.7; }
  50%  { transform: scale(2.2); opacity: 0; }
  100% { transform: scale(1);   opacity: 0; }
}
`

// ─── Internal sub-components ────────────────────────────────────────────────

/** 🚀 COMPOSANT INTERNE : Force la carte à suivre le patient quand il se déplace */
function MapAutoCenter({ coords }: { coords?: { lat: number; lng: number } }) {
  const map = useMap()
  useEffect(() => {
    if (coords && map && (map as any)._mapPane) {
      // Aligne en douceur le centre de la carte sur la nouvelle position du patient
      map.panTo([coords.lat, coords.lng], { animate: true, duration: 1 })
    }
    return () => {
      if (map && (map as any)._mapPane) {
        map.stop()
      }
    }
  }, [coords, map])
  return null
}

/** Fits the map bounds to show both patient and destination simultaneously */
function FitBounds({
  position,
  destination,
}: {
  position: { lat: number; lng: number } | null
  destination: { lat: number; lng: number; nom?: string } | null
}) {
  const map = useMap()
  useEffect(() => {
    if (!map || !(map as any)._mapPane) return
    
    if (position && destination) {
      const bounds = L.latLngBounds(
        [position.lat, position.lng],
        [destination.lat, destination.lng]
      )
      map.fitBounds(bounds.pad(0.25), { animate: true, maxZoom: 16 })
    } else if (position && !destination) {
      // Destination cleared → fly back to patient position
      map.flyTo([position.lat, position.lng], 13, { duration: 0.8 })
    }

    return () => {
      if (map && (map as any)._mapPane) {
        map.stop()
      }
    }
  }, [position, destination, map])
  return null
}

/** Injects the pulse CSS animation into the map container */
function PulseStyle() {
  const map = useMap()
  useEffect(() => {
    if (!map || !(map as any)._mapPane) return
    const container = map.getContainer()
    if (!container.querySelector('#patient-pulse-style')) {
      const style = document.createElement('style')
      style.id = 'patient-pulse-style'
      style.textContent = PULSE_STYLE
      container.appendChild(style)
    }
  }, [map])
  return null
}

/**
 * Forces Leaflet to recalculate its container size.
 */
function ForceMapRefresh() {
  const map = useMap()
  useEffect(() => {
    if (!map) return
    let isMounted = true

    const invalidate = () => {
      if (!isMounted) return
      // Safe-guard against destroyed map pane
      if (map && (map as any)._mapPane) {
        map.invalidateSize()
      }
    }

    // ── Layer 1: Cascaded mount invalidations ────────────────────────────
    const timers = [100, 300, 600].map((ms) =>
      setTimeout(invalidate, ms)
    )

    // ── Layer 2: ResizeObserver on the map container ─────────────────────
    const container = map.getContainer()
    let resizeObserver: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => invalidate())
      resizeObserver.observe(container)
    }

    // ── Layer 3: Window resize fallback ──────────────────────────────────
    const onResize = () => invalidate()
    window.addEventListener('resize', onResize)

    return () => {
      isMounted = false
      timers.forEach(clearTimeout)
      resizeObserver?.disconnect()
      window.removeEventListener('resize', onResize)
    }
  }, [map])
  return null
}

const defaultIcon = new L.Icon.Default()

/**
 * Subcomponent to memoize individual markers so Leaflet doesn't recreate all DOM pins
 * on every render when other map state changes.
 */
const CentreMarker = React.memo(({
  c,
  isDest,
  onSelect
}: {
  c: any
  isDest: boolean
  onSelect?: (id: number) => void
}) => {
  const { t } = useTranslation()
  return (
    <Marker
      position={[c.latitude, c.longitude]}
      icon={isDest ? destinationIcon : defaultIcon}
      title={c.nom}
      eventHandlers={{ click: () => onSelect?.(c.id) }}
    >
      <Popup>
        <div className="text-sm" role="dialog" aria-label={t('visitor.components.centresMap.detailsFor', { name: c.nom })}>
          <p className="font-semibold">{c.nom}</p>
          <p>{c.adresse}</p>
          {c.telephone && <p>{c.telephone}</p>}
        </div>
      </Popup>
    </Marker>
  )
})
CentreMarker.displayName = 'CentreMarker'

// ─── Route geometry type ────────────────────────────────────────────────────
interface RouteGeometry {
  type: 'LineString'
  coordinates: [number, number][]
}

// ─── Component Props ────────────────────────────────────────────────────────
interface CentresMapProps {
  centres: any[]
  position?: { lat: number; lng: number }
  onSelect?: (id: number) => void
  route?: RouteGeometry | null
  isFallback?: boolean
  destination?: { lat: number; lng: number; nom?: string } | null
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function CentresMap({
  centres,
  position,
  onSelect,
  route,
  isFallback = false,
  destination,
}: CentresMapProps) {
  const { t } = useTranslation()
  // Convert GeoJSON [lng, lat] to Leaflet [lat, lng]
  const routePositions: [number, number][] | null = useMemo(() => {
    return route
      ? route.coordinates.map(([lng, lat]) => [lat, lng] as [number, number])
      : null
  }, [route])

  return (
    <MapContainer
      center={CAMEROUN_CENTER}
      zoom={DEFAULT_ZOOM}
      className="relative z-0"
      style={{ height: '100%', width: '100%' }}
      keyboard={true}
    >
      {/* 
        Fallback TileLayer strategy: Positron on bottom, OSM on top. 
        If OSM fails to load (offline or slow), Positron shows through.
      */}
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution="&copy; OpenStreetMap contributors &copy; CARTO"
      />
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap contributors"
      />

      {/* Inject pulse animation CSS */}
      <PulseStyle />

      {/* Force map refresh after CSS layout settling */}
      <ForceMapRefresh />

      {/* 🚀 INJECTION DU CENTRAGE AUTOMATIQUE */}
      {position && !destination && <MapAutoCenter coords={position} />}

      {/* Fit bounds when both patient and destination are set */}
      <FitBounds position={position || null} destination={destination || null} />

      {/* ═══ Patient position marker (pulsating blue dot) ═══ */}
      {position && (
        <Marker
          position={[position.lat, position.lng]}
          icon={patientIcon}
          zIndexOffset={1000}
          title={t('visitor.components.centresMap.yourPosition')}
        >
          <Popup>
            <div className="text-sm font-medium text-center" role="dialog" aria-label={t('visitor.components.centresMap.yourPosition')}>
              📍 {t('visitor.components.centresMap.yourPosition')}
            </div>
          </Popup>
        </Marker>
      )}

      {/* ═══ Centre markers ═══ */}
      {centres.map((c: any) => (
        <CentreMarker
          key={c.id}
          c={c}
          isDest={destination?.lat === c.latitude && destination?.lng === c.longitude}
          onSelect={onSelect}
        />
      ))}

      {/* ═══ Destination marker fallback (if it fell out of the centres list) ═══ */}
      {destination && !centres.some(c => c.latitude === destination.lat && c.longitude === destination.lng) && (
        <Marker
          position={[destination.lat, destination.lng]}
          icon={destinationIcon}
          zIndexOffset={900}
          title={destination.nom}
        >
          <Popup>
            <div className="text-sm" role="dialog" aria-label={t('visitor.components.centresMap.detailsFor', { name: destination.nom })}>
              <p className="font-semibold">{destination.nom}</p>
            </div>
          </Popup>
        </Marker>
      )}

      {/* ═══ Route polyline ═══ */}
      {routePositions && (
        <Polyline
          positions={routePositions}
          pathOptions={{
            color: isFallback ? '#E59C00' : '#1D4E89',
            weight: 5,
            opacity: 0.85,
            dashArray: isFallback ? '8 6' : undefined,
          }}
        />
      )}
    </MapContainer>
  )
}
