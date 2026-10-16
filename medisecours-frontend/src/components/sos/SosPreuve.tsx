'use client'

import { useTranslation } from 'react-i18next'
import { Eye, Video } from 'lucide-react'

/**
 * Visionneuse de preuve SOS.
 *
 * Le type est lu sur `preuveType` renvoyé par l'API, avec repli sur
 * l'en-tête de la data-URL pour les anciennes alertes. Sans cela une vidéo
 * était passée dans une balise <img> : icône cassée, et donc une
 * « vérification » impossible avant de lancer la sirène.
 */
export function estVideoPreuve(preuve: string | null | undefined, type?: string | null): boolean {
  if (type) return type.toUpperCase() === 'VIDEO'
  return Boolean(preuve?.startsWith('data:video/'))
}

export function SosPreuve({ preuve, type }: { preuve: string | null; type?: string | null }) {
  const { t } = useTranslation()
  if (!preuve) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-400 dark:border-white/10 dark:text-slate-500">
        {t('sos.preuveAbsente')}
      </span>
    )
  }

  const video = estVideoPreuve(preuve, type)

  return (
    <details className="group relative">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5">
        {video ? <Video className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        {video ? t('sos.preuveVideo') : t('sos.preuve')}
      </summary>
      <div className="mt-2 w-full max-w-sm overflow-hidden rounded-xl border border-slate-200 bg-slate-950 shadow-xl dark:border-white/10">
        {video ? (
          <video src={preuve} controls playsInline preload="metadata" className="max-h-[60vh] w-full bg-black" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- preuve base64 renvoyée par l'API
          <img src={preuve} alt={t('sos.preuveAlt')} className="max-h-[60vh] w-full object-contain" />
        )}
      </div>
    </details>
  )
}