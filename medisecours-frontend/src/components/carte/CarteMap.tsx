'use client'

import React, { useEffect, useMemo, useRef } from 'react'
import { MapContainer, Marker, Popup, Polyline, Circle, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { useTranslation } from 'react-i18next'
import { FACILITY_COLORS, type CarteCentre } from '../../lib/carte'
import type { Position } from '../../hooks/useWayfinding'
import { bindFacilityPopupInteractions, facilityMarkerHtml, facilityMarkerPopupHtml } from '../../lib/facilityMarker'

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

/** Dot bleu « Vous êtes ici » avec double halo pulsant — position GPS de l'utilisateur. */
function makeUserIcon() {
  return L.divIcon({
    html: `
      <div style="position:relative;width:24px;height:24px;">
        <div style="position:absolute;inset:-4px;border-radius:50%;border:2px solid rgba(26,115,232,0.55);animation:cartePatientPulse 1.6s ease-out infinite;"></div>
        <div style="position:absolute;inset:-4px;border-radius:50%;border:2px solid rgba(26,115,232,0.4);animation:cartePatientPulse 1.6s ease-out 0.8s infinite;"></div>
        <div style="position:absolute;inset:0;border-radius:50%;background:#1a73e8;border:3px solid #fff;box-shadow:0 1px 8px rgba(26,115,232,0.65);"></div>
      </div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    className: '',
  })
}

const userIcon = makeUserIcon()

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
      map.flyTo([position.lat!, position.lng!], Math.max(map.getZoom(), 16), { duration: 0.8 })
    }
    return () => {
      if (map && (map as any)._mapPane) map.stop()
    }
  }, [position, destination, map])
  return null
}

/** Mode « préciser ma position » : un toucher sur la carte place le point exact. */
function PositionPicker({ onPick }: { onPick: (pos: { lat: number; lng: number }) => void }) {
  useMapEvents({
    click(event) {
      onPick({ lat: event.latlng.lat, lng: event.latlng.lng })
    },
  })
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
  accuracy?: number | null
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

const BASEMAP_TILES: Record<'plan' | 'satellite' | 'relief', { url: string; attribution: string; maxZoom: number }> = {
  plan: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri — Source: Esri, NAVTEQ, DeLorme',
    maxZoom: 19,
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics',
    maxZoom: 19,
  },
  relief: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors, SRTM | OpenTopoMap (CC-BY-SA)',
    maxZoom: 17,
  },
}

/** Bascule les tuiles de fond (Plan / Vue aérienne Esri / Relief OpenTopoMap). */
function BasemapLayer({ basemap }: { basemap: 'plan' | 'satellite' | 'relief' }) {
  const map = useMap()
  useEffect(() => {
    const spec = BASEMAP_TILES[basemap] ?? BASEMAP_TILES.plan
    const layer = L.tileLayer(spec.url, { attribution: spec.attribution, maxZoom: spec.maxZoom })
    layer.addTo(map)
    return () => {
      layer.remove()
    }
  }, [basemap, map])
  return null
}

/** Recentre la carte sur un lieu enregistré (Domicile / Travail / École). */
function FlyToTarget({ target }: { target: { lat: number; lng: number } | null }) {
  const map = useMap()
  useEffect(() => {
    if (!target) return
    map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 16), { duration: 0.8 })
  }, [map, target])
  return null
}

const FacilityMarker = React.memo(function FacilityMarker({
  c,
  selected,
  onSelect,
  onRequestDirections,
  onToggleFavorite,
  favoriteIds = [],
}: {
  c: CarteCentre
  selected: boolean
  onSelect?: (id: number) => void
  onRequestDirections?: (id: number) => void
  onToggleFavorite?: (id: number) => void
  favoriteIds?: number[]
}) {
  const { t } = useTranslation()
  const color = FACILITY_COLORS[c.type] ?? '#64748B'
  const closeTimer = useRef<number | null>(null)
  const popupCleanup = useRef<(() => void) | null>(null)
  const icon = useMemo(() => L.divIcon({
    html: facilityMarkerHtml(color, selected, c.nom),
    iconSize: [180, 30], iconAnchor: [15, 15], className: '',
  }), [color, selected, c.nom])
  if (c.latitude == null || c.longitude == null) return null

  const clearCloseTimer = () => {
    if (closeTimer.current != null) {
      window.clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }

  const scheduleClose = (marker: L.Marker) => {
    clearCloseTimer()
    closeTimer.current = window.setTimeout(() => {
      marker.closePopup()
      closeTimer.current = null
    }, 1800)
  }

  return (
    <Marker
      position={[c.latitude, c.longitude]}
      icon={icon}
      zIndexOffset={selected ? 1000 : 0}
      title={c.nom}
      eventHandlers={{
        click: (event: any) => {
          clearCloseTimer()
          const target = event.originalEvent?.target as HTMLElement | null
          if (target?.closest('.maps-marker-name')) {
            onSelect?.(c.id)
            return
          }
          event.target.openPopup()
        },
        mouseover: (event: any) => {
          clearCloseTimer()
          event.target.openPopup()
        },
        mouseout: (event: any) => scheduleClose(event.target),
        popupopen: (event: any) => {
          clearCloseTimer()
          const popupElement = event.popup?.getElement?.()
          if (popupElement) {
            popupCleanup.current?.()
            popupCleanup.current = bindFacilityPopupInteractions(popupElement, c.id, {
              onSelect,
              onDirections: onRequestDirections,
              onToggleFavorite,
              onEnter: clearCloseTimer,
              onLeave: () => scheduleClose(event.target),
            })
          }
        },
        popupclose: () => {
          clearCloseTimer()
          popupCleanup.current?.()
          popupCleanup.current = null
        },
      }}
    >
      <Popup closeButton={false} closeOnClick={false} autoClose={false}>
        <div
          dangerouslySetInnerHTML={{
            __html: facilityMarkerPopupHtml(c, {
              directions: t('visitor.carte.markerDirections'),
              save: t('visitor.carte.markerSave'),
              saved: t('visitor.carte.markerSaved'),
              isSaved: favoriteIds.includes(c.id),
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
            }),
          }}
          role="dialog"
          aria-label={t('visitor.components.centresMap.detailsFor', { name: c.nom })}
        />
      </Popup>
    </Marker>
  )
})

export default function CarteMap({
  centres,
  selectedId,
  position,
  accuracy = null,
  picking = false,
  onPickPosition,
  onSelect,
  route,
  isFallback = false,
  destination,
  basemap = 'satellite',
  flyTo = null,
  onRequestDirections,
  onToggleFavorite,
  favoriteIds = [],
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
      <BasemapLayer basemap={basemap} />
      <FlyToTarget target={flyTo} />
      <PulseStyle />
      <ForceMapRefresh />
      {picking && onPickPosition && <PositionPicker onPick={onPickPosition} />}

      {position && !destination && <MapAutoCenter coords={position} />}
      <FitBounds position={position || null} destination={destination || null} />

      {position && (
        <Marker
          position={[position.lat, position.lng]}
          icon={userIcon}
          zIndexOffset={3000}
          title={t('visitor.components.centresMap.yourPosition')}
        >
          <Popup>
            <div className="text-center" role="dialog" aria-label={t('visitor.components.centresMap.yourPosition')}>
              <p className="text-sm font-medium">{t('visitor.components.centresMap.yourPosition')}</p>
              {accuracy != null && accuracy > 0 && (
                <p className="mt-1 text-xs text-slate-500">{t('visitor.components.centresMap.accuracyMeters', { meters: Math.round(accuracy) })}</p>
              )}
              {accuracy != null && accuracy > 500 && (
                <p className="mt-1 text-xs font-semibold text-amber-600">{t('visitor.components.centresMap.approximatePosition')}</p>
              )}
            </div>
          </Popup>
        </Marker>
      )}

      {position && accuracy != null && accuracy > 0 && (
        <Circle
          center={[position.lat, position.lng]}
          radius={accuracy}
          pathOptions={{
            color: '#1a73e8',
            weight: 1,
            opacity: 0.35,
            fillColor: '#1a73e8',
            fillOpacity: 0.1,
            interactive: false,
          }}
        />
      )}

      {centres.map((c) => (
        <FacilityMarker
          key={c.id}
          c={c}
          selected={selectedId === c.id}
          onSelect={onSelect}
          onRequestDirections={onRequestDirections}
          onToggleFavorite={onToggleFavorite}
          favoriteIds={favoriteIds}
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
