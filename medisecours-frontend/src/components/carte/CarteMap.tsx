'use client'

import React, { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import { useTranslation } from 'react-i18next'
import { FACILITY_COLORS, type CarteCentre } from '../../lib/carte'
import type { Position } from '../../hooks/useWayfinding'
import { facilityMarkerHtml } from '../../lib/facilityMarker'

// ─── Fix default Leaflet icon paths ─────────────────────────────────────────
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const CAMEROUN_CENTER: [number, number] = [4.05, 11.65]
const DEFAULT_ZOOM = 6

const PULSE_STYLE = `
@keyframes cartePatientPulse {
  0%   { transform: scale(1);   opacity: 0.7; }
  50%  { transform: scale(2.4); opacity: 0; }
  100% { transform: scale(1);   opacity: 0; }
}
`

/** Dot bleu "Vous êtes ici" avec halo pulsant */
function makePatientIcon() {
  return L.divIcon({
    html: `
      <div style="position:relative;width:20px;height:20px;">
        <div style="position:absolute;inset:0;border-radius:50%;background:rgba(29,78,137,0.25);animation:cartePatientPulse 2s ease-in-out infinite;"></div>
        <div style="position:absolute;inset:0;border-radius:50%;background:#1D4E89;border:3px solid #fff;box-shadow:0 0 0 3px #1D4E89;"></div>
      </div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    className: '',
  })
}

const patientIcon = makePatientIcon()

/** Épingle ronde colorée par type d'établissement */
function makeFacilityIcon(color: string, selected: boolean) {
  const size = selected ? 34 : 26
  return L.divIcon({
    html: `
      <div style="
        width:${size}px;height:${size}px;
        border-radius:50% 50% 50% 0;
        transform: rotate(-45deg);
        background:${color};
        border:3px solid #fff;
        box-shadow:${selected ? `0 0 0 4px rgba(255,255,255,0.9), 0 0 0 7px ${color}, 0 6px 14px rgba(0,0,0,0.35)` : '0 3px 10px rgba(0,0,0,0.3)'};
        display:flex;align-items:center;justify-content:center;
      ">
        <span style="
          transform: rotate(45deg);
          width:${size - 12}px;height:${size - 12}px;
          border-radius:50%;
          background:#fff;
          display:block;
        "></span>
      </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    className: '',
  })
}

/** Épingle rouge pour la destination courante */
function makeDestinationIcon() {
  return L.divIcon({
    html: `
      <div style="
        width:24px;height:24px;border-radius:50%;
        background:#D32F2F;border:3px solid #fff;
        box-shadow:0 0 0 3px #D32F2F, 0 2px 8px rgba(211,47,47,0.4);
      "></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    className: '',
  })
}

const destinationIcon = makeDestinationIcon()

function PulseStyle() {
  const map = useMap()
  useEffect(() => {
    if (!map || !(map as any)._mapPane) return
    const container = map.getContainer()
    if (!container.querySelector('#carte-patient-pulse-style')) {
      const style = document.createElement('style')
      style.id = 'carte-patient-pulse-style'
      style.textContent = PULSE_STYLE
      container.appendChild(style)
    }
  }, [map])
  return null
}

function ForceMapRefresh() {
  const map = useMap()
  useEffect(() => {
    if (!map) return
    let alive = true
    const invalidate = () => {
      if (alive && map && (map as any)._mapPane) map.invalidateSize()
    }
    const timers = [100, 300, 600].map((ms) => setTimeout(invalidate, ms))
    const container = map.getContainer()
    let resizeObserver: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => invalidate())
      resizeObserver.observe(container)
    }
    const onResize = () => invalidate()
    window.addEventListener('resize', onResize)
    return () => {
      alive = false
      timers.forEach(clearTimeout)
      resizeObserver?.disconnect()
      window.removeEventListener('resize', onResize)
    }
  }, [map])
  return null
}

function MapAutoCenter({ coords }: { coords?: { lat: number; lng: number } }) {
  const map = useMap()
  useEffect(() => {
    if (coords && map && (map as any)._mapPane) {
      map.panTo([coords.lat, coords.lng], { animate: true, duration: 1 })
    }
    return () => {
      if (map && (map as any)._mapPane) map.stop()
    }
  }, [coords, map])
  return null
}

function FitBounds({
  position,
  destination,
}: {
  position: { lat?: number; lng?: number } | null
  destination: { lat?: number; lng?: number; nom?: string } | null
}) {
  const map = useMap()
  useEffect(() => {
    if (!map || !(map as any)._mapPane || !position) return
    if (destination?.lat != null && destination.lng != null) {
      map.fitBounds(
        L.latLngBounds([position.lat!, position.lng!], [destination.lat, destination.lng]).pad(0.25),
        { animate: true, maxZoom: 16 },
      )
    } else {
      map.flyTo([position.lat!, position.lng!], 13, { duration: 0.8 })
    }
    return () => {
      if (map && (map as any)._mapPane) map.stop()
    }
  }, [position, destination, map])
  return null
}

interface RouteGeometry {
  type: 'LineString'
  coordinates: [number, number][]
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface CarteMapProps {
  centres: CarteCentre[]
  selectedId?: number | null
  position?: Position | null
  onSelect?: (id: number) => void
  route?: RouteGeometry | null
  isFallback?: boolean
  destination?: { lat: number; lng: number; nom?: string } | null
}

const FacilityMarker = React.memo(function FacilityMarker({
  c,
  selected,
  onSelect,
}: {
  c: CarteCentre
  selected: boolean
  onSelect?: (id: number) => void
}) {
  const { t } = useTranslation()
  const color = FACILITY_COLORS[c.type] ?? '#64748B'
  const icon = useMemo(() => L.divIcon({
    html: facilityMarkerHtml(color, selected, c.nom),
    iconSize: [180, 30], iconAnchor: [15, 15], className: '',
  }), [color, selected, c.nom])
  if (c.latitude == null || c.longitude == null) return null

  return (
    <Marker
      position={[c.latitude, c.longitude]}
      icon={icon}
      zIndexOffset={selected ? 1000 : 0}
      title={c.nom}
      eventHandlers={{ click: () => onSelect?.(c.id) }}
    >
      <Popup>
        <div className="w-44 text-sm" role="dialog" aria-label={t('visitor.components.centresMap.detailsFor', { name: c.nom })}>
          <p className="font-semibold text-slate-950">{c.nom}</p>
          <p className="text-slate-500">{c.adresse}</p>
          <button
            type="button"
            onClick={() => onSelect?.(c.id)}
            className="mt-2 w-full rounded-md bg-primary-600 px-2 py-1.5 text-xs font-bold text-white"
          >
            {t('visitor.carte.viewDetails')}
          </button>
        </div>
      </Popup>
    </Marker>
  )
})

export default function CarteMap({
  centres,
  selectedId,
  position,
  onSelect,
  route,
  isFallback = false,
  destination,
}: CarteMapProps) {
  const { t } = useTranslation()
  const routePositions: [number, number][] | null = useMemo(() => {
    return route
      ? route.coordinates.map(([lng, lat]) => [lat, lng] as [number, number])
      : null
  }, [route])

  return (
    <MapContainer
      center={CAMEROUN_CENTER}
      zoom={DEFAULT_ZOOM}
      className="h-full w-full"
      style={{ height: '100%', width: '100%' }}
      keyboard={true}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution="&copy; OpenStreetMap contributors &copy; CARTO"
      />
      <PulseStyle />
      <ForceMapRefresh />

      {position && !destination && <MapAutoCenter coords={position} />}
      <FitBounds position={position || null} destination={destination || null} />

      {position && (
        <Marker
          position={[position.lat, position.lng]}
          icon={patientIcon}
          zIndexOffset={1500}
          title={t('visitor.components.centresMap.yourPosition')}
        >
          <Popup>
            <div className="text-center text-sm font-medium" role="dialog" aria-label={t('visitor.components.centresMap.yourPosition')}>
              {t('visitor.components.centresMap.yourPosition')}
            </div>
          </Popup>
        </Marker>
      )}

      {centres.map((c) => (
        <FacilityMarker
          key={c.id}
          c={c}
          selected={selectedId === c.id}
          onSelect={onSelect}
        />
      ))}

      {destination && !centres.some((c) => c.latitude === destination.lat && c.longitude === destination.lng) && (
        <Marker
          position={[destination.lat, destination.lng]}
          icon={destinationIcon}
          zIndexOffset={1200}
          title={destination.nom}
        >
          <Popup>
            <div className="text-sm">
              <p className="font-semibold">{destination.nom}</p>
            </div>
          </Popup>
        </Marker>
      )}

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
