'use client'

import { useTranslation } from 'react-i18next'
import { Ambulance, Clock, HeartPulse, Timer, TrendingUp } from 'lucide-react'

import { secondesLisible, type SosStatsMoi } from '../../lib/sosWorkflow'

/**
 * Compteurs et délais moyens de l'intervenant connecté.
 * Le dashboard doit répondre à une question : « et maintenant, je fais quoi ? »
 * — combien j'ai en cours, et combien de temps je mets à arriver.
 */
export function SosStatsTiles({ stats }: { stats: SosStatsMoi | null }) {
  const { t } = useTranslation()
  if (!stats) return null

  const cases = [
    {
      label: t('sos.statsEnCours'),
      valeur: String(stats.enCours),
      icone: Ambulance,
      teinte: stats.enCours > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400',
    },
    {
      label: t('sos.statsTraitees'),
      valeur: String(stats.traitees),
      icone: HeartPulse,
      teinte: 'text-mint-600 dark:text-mint-400',
    },
    {
      label: t('sos.statsDelaiReaction'),
      valeur: secondesLisible(stats.delaiMoyenPriseEnChargeSec) ?? '—',
      icone: Timer,
      teinte: 'text-amber-600 dark:text-amber-400',
    },
    {
      label: t('sos.statsDelaiArrivee'),
      valeur: secondesLisible(stats.delaiMoyenArriveeSec) ?? '—',
      icone: Clock,
      teinte: 'text-slate-600 dark:text-slate-300',
    },
  ]

  return (
    <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cases.map(({ label, valeur, icone: Icone, teinte }) => (
        <div
          key={label}
          className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-white/5">
            <Icone className={`h-4 w-4 ${teinte}`} />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              {label}
            </p>
            <p className="font-display text-lg font-black text-slate-900 dark:text-white">{valeur}</p>
          </div>
        </div>
      ))}
      {stats.total > 0 && (
        <p className="col-span-full flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
          <TrendingUp className="h-3.5 w-3.5" />
          {t('sos.statsTotalPerso', { count: stats.total })}
        </p>
      )}
    </div>
  )
}