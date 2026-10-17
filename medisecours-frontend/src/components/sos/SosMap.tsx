'use client'

import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'

/**
 * Carte de la position d'une alerte SOS.
 *
 * Leaflet + tuiles raster : aucune clé d'API à distribuer, aucun iframe
 * (openstreetmap.org interdit l'iframe via X-Frame-Options, d'où la carte
 * « Ce contenu est bloqué » constatée auparavant), et le même rendu que la
 * carte principale de la plateforme — pas de dépendance à Google ou Mapbox.
 *
 * Deux couches comme dans CarteMap/CentresMap : Esri en dessous, OSM au
 * dessus. Si l'une des deux ne répond pas, l'autre s'affiche quand même.
 */

const PULSE_STYLE = `
@keyframes sosPulse {
  0%   { transform: scale(0.6); opacity: 0.85; }
  70%  { transform: scale(2.4); opacity: 0; }
  100% { transform: scale(2.4); opacity: 0; }
}
.sos-marker__halo {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: rgba(220, 38, 38, 0.35);
  animation: sosPulse 2s cubic-bezier(0.2, 0.6, 0.35, 1) infinite;
}
.sos-marker__core {
  position: absolute;
  inset: 6px;
  border-radius: 50%;
  background: #dc2626;
  border: 2px solid #fff;
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.45);
}
.sos-marker__pin {
  position: relative;
  width: 34px;
  height: 34px;
}
.sos-popup {
  font: inherit;
  font-size: 12px;
  line-height: 1.45;
  color: #0f172a;
}
.sos-popup strong { display: block; margin-bottom: 2px; }
`

function SosMarkerIcon() {
  return L.divIcon({
    className: 'sos-marker',
    html: '<span class="sos-marker__pin"><span class="sos-marker__halo"></span><span class="sos-marker__core"></span></span>',
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18],
  })
}

/** Recentre la carte quand les coordonnées de l'alerte changent. */
function Recenter({ latitude, longitude }: { latitude: number; longitude: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView([latitude, longitude], map.getZoom(), { animate: false })
  }, [map, latitude, longitude])
  return null
}

/** Leaflet a besoin d'être recalculé après le montage (conteneur flex/grid). */
function Resize({ latitude, longitude }: { latitude: number; longitude: number }) {
  const map = useMap()
  useEffect(() => {
    const identifiant = window.setTimeout(() => {
      map.invalidateSize()
      map.setView([latitude, longitude], map.getZoom(), { animate: false })
    }, 120)
    return () => window.clearTimeout(identifiant)
  }, [map, latitude, longitude])
  return null
}

export default function SosMap({
  latitude,
  longitude,
  zoom = 16,
  className = 'h-48 w-full',
  libelle,
}: {
  latitude: number
  longitude: number
  zoom?: number
  className?: string
  libelle?: string | null
}) {
  const { t } = useTranslation()
  const icone = useMemo(() => SosMarkerIcon(), [])

  useEffect(() => {
    if (typeof document === 'undefined') return
    if (document.getElementById('sos-map-style')) return
    const style = document.createElement('style')
    style.id = 'sos-map-style'
    style.textContent = PULSE_STYLE
    document.head.appendChild(style)
  }, [])

  return (
    <div className={`overflow-hidden rounded-xl border border-slate-200 dark:border-white/10 ${className}`}>
      <MapContainer
        center={[latitude, longitude]}
        zoom={zoom}
        scrollWheelZoom={false}
        zoomControl
        attributionControl={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles &copy; Esri"
        />
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
        <Marker position={[latitude, longitude]} icon={icone} zIndexOffset={1000} title={t('sos.positionCarteTitre')}>
          <Popup>
            <div className="sos-popup">
              <strong>{libelle || t('sos.positionCarteTitre')}</strong>
              {latitude.toFixed(5)}, {longitude.toFixed(5)}
            </div>
          </Popup>
        </Marker>
        <Recenter latitude={latitude} longitude={longitude} />
        <Resize latitude={latitude} longitude={longitude} />
      </MapContainer>
    </div>
  )
}