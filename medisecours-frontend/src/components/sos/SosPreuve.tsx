'use client'

import { useTranslation } from 'react-i18next'
import { Eye, ImageOff, Video } from 'lucide-react'

/**
 * Normalise une data-URL de média pour la lecture.
 *
 * Les vidéos capturées portent leurs codecs dans l'en-tête :
 * « data:video/webm;codecs=vp9,opus;base64,… ». Ce suffixe rend la source
 * illisible pour le navigateur (lecteur bloqué à 0:00) : on le retire en
 * conservant le type MIME et la charge utile.
 */
export function normaliserDataUrl(source: string): string {
  if (!source.startsWith('data:')) return source
  const virgule = source.indexOf(',')
  if (virgule === -1) return source
  const mime = source.slice(5, source.indexOf(';') === -1 ? virgule : source.indexOf(';'))
  return `data:${mime};base64,${source.slice(virgule + 1)}`
}

/** Le type est lu sur `preuveType`, avec repli sur l'en-tête de la data-URL. */
export function estVideoPreuve(preuve: string | null | undefined, type?: string | null): boolean {
  if (type) return type.toUpperCase() === 'VIDEO'
  return Boolean(preuve?.startsWith('data:video/'))
}

/**
 * Preuve envoyée par le demandeur : photo ou vidéo de confirmation.
 *
 * Le type vient de l'API — sans lui, une vidéo était passée dans une balise
 * <img> et devenait une icône cassée, donc une vérification impossible avant
 * de lancer la sirène.
 */
export function SosPreuve({ preuve, type }: { preuve: string | null; type?: string | null }) {
  const { t } = useTranslation()

  if (!preuve) {
    return (
      <span className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-dashed border-slate-200 px-3 py-2 text-sm font-semibold text-slate-400 dark:border-white/10 dark:text-slate-500">
        <ImageOff className="h-4 w-4" />
        {t('sos.preuveAbsente')}
      </span>
    )
  }

  const video = estVideoPreuve(preuve, type)
  const source = normaliserDataUrl(preuve)

  return (
    <details className="group relative">
      <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-white/5">
        {video ? <Video className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        {video ? t('sos.preuveVideo') : t('sos.preuve')}
      </summary>
      <div className="mt-2 w-full max-w-sm overflow-hidden rounded-xl border border-slate-200 bg-slate-950 shadow-lg dark:border-white/10">
        {video ? (
          <video src={source} controls playsInline preload="metadata" className="max-h-[60vh] w-full bg-black" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- preuve base64 renvoyée par l'API
          <img src={source} alt={t('sos.preuveAlt')} className="max-h-[60vh] w-full object-contain" />
        )}
      </div>
    </details>
  )
}