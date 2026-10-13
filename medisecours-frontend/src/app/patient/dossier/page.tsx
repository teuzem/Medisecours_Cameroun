'use client'

import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Link from 'next/link'
import {
  BadgeCheck,
  Building2,
  ChevronLeft,
  FileText,
  Loader2,
  ShieldCheck,
} from 'lucide-react'
import useSWR from 'swr'
import { useAuth } from '../../../hooks/useAuth'
import { fetcher } from '../../../lib/fetcher'
import GlassCard from '../../../components/ui/GlassCard'
import SectionHeader from '../../../components/ui/SectionHeader'

type DossierEvenement = {
  id: number
  type: string
  titre: string
  details?: Record<string, unknown> | null
  auteurNom?: string | null
  signe: boolean
  createdAt: string
}

type Dossier = {
  id: number
  numero: string
  statut: string
  createdAt: string
  closedAt?: string | null
  centre?: { id: number; nom: string; ville?: string; type?: string } | null
  evenementsTotal: number
  dernierEvenementAt?: string | null
  evenements?: DossierEvenement[]
}

const EVENT_STYLE: Record<string, string> = {
  ACCUEIL: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-500/25 dark:bg-sky-500/10 dark:text-sky-200',
  SIGNE_VITAUX: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-200',
  CONSULTATION: 'border-mint-200 bg-mint-50 text-primary-700 dark:border-primary-500/25 dark:bg-primary-500/10 dark:text-mint-200',
  SOIN: 'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-500/25 dark:bg-violet-500/10 dark:text-violet-200',
  ORDONNANCE: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200',
  PHARMACIE: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-200',
  NOTE: 'border-slate-200 bg-slate-100 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300',
}

function formatDate(value: string | null | undefined, locale: string) {
  if (!value) return '–'
  try {
    return new Date(value).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return value
  }
}

export default function PatientDossierPage() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'en' ? 'en-GB' : 'fr-FR'
  const { isAuthenticated } = useAuth()
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const { data, isLoading, error } = useSWR(
    isAuthenticated ? '/api/patient/dossiers' : null,
    fetcher,
  )
  const dossiers = useMemo<Dossier[]>(() => {
    const raw = (data as { dossiers?: unknown })?.dossiers ?? data
    return Array.isArray(raw) ? (raw as Dossier[]) : []
  }, [data])

  const { data: detailData, isLoading: loadingDetail } = useSWR(
    isAuthenticated && selectedId ? `/api/patient/dossiers/${selectedId}` : null,
    fetcher,
  )
  const detail = useMemo<Dossier | null>(
    () => ((detailData as { dossier?: Dossier })?.dossier ?? null),
    [detailData],
  )

  const openDetail = useCallback((id: number) => setSelectedId(id), [])
  const closeDetail = useCallback(() => setSelectedId(null), [])

  return (
    <div className="mx-auto w-full max-w-5xl min-w-0 px-3 py-6 sm:px-6">
      <SectionHeader
        title={t('patient.dossier.title')}
        description={t('patient.dossier.subtitle')}
        action={
          selectedId ? (
            <button
              type="button"
              onClick={closeDetail}
              className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
              {t('patient.dossier.backToList')}
            </button>
          ) : (
            <Link
              href="/patient/consultations?new=1"
              className="inline-flex min-h-8 items-center rounded-lg bg-primary-900 px-3 text-xs font-bold text-white transition hover:bg-primary-800 dark:bg-white dark:text-primary-900"
            >
              {t('patient.dossier.newConsultation')}
            </Link>
          )
        }
      />

      {isLoading ? (
        <div className="mt-8 flex items-center justify-center gap-2 py-10 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        </div>
      ) : error ? (
        <GlassCard className="mt-4 p-8 text-center">
          <p className="text-xs font-bold text-red-600 dark:text-red-300">{t('common.error')}</p>
        </GlassCard>
      ) : selectedId ? (
        /* ── Détail : timeline des événements horodatés ── */
        <div className="mt-4">
          {loadingDetail || !detail ? (
            <div className="flex items-center justify-center gap-2 py-10 text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            </div>
          ) : (
            <>
              <GlassCard className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.04em] text-slate-400">
                      <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                      {detail.numero}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-slate-800 dark:text-slate-100">
                      <Building2 className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                      {detail.centre?.nom ?? '–'}
                      {detail.centre?.ville ? <span className="font-normal text-slate-400"> · {detail.centre.ville}</span> : null}
                    </p>
                  </div>
                  <span
                    className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${
                      detail.statut === 'OUVERT'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-200'
                        : 'border-slate-200 bg-slate-100 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300'
                    }`}
                  >
                    {detail.statut === 'OUVERT' ? t('patient.dossier.open') : t('patient.dossier.closed')}
                  </span>
                </div>
              </GlassCard>

              {(detail.evenements ?? []).length === 0 ? (
                <GlassCard className="mt-3 p-8 text-center">
                  <p className="text-xs text-slate-400">{t('patient.dossier.emptyEvents')}</p>
                </GlassCard>
              ) : (
                <ol className="mt-3 space-y-0">
                  {(detail.evenements ?? []).map((event, index, list) => (
                    <li key={event.id} className="relative flex gap-3 pb-5 last:pb-0">
                      {index < list.length - 1 && (
                        <span aria-hidden="true" className="absolute left-[13px] top-8 h-[calc(100%-2rem)] w-px bg-slate-200 dark:bg-white/10" />
                      )}
                      <span className="z-10 mt-1 h-7 w-7 shrink-0 rounded-full border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900" aria-hidden="true" />
                      <div className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-900">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${EVENT_STYLE[event.type] ?? EVENT_STYLE.NOTE}`}>
                            {t(`patient.dossier.event_${event.type.toLowerCase()}`, event.type)}
                          </span>
                          {event.signe && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                              <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                              {t('patient.dossier.signed')}
                            </span>
                          )}
                          <span className="ml-auto text-[11px] text-slate-400">{formatDate(event.createdAt, locale)}</span>
                        </div>
                        <p className="mt-1.5 text-xs font-bold text-slate-800 dark:text-slate-100">{event.titre}</p>
                        {event.auteurNom && (
                          <p className="mt-0.5 text-[11px] text-slate-400">{event.auteurNom}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </>
          )}
        </div>
      ) : dossiers.length === 0 ? (
        <GlassCard className="mt-4 p-8 text-center">
          <ShieldCheck className="mx-auto h-6 w-6 text-slate-300 dark:text-slate-600" aria-hidden="true" />
          <p className="mt-2 text-xs font-bold text-slate-600 dark:text-slate-300">{t('patient.dossier.emptyTitle')}</p>
          <p className="mt-1 text-[11px] text-slate-400">{t('patient.dossier.emptyDesc')}</p>
        </GlassCard>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {dossiers.map((dossier) => (
            <button
              key={dossier.id}
              type="button"
              onClick={() => openDetail(dossier.id)}
              className="rounded-lg border border-slate-200 bg-white p-4 text-left transition hover:border-primary-300 hover:shadow-sm dark:border-white/10 dark:bg-slate-900"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.04em] text-slate-400">{dossier.numero}</p>
                <span
                  className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-bold ${
                    dossier.statut === 'OUVERT'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-200'
                      : 'border-slate-200 bg-slate-100 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300'
                  }`}
                >
                  {dossier.statut === 'OUVERT' ? t('patient.dossier.open') : t('patient.dossier.closed')}
                </span>
              </div>
              <p className="mt-1.5 flex items-center gap-1.5 text-sm font-bold text-slate-800 dark:text-slate-100">
                <Building2 className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                <span className="truncate">{dossier.centre?.nom ?? '–'}</span>
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                {t('patient.dossier.eventsCount', { count: dossier.evenementsTotal })}
                {dossier.dernierEvenementAt ? ` · ${formatDate(dossier.dernierEvenementAt, locale)}` : ''}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
