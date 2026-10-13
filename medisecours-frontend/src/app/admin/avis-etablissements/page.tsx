'use client'

import { useDeferredValue, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import useSWR from 'swr'
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Flag,
  Search,
  Star,
} from 'lucide-react'
import api from '../../../api/axios'
import { fetcher } from '../../../lib/fetcher'
import EmptyState from '../../../components/ui/EmptyState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { useToast } from '../../../components/ui/Toast'

interface AvisEtabAdmin {
  id: number
  note: number
  commentaire: string | null
  statut: string
  signale: boolean
  raisonSignalement: string | null
  createdAt: string
  centre: { id: number; nom: string } | null
  auteurNom: string | null
}

interface StatsAvis {
  total: number
  signales: number
  publies: number
  enAttente: number
  noteMoyenne: number
  tauxSignalement: number
  distribution: { note: number; count: number }[]
}

function Metric({ label, value, tone = 'default' }: {
  label: string
  value: string | number
  tone?: 'default' | 'red' | 'amber' | 'green'
}) {
  const tones: Record<string, string> = {
    default: 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-200',
    red: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
    amber: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
    green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  }
  return (
    <div className={`rounded-xl px-4 py-3 ${tones[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </div>
  )
}

const STATUTS = ['PUBLIE', 'EN_ATTENTE', 'REJETE'] as const

/* ──────────────────────────────────────────────────────────────────────────
 * Modération centrale des avis d'établissements : volumes, distribution des
 * notes, file des signalés, publication / masquage. Les actions réutilisent
 * PATCH /api/carte/avis/{id} (les admins passent assertCanManage).
 * ────────────────────────────────────────────────────────────────────────── */
export default function AdminAvisEtablissementsPage() {
  const toast = useToast()
  const { t, i18n } = useTranslation()
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [statut, setStatut] = useState('')
  const [signales, setSignales] = useState(false)
  const [page, setPage] = useState(1)
  const [busyId, setBusyId] = useState<number | null>(null)

  const query = new URLSearchParams({ page: String(page), limit: '20' })
  if (deferredSearch.trim()) query.set('search', deferredSearch.trim())
  if (statut) query.set('statut', statut)
  if (signales) query.set('signale', '1')

  const {
    data: statsData,
  } = useSWR<{ [key: string]: number } & { distribution: { note: number; count: number }[] }>(
    '/api/admin/avis-etablissements/stats',
    fetcher,
    { revalidateOnFocus: true },
  )
  const {
    data: listData,
    error,
    isLoading,
    mutate: mutateList,
  } = useSWR<{ items: AvisEtabAdmin[]; total: number; pages: number }>(
    `/api/admin/avis-etablissements/search?${query.toString()}`,
    fetcher,
    { revalidateOnFocus: true },
  )

  const stats: StatsAvis = useMemo(() => ({
    total: Number(statsData?.total ?? 0),
    signales: Number(statsData?.signales ?? 0),
    publies: Number(statsData?.publies ?? 0),
    enAttente: Number(statsData?.enAttente ?? 0),
    noteMoyenne: Number(statsData?.noteMoyenne ?? 0),
    tauxSignalement: 0,
    distribution: Array.isArray(statsData?.distribution) ? statsData.distribution : [],
  }), [statsData])

  const items = listData?.items ?? []
  const maxDistribution = Math.max(1, ...stats.distribution.map((d) => d.count))

  const moderer = async (avis: AvisEtabAdmin, nouveauStatut: 'PUBLIE' | 'REJETE') => {
    setBusyId(avis.id)
    try {
      await api.patch(`/api/carte/avis/${avis.id}`, { statut: nouveauStatut })
      toast.success(t('admin.avisEtablissements.modereOk'))
      await mutateList()
    } catch {
      toast.error(t('admin.avisEtablissements.modereErreur'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Metric label={t('admin.avisEtablissements.statTotal')} value={stats.total} />
        <Metric label={t('admin.avisEtablissements.statSignales')} value={stats.signales} tone={stats.signales > 0 ? 'red' : 'default'} />
        <Metric label={t('admin.avisEtablissements.statPublies')} value={stats.publies} tone="green" />
        <Metric label={t('admin.avisEtablissements.statEnAttente')} value={stats.enAttente} tone={stats.enAttente > 0 ? 'amber' : 'default'} />
        <Metric label={t('admin.avisEtablissements.statNote')} value={stats.noteMoyenne.toFixed(1)} />
        <Metric label={t('admin.avisEtablissements.statTaux')} value={`${Number(statsData?.tauxSignalement ?? 0)} %`} />
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {t('admin.avisEtablissements.distributionTitre')}
        </p>
        <div className="mt-3 space-y-1.5">
          {[5, 4, 3, 2, 1].map((note) => {
            const count = stats.distribution.find((d) => d.note === note)?.count ?? 0
            return (
              <div key={note} className="flex items-center gap-2 text-xs">
                <span className="w-3 font-bold text-slate-600 dark:text-slate-300">{note}</span>
                <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                  <div
                    className="h-full rounded-full bg-amber-400"
                    style={{ width: `${Math.round((count / maxDistribution) * 100)}%` }}
                  />
                </div>
                <span className="w-8 text-right font-bold text-slate-600 dark:text-slate-300">{count}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <label className="relative block flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1) }}
            placeholder={t('admin.avisEtablissements.recherchePlaceholder')}
            className="min-h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm dark:border-white/10 dark:bg-slate-900"
          />
        </label>
        <select
          value={statut}
          onChange={(event) => { setStatut(event.target.value); setPage(1) }}
          className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-slate-900"
          aria-label={t('admin.avisEtablissements.filtreStatut')}
        >
          <option value="">{t('admin.avisEtablissements.tousStatuts')}</option>
          {STATUTS.map((s) => (
            <option key={s} value={s}>{t(`admin.avisEtablissements.statut${s}`)}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => { setSignales((v) => !v); setPage(1) }}
          aria-pressed={signales}
          className={`inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm font-bold ${signales ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300' : 'border-slate-200 text-slate-600 dark:border-white/10 dark:text-slate-300'}`}
        >
          <Flag className="h-4 w-4" />
          {t('admin.avisEtablissements.signalesUniquement')}
        </button>
      </div>

      {isLoading ? (
        <div className="py-10"><LoadingSpinner label={t('admin.avisEtablissements.chargement')} /></div>
      ) : error ? (
        <EmptyState
          title={t('admin.avisEtablissements.erreurTitre')}
          description={t('admin.avisEtablissements.erreurDesc')}
          action={(
            <button
              type="button"
              onClick={() => void mutateList()}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-bold text-white hover:bg-primary-700"
            >
              {t('admin.avisEtablissements.reessayer')}
            </button>
          )}
        />
      ) : items.length === 0 ? (
        <div className="py-10"><EmptyState title={t('admin.avisEtablissements.aucun')} description={t('admin.avisEtablissements.aucunDesc')} /></div>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((avis) => (
            <li key={avis.id} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-bold">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    {avis.note}/5
                    <span className="font-medium text-slate-500 dark:text-slate-400">
                      {avis.centre?.nom ?? '—'}
                    </span>
                  </p>
                  <p className="mt-0.5 truncate text-xs text-slate-400">
                    {avis.auteurNom ?? t('admin.avisEtablissements.anonyme')} · {new Date(avis.createdAt).toLocaleString(i18n.language)}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${avis.statut === 'PUBLIE' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : avis.statut === 'EN_ATTENTE' ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300' : 'bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-300'}`}>
                  {t(`admin.avisEtablissements.statut${avis.statut}`)}
                </span>
              </div>
              {avis.commentaire && (
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{avis.commentaire}</p>
              )}
              {avis.signale && (
                <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {t('admin.avisEtablissements.signalePar')}
                  {avis.raisonSignalement ? ` — ${avis.raisonSignalement}` : ''}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {avis.statut !== 'PUBLIE' && (
                  <button
                    type="button"
                    onClick={() => void moderer(avis, 'PUBLIE')}
                    disabled={busyId === avis.id}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    {t('admin.avisEtablissements.publier')}
                  </button>
                )}
                {avis.statut !== 'REJETE' && (
                  <button
                    type="button"
                    onClick={() => void moderer(avis, 'REJETE')}
                    disabled={busyId === avis.id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                  >
                    <EyeOff className="h-3.5 w-3.5" />
                    {t('admin.avisEtablissements.masquer')}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {(listData?.pages ?? 1) > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold disabled:opacity-40 dark:border-white/10"
          >
            <ChevronLeft className="h-4 w-4" />
            {t('admin.avisEtablissements.pagePrecedente')}
          </button>
          <span className="text-xs text-slate-500">{page} / {listData?.pages ?? 1}</span>
          <button
            type="button"
            disabled={page >= (listData?.pages ?? 1)}
            onClick={() => setPage((p) => p + 1)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold disabled:opacity-40 dark:border-white/10"
          >
            {t('admin.avisEtablissements.pageSuivante')}
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}
