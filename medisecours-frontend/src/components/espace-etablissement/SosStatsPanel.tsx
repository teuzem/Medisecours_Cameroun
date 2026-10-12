'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Activity,
  Camera,
  Clock,
  Loader2,
  ShieldAlert,
  Siren,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import api from '../../api/axios'
import { useNotification } from '../../contexts/NotificationContext'

interface SosStats {
  total: number
  ouvertes: number
  parStatut: Record<string, number>
  sirenesActives: number
  tauxPreuvePhoto: number | null
  tauxFrauduleuses: number | null
  delaiMoyenVerificationSec: number | null
  delaiMoyenPriseEnChargeSec: number | null
  delaiMoyenResolutionSec: number | null
}

const STATUTS = ['EN_COURS', 'VERIFIEE', 'EN_PRISE_EN_CHARGE', 'TRAITEE', 'FRAUDULEUSE', 'CLOTUREE'] as const

function formatDelai(secondes: number | null, uniteS: string, uniteMin: string): string {
  if (secondes == null) return '—'
  if (secondes < 60) return `${secondes} ${uniteS}`
  return `${Math.round(secondes / 60)} ${uniteMin}`
}

function formatTaux(taux: number | null): string {
  if (taux == null) return '—'
  return `${Math.round(taux * 100)} %`
}

/* ──────────────────────────────────────────────────────────────────────────
 * Panneau « Pilotage SOS » — analytique temps réel de l'établissement.
 * Volumes par statut, sirènes actives, qualité des signalements et délais
 * moyens de prise en charge. Rechargé à chaque événement WebSocket d'équipe.
 * ────────────────────────────────────────────────────────────────────────── */
export default function SosStatsPanel({ centreId }: { centreId: number }) {
  const { t } = useTranslation()
  const { subscribeToSos } = useNotification()
  const [stats, setStats] = useState<SosStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [erreur, setErreur] = useState(false)

  const charger = useCallback(async () => {
    try {
      const { data } = await api.get('/api/sos/stats', { params: { centre: centreId } })
      setStats(data)
      setErreur(false)
    } catch {
      setErreur(true)
    } finally {
      setLoading(false)
    }
  }, [centreId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStats(null)
    setLoading(true)
    void charger()
  }, [charger])

  // Rafraîchit à chaque événement WebSocket d'équipe (création / vérification…).
  useEffect(() => {
    return subscribeToSos(() => {
      void charger()
    })
  }, [subscribeToSos, charger])

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500 dark:border-white/10 dark:bg-slate-900 dark:text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('sos.statsChargement')}
      </div>
    )
  }

  if (erreur || !stats) {
    return (
      <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
        {t('sos.statsErreur')}
      </p>
    )
  }

  const tuiles = [
    { icone: Activity, label: t('sos.statsTotal'), valeur: String(stats.total), accent: false },
    { icone: Siren, label: t('sos.statsOuvertes'), valeur: String(stats.ouvertes), accent: stats.ouvertes > 0 },
    { icone: Siren, label: t('sos.statsSirenes'), valeur: String(stats.sirenesActives), accent: stats.sirenesActives > 0 },
    { icone: Camera, label: t('sos.statsPreuve'), valeur: formatTaux(stats.tauxPreuvePhoto), accent: false },
    { icone: ShieldAlert, label: t('sos.statsFraude'), valeur: formatTaux(stats.tauxFrauduleuses), accent: (stats.tauxFrauduleuses ?? 0) > 0 },
  ]

  const delais = [
    { label: t('sos.statsDelaiVerification'), valeur: formatDelai(stats.delaiMoyenVerificationSec, t('sos.statsUniteSeconde'), t('sos.statsUniteMinute')) },
    { label: t('sos.statsDelaiPriseEnCharge'), valeur: formatDelai(stats.delaiMoyenPriseEnChargeSec, t('sos.statsUniteSeconde'), t('sos.statsUniteMinute')) },
    { label: t('sos.statsDelaiResolution'), valeur: formatDelai(stats.delaiMoyenResolutionSec, t('sos.statsUniteSeconde'), t('sos.statsUniteMinute')) },
  ]

  return (
    <section aria-label={t('sos.statsTitre')} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">{t('sos.statsTitre')}</h2>
        <p className="text-[11px] text-slate-400 dark:text-slate-500">{t('sos.statsDesc')}</p>
      </div>

      {stats.total === 0 ? (
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{t('sos.statsAucune')}</p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {tuiles.map((tuile) => {
              const Icone = tuile.icone
              return (
                <div
                  key={tuile.label}
                  className={`rounded-lg border p-3 ${tuile.accent ? 'border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10' : 'border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-slate-800'}`}
                >
                  <p className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide ${tuile.accent ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}>
                    <Icone className="h-3.5 w-3.5" />
                    {tuile.label}
                  </p>
                  <p className="mt-1 text-xl font-black text-slate-900 dark:text-white">{tuile.valeur}</p>
                </div>
              )
            })}
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-slate-800">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <Clock className="h-3.5 w-3.5" />
                {t('sos.statsDelaisTitre')}
              </p>
              <ul className="mt-2 space-y-1.5">
                {delais.map((delai) => (
                  <li key={delai.label} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-slate-500 dark:text-slate-400">{delai.label}</span>
                    <strong className="text-slate-800 dark:text-slate-100">{delai.valeur}</strong>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-slate-800">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <Activity className="h-3.5 w-3.5" />
                {t('sos.statsParStatut')}
              </p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {STATUTS.map((statut) => (
                  <li
                    key={statut}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 ring-1 ring-inset ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-white/10"
                  >
                    {t(`sos.statut.${statut}`)}
                    <span className="text-slate-900 dark:text-white">{stats.parStatut[statut] ?? 0}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
