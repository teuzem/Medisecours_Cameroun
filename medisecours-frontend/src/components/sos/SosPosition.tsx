'use client'

import { useTranslation } from 'react-i18next'
import { MapPin, Navigation, Share2 } from 'lucide-react'

/**
 * Position exacte du patient et itinéraire.
 *
 * - Carte : OpenStreetMap embarqué (aucune clé d'API requise, contrairement
 *   à Google Static Map) avec un marqueur sur les coordonnées exactes.
 * - Itinéraire : lien Google Maps vers le point exact (le même service que
 *   le bouton « Itinéraire » du reste de l'application).
 * - Partage : WhatsApp / SMS avec un message prêt à envoyer, pour que le
 *   secouriste rejoigne le patient sans ressaisir les coordonnées.
 */
export function SosPosition({
  latitude,
  longitude,
  nom,
  telephone,
}: {
  latitude: number | null
  longitude: number | null
  nom?: string | null
  telephone?: string | null
}) {
  const { t } = useTranslation()

  if (latitude == null || longitude == null) {
    return (
      <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">{t('sos.positionIndisponible')}</p>
    )
  }

  // Marqueur centré, zoom ajusté : un bbox trop large perdrait la précision.
  const delta = 0.004
  const bbox = [longitude - delta, latitude - delta, longitude + delta, latitude + delta].map((v) => v.toFixed(5)).join('%2C')
  const embed = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude}%2C${longitude}`
  const itineraire = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`
  const message = `${t('sos.partageMessage', { nom: nom || t('sos.anonyme'), lat: latitude.toFixed(5), lng: longitude.toFixed(5) })} ${itineraire}`
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(message)}`
  const sms = `sms:${telephone ?? ''}?body=${encodeURIComponent(message)}`

  return (
    <div className="mt-2 space-y-2">
      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
        <iframe
          src={embed}
          title={t('sos.positionCarteTitre')}
          className="h-44 w-full"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      </div>

      <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
        <MapPin className="h-3.5 w-3.5 text-red-500" />
        {latitude.toFixed(5)}, {longitude.toFixed(5)}
      </p>

      <div className="flex flex-wrap gap-2">
        <a
          href={itineraire}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-primary-700"
        >
          <Navigation className="h-3.5 w-3.5" />
          {t('sos.itineraire')}
        </a>
        <a
          href={whatsapp}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-bold text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-500/40 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
        >
          <Share2 className="h-3.5 w-3.5" />
          {t('sos.partageWhatsapp')}
        </a>
        {telephone && (
          <a
            href={sms}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
          >
            {t('sos.partageSms')}
          </a>
        )}
      </div>
    </div>
  )
}