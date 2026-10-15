'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { History, Loader2, X } from 'lucide-react'

import api from '../../api/axios'
import { messageErreur, type SosTraceRow } from '../../lib/sosWorkflow'

/**
 * Journal d'audit d'une alerte : chaque transition de statut y est inscrite
 * (création, vérification, relais, prise en charge, départ, arrivée,
 * transport, clôture). C'est la source de vérité en cas de litige.
 */
export function SosJournal({ sosId, onClose }: { sosId: number; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'en' ? 'en-US' : 'fr-FR'
  const [traces, setTraces] = useState<SosTraceRow[] | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    let annule = false
    api
      .get(`/api/sos/${sosId}/traces`)
      .then(({ data }) => {
        if (!annule) setTraces(Array.isArray(data?.traces) ? data.traces : [])
      })
      .catch((err) => {
        if (!annule) setErreur(messageErreur(err, t('sos.journalErreur')))
      })
    return () => {
      annule = true
    }
  }, [sosId, t])

  return (
    <div
      className="fixed inset-0 z-[2600] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t('sos.journal')}
    >
      <div
        className="max-h-[80vh] w-full max-w-lg overflow-hidden rounded-t-2xl bg-white shadow-2xl dark:bg-slate-900 sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 dark:border-white/10">
          <History className="h-4 w-4 text-primary-600 dark:text-mint-400" />
          <h3 className="font-display flex-1 text-sm font-bold text-slate-900 dark:text-white">
            {t('sos.journal')}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('sos.fermer')}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="max-h-[60vh] overflow-y-auto px-4 py-3">
          {erreur ? (
            <p role="alert" className="text-sm font-semibold text-red-600 dark:text-red-400">
              {erreur}
            </p>
          ) : traces === null ? (
            <p className="flex items-center gap-2 py-6 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('sos.statsChargement')}
            </p>
          ) : traces.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">{t('sos.journalVide')}</p>
          ) : (
            <ol className="space-y-3">
              {traces.map((trace) => (
                <li key={trace.id} className="flex gap-3">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary-400 dark:bg-mint-400" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {t(`sos.trace.${trace.action}`, { defaultValue: trace.action })}
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                      {[trace.auteur?.nom, trace.auteur?.prenom].filter(Boolean).join(' ') || t('sos.systeme')}
                      {' · '}
                      {new Date(trace.createdAt).toLocaleString(locale)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  )
}