'use client'

import dynamic from 'next/dynamic'
import { useTranslation } from 'react-i18next'
import { MapPin, Navigation, Send, Share2, TriangleAlert } from 'lucide-react'

/**
 * Leaflet manipule `window` : chargé côté client uniquement, comme la carte
 * principale de la plateforme.
 */
const SosMap = dynamic(() => import('./SosMap'), {
  ssr: false,
  loading: () => <div className="h-44 w-full animate-pulse rounded-xl bg-slate-100 dark:bg-white/5" />,
})

export function lienItineraire(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`
}

/**
 * Position exacte du patient et actions de terrain.
 *
 * - carte réelle (Leaflet) avec marqueur pulsé sur les coordonnées du
 *   demandeur, et non un lien vers un site tiers ;
 * - itinéraire Google Maps vers le point exact ;
 * - partage WhatsApp / SMS avec un message prêt à envoyer, pour que le
 *   secouriste rejoigne le patient sans ressaisir les coordonnées.
 *
 * Une seule barre d'actions : les doublons « Itinéraire » (lien historique
 * dans le panneau + composant) ont été supprimés.
 */
export function SosPosition({
  latitude,
  longitude,
  nom,
  telephone,
  etablissement,
}: {
  latitude: number | null
  longitude: number | null
  nom?: string | null
  telephone?: string | null
  etablissement?: string | null
}) {
  const { t } = useTranslation()

  if (latitude == null || longitude == null) {
    return (
      <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
        <TriangleAlert className="h-3.5 w-3.5" />
        {t('sos.positionIndisponible')}
      </p>
    )
  }

  const itineraire = lienItineraire(latitude, longitude)
  const message = `${t('sos.partageMessage', { nom: nom || t('sos.anonyme'), lat: latitude.toFixed(5), lng: longitude.toFixed(5) })} ${itineraire}`
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(message)}`
  const sms = `sms:${telephone ?? ''}?body=${encodeURIComponent(message)}`

  return (
    <div className="space-y-2">
      <SosMap latitude={latitude} longitude={longitude} libelle={etablissement || nom || undefined} />

      {/* Une seule ligne : coordonnées à gauche, actions de terrain à droite. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold tabular-nums text-slate-500 dark:text-slate-400">
          <MapPin className="h-3.5 w-3.5 text-red-500" />
          {latitude.toFixed(5)}, {longitude.toFixed(5)}
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <a
            href={itineraire}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
          >
            <Navigation className="h-3.5 w-3.5" />
            {t('sos.itineraire')}
          </a>
          <a
            href={whatsapp}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 px-2.5 py-1.5 text-xs font-bold text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-500/40 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
          >
            <Share2 className="h-3.5 w-3.5" />
            {t('sos.partageWhatsapp')}
          </a>
          {telephone && (
            <>
              <a
                href={sms}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
              >
                <Send className="h-3.5 w-3.5" />
                {t('sos.partageSms')}
              </a>
              <a
                href={`tel:${telephone}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
              >
                {t('sos.appeler')}
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  )
}