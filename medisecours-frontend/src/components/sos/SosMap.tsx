'use client'

import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'

/**
 * Carte de la position d'une alerte SOS.
 *
 * Leaflet + fonds raster : aucune clé d'API à distribuer et aucun iframe
 * (openstreetmap.org interdit l'iframe, d'où le « contenu bloqué » constaté
 * auparavant). Même pile que la carte principale de la plateforme.
 *
 * Deux fonds superposés, comme dans CarteMap/CentresMap : Esri en dessous,
 * OSM au-dessus. Si l'un des deux ne répond pas, l'autre s'affiche quand même.
 */

const STYLE_ID = 'sos-map-style'

const STYLE_CSS = `
.sos-map { position: relative; background: #eef2f6; }
.sos-map .leaflet-container { font: inherit; background: #eef2f6; }
.sos-map .leaflet-control-attribution {
  background: rgba(255, 255, 255, 0.82);
  font-size: 9px;
  color: #64748b;
  padding: 1px 6px;
}
.sos-map .leaflet-bar a {
  border-radius: 8px;
  color: #0f172a;
}
.sos-map .leaflet-bar {
  border: 0;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.12), 0 8px 24px rgba(15, 23, 42, 0.10);
}

@keyframes sosHalo {
  0%   { transform: scale(0.55); opacity: 0.55; }
  70%  { transform: scale(2.6);  opacity: 0; }
  100% { transform: scale(2.6);  opacity: 0; }
}

.sos-pin {
  display: block;
  position: relative;
  width: 28px;
  height: 28px;
}
.sos-pin__halo {
  display: block;
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: rgba(220, 38, 38, 0.45);
  animation: sosHalo 2.2s cubic-bezier(0.2, 0.65, 0.35, 1) infinite;
}
.sos-pin__ring {
  display: block;
  position: absolute;
  inset: 5px;
  border-radius: 50%;
  background: #dc2626;
  border: 2px solid #fff;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.35), 0 0 0 1px rgba(220, 38, 38, 0.35);
}

.sos-popup { font-size: 12px; line-height: 1.45; color: #0f172a; margin: 2px; }
.sos-popup strong { display: block; font-size: 12px; }
.sos-popup span { color: #64748b; font-variant-numeric: tabular-nums; }
`

function creerIcone() {
  return L.divIcon({
    className: 'sos-marker',
    html: '<span class="sos-pin"><span class="sos-pin__halo"></span><span class="sos-pin__ring"></span></span>',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
  })
}

/** Recentre sur l'alerte quand ses coordonnées changent. */
function Recenter({ latitude, longitude }: { latitude: number; longitude: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView([latitude, longitude], map.getZoom(), { animate: false })
  }, [map, latitude, longitude])
  return null
}

/**
 * Leaflet se calculera à 0 pixel dans un conteneur flex/grid tant que la
 * mise en page n'est pas stabilisée : on force un recalcul au montage.
 */
function Resize({ latitude, longitude }: { latitude: number; longitude: number }) {
  const map = useMap()
  useEffect(() => {
    const minuteur = window.setTimeout(() => {
      map.invalidateSize({ animate: false })
      map.setView([latitude, longitude], map.getZoom(), { animate: false })
    }, 150)
    return () => window.clearTimeout(minuteur)
  }, [map, latitude, longitude])
  return null
}

export default function SosMap({
  latitude,
  longitude,
  zoom = 16,
  libelle,
}: {
  latitude: number
  longitude: number
  zoom?: number
  libelle?: string | null
}) {
  const { t } = useTranslation()
  const icone = useMemo(() => creerIcone(), [])

  useEffect(() => {
    if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return
    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = STYLE_CSS
    document.head.appendChild(style)
  }, [])

  return (
    <div className="sos-map h-44 w-full overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
      <MapContainer
        center={[latitude, longitude]}
        zoom={zoom}
        scrollWheelZoom={false}
        dragging
        touchZoom
        zoomControl={false}
        attributionControl
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
          attribution="Esri"
        />
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="OpenStreetMap" />
        <Marker position={[latitude, longitude]} icon={icone} zIndexOffset={1000} title={t('sos.positionCarteTitre')}>
          <Popup closeButton={false} offset={[0, -6]}>
            <div className="sos-popup">
              <strong>{libelle || t('sos.positionCarteTitre')}</strong>
              <span>
                {latitude.toFixed(5)}, {longitude.toFixed(5)}
              </span>
            </div>
          </Popup>
        </Marker>
        <Recenter latitude={latitude} longitude={longitude} />
        <Resize latitude={latitude} longitude={longitude} />
      </MapContainer>
    </div>
  )
}