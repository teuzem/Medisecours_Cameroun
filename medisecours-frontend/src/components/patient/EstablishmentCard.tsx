'use client'

import { useTranslation } from 'react-i18next'
import { Clock, Heart, MapPin, Navigation, Phone, Star, Globe } from 'lucide-react'
import Link from 'next/link'
import type { CarteCentre } from '../../lib/carte'
import { FACILITY_COLORS, formatDistanceKm, getEtablissementPhoto } from '../../lib/carte'

type EstablishmentCardProps = {
  centre: CarteCentre
  isFavorite?: boolean
  onToggleFavorite?: (id: number) => void
  showDistance?: boolean
}

export default function EstablishmentCard({
  centre,
  isFavorite = false,
  onToggleFavorite,
  showDistance = false,
}: EstablishmentCardProps) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'en' ? 'en-GB' : 'fr-FR'
  const photo = getEtablissementPhoto(centre)
  const accent = FACILITY_COLORS[centre.type] ?? '#1E3A5F'
  const note = centre.noteMoyenne != null ? Math.round(centre.noteMoyenne * 10) / 10 : null

  return (
    <article className="wdg wdg--hover group relative flex flex-col overflow-hidden">
      <div className="relative h-32 w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt={centre.nom} className="h-full w-full object-cover" />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{ backgroundColor: `${accent}18` }}
          >
            <MapPin className="h-8 w-8" style={{ color: accent }} aria-hidden="true" />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-slate-900/60 to-transparent" aria-hidden="true" />
        <span
          className="absolute left-2 top-2 rounded-md px-2 py-0.5 text-[10px] font-bold text-white"
          style={{ backgroundColor: accent }}
        >
          {t(`visitor.carte.type.${centre.type}`)}
        </span>
        {onToggleFavorite && (
          <button
            type="button"
            onClick={() => onToggleFavorite(centre.id)}
            aria-label={isFavorite ? t('patient.etablissements.favoriteRemove') : t('patient.etablissements.favoriteAdd')}
            aria-pressed={isFavorite}
            className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg bg-white/90 text-slate-600 transition hover:bg-white dark:bg-slate-900/90 dark:text-slate-300 dark:hover:bg-slate-900"
          >
            <Heart className={`h-4 w-4 ${isFavorite ? 'fill-red-500 text-red-500' : ''}`} />
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold text-slate-900 dark:text-white" title={centre.nom}>
            {centre.nom}
          </h3>
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-500 dark:text-slate-400">
            <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{[centre.ville, centre.region].filter(Boolean).join(', ') || centre.adresse}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
          {note != null && (
            <span className="inline-flex items-center gap-1 font-bold text-slate-700 dark:text-slate-200">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
              <span className="tabular-nums">{note.toLocaleString(locale)}</span>
              {centre.totalAvis != null && centre.totalAvis > 0 && (
                <span className="font-normal text-slate-400">({centre.totalAvis})</span>
              )}
            </span>
          )}
          {showDistance && centre.distance != null && (
            <span className="inline-flex items-center gap-1">
              <Navigation className="h-3 w-3" aria-hidden="true" />
              <span className="tabular-nums">{formatDistanceKm(centre.distance)}</span>
            </span>
          )}
          {centre.urgences24h && (
            <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-500/10 dark:text-red-300">
              <Clock className="h-3 w-3" aria-hidden="true" />
              {t('patient.etablissements.urgencies24h')}
            </span>
          )}
          {centre.teleconsultation && (
            <span className="rounded-md bg-mint-50 px-1.5 py-0.5 text-[10px] font-bold text-primary-700 dark:bg-primary-500/10 dark:text-mint-200">
              {t('patient.etablissements.teleconsultation')}
            </span>
          )}
        </div>

        <div className="mt-auto flex items-center gap-1.5 pt-1">
          <Link
            href={`/patient/etablissements/${centre.id}`}
            className="inline-flex min-h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary-900 px-2 text-xs font-bold text-white transition hover:bg-primary-800 dark:bg-white dark:text-primary-900 dark:hover:bg-slate-100"
          >
            {t('patient.etablissements.viewFiche')}
          </Link>
          {centre.telephone && (
            <a
              href={`tel:${centre.telephone}`}
              aria-label={t('patient.etablissements.call')}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
            >
              <Phone className="h-3.5 w-3.5" />
            </a>
          )}
          {centre.siteWeb && (
            <a
              href={centre.siteWeb}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t('patient.etablissements.website')}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
            >
              <Globe className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>
    </article>
  )
}
