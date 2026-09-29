'use client'

import { useEffect, useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  BarChart3,
  Bookmark,
  Eye,
  Globe,
  Mail,
  MapPin,
  MessageSquare,
  Navigation,
  Phone,
  RefreshCw,
  Share2,
  ShieldAlert,
  Siren,
  Star,
  Stethoscope,
  UserRound,
} from 'lucide-react'
import api from '../../api/axios'
import GlassCard from '../ui/GlassCard'
import SectionHeader from '../ui/SectionHeader'
import StatCard from '../ui/StatCard'
import { useCountUp } from '../ui/useCountUp'

/* ──────────────────────────────────────────────────────────────────────────
 * Types
 * ────────────────────────────────────────────────────────────────────────── */

const ANALYTIC_TYPES = [
  'fiche',
  'telephone',
  'email',
  'site_web',
  'itineraire',
  'partage',
  'sauvegarde',
  'sos',
  'suggestion',
  'proximite',
  'service',
  'avis',
] as const

const TYPE_COLORS: Record<string, string> = {
  fiche: '#1E3A5F',
  telephone: '#10B981',
  email: '#0EA5E9',
  site_web: '#6366F1',
  itineraire: '#F59E0B',
  partage: '#EC4899',
  sauvegarde: '#8B5CF6',
  sos: '#EF4444',
  suggestion: '#14B8A6',
  proximite: '#3B82F6',
  service: '#F97316',
  avis: '#22C55E',
}

type SeriePoint = { jour: string } & Record<string, number>

type MedecinActivite = {
  medecinId: number
  nom?: string | null
  prenom?: string | null
  specialite?: string | null
  fonction?: string | null
  salle?: string | null
  role?: string | null
  teleconsultation?: boolean
  consultations: number
  prescriptions: number
  dernierActivite?: string | null
}

type AnalyticsData = {
  scope: 'etablissement' | 'global'
  period: number
  since: string
  generatedAt: string
  totaux: Record<string, number>
  total: number
  serie: SeriePoint[]
  topServices: { service: string; nb: number }[]
  medecinsActivite: MedecinActivite[]
  equipe?: { actifs: Record<string, number>; total: number; medecinsAffilies: number }
}

const PERIOD_OPTIONS = [7, 30, 90] as const

/* ──────────────────────────────────────────────────────────────────────────
 * Aire d'évolution (SVG natif, aucune dépendance)
 * ────────────────────────────────────────────────────────────────────────── */

function InteractionArea({ serie, accent }: { serie: SeriePoint[]; accent: string }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'en' ? 'en-US' : 'fr-FR'
  const gradientId = useId().replace(/:/g, '')
  const totals = serie.map((s) => ANALYTIC_TYPES.reduce((sum, k) => sum + (s[k] ?? 0), 0))
  const max = Math.max(...totals, 1)
  const W = 620
  const H = 150
  const P = 10
  const n = totals.length
  const step = n > 1 ? (W - 2 * P) / (n - 1) : 0

  const coords = totals.map((v, i) => ({ x: P + i * step, y: H - P - (v / max) * (H - 2 * P) }))
  const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ')
  const area =
    n > 0
      ? `${line} L${coords[n - 1].x.toFixed(1)},${(H - P).toFixed(1)} L${coords[0].x.toFixed(1)},${(H - P).toFixed(1)} Z`
      : ''

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-40 w-full sm:h-48" role="img" aria-label={t('etablissement.analytics.chartAria')}>
        <defs>
          <linearGradient id={`${gradientId}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity="0.32" />
            <stop offset="100%" stopColor={accent} stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id={`${gradientId}-stroke`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={accent} stopOpacity="0.55" />
            <stop offset="60%" stopColor={accent} stopOpacity="1" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((r) => (
          <line
            key={r}
            x1={P}
            x2={W - P}
            y1={P + r * (H - 2 * P)}
            y2={P + r * (H - 2 * P)}
            className="stroke-slate-200/70 dark:stroke-slate-800"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {area && <path d={area} fill={`url(#${gradientId}-fill)`} />}
        {line && (
          <path
            d={line}
            fill="none"
            stroke={`url(#${gradientId}-stroke)`}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {coords.map((c, i) => (
          <circle
            key={i}
            cx={c.x}
            cy={c.y}
            r="2.5"
            fill={accent}
            className="opacity-70"
            vectorEffect="non-scaling-stroke"
          >
            <title>
              {serie[i]?.jour ?? ''} · {totals[i]} {t('etablissement.analytics.interactionCount', { count: totals[i] })}
            </title>
          </circle>
        ))}
      </svg>
      <div className="mt-1 flex items-center justify-between text-[10px] font-semibold text-slate-400 dark:text-slate-500">
        {serie.length > 0 ? (
          <>
            <span>{shortDate(serie[0].jour, locale)}</span>
            <span>{shortDate(serie[Math.floor((serie.length - 1) / 2)]?.jour ?? serie[0].jour, locale)}</span>
            <span>{shortDate(serie[serie.length - 1].jour, locale)}</span>
          </>
        ) : (
          <span>—</span>
        )}
      </div>
    </div>
  )
}

function shortDate(iso: string, locale = 'fr-FR') {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit' }).format(d)
}

function fullDate(iso: string | undefined, locale = 'fr-FR') {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(d)
}

/* ──────────────────────────────────────────────────────────────────────────
 * Panneau analytique
 * ────────────────────────────────────────────────────────────────────────── */

export default function AnalyticsPanel({ centreId, accent }: { centreId: number; accent: string }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'en' ? 'en-US' : 'fr-FR'
  const [period, setPeriod] = useState<number>(30)
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    const load = () => {
      api
        .get<AnalyticsData>('/api/carte/evenements', { params: { centre: centreId, period } })
        .then(({ data: d }) => {
          if (cancelled) return
          setData(d)
          setError(false)
        })
        .catch(() => {
          if (!cancelled) setError(true)
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }
    load()
    const timer = window.setInterval(load, 60_000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [centreId, period, reloadKey])

  const refresh = () => {
    setLoading(true)
    setError(false)
    setReloadKey((k) => k + 1)
  }

  const selectPeriod = (p: number) => {
    setPeriod(p)
    setLoading(true)
    setError(false)
  }

  const breakdown = useMemo(() => {
    if (!data) return []
    return ANALYTIC_TYPES.map((type) => ({ type, count: data.totaux[type] ?? 0 }))
      .filter((row) => row.count > 0)
      .sort((a, b) => b.count - a.count)
  }, [data])

  const maxDocActivity = useMemo(() => {
    if (!data) return 0
    return Math.max(
      ...data.medecinsActivite.map((m) => m.consultations + m.prescriptions),
      0,
    )
  }, [data])

  const kpis = [
    { icon: Eye, label: t('etablissement.analytics.kpiFiche'), value: data?.totaux.fiche ?? 0, tile: 'accent' as const },
    { icon: Phone, label: t('etablissement.analytics.kpiTelephone'), value: data?.totaux.telephone ?? 0, tile: 'mint' as const },
    { icon: Navigation, label: t('etablissement.analytics.kpiItineraire'), value: data?.totaux.itineraire ?? 0, tile: 'blue' as const },
    { icon: Siren, label: t('etablissement.analytics.kpiSos'), value: data?.totaux.sos ?? 0, tile: 'red' as const, highlight: (data?.totaux.sos ?? 0) > 0 },
    { icon: Bookmark, label: t('etablissement.analytics.kpiSauvegarde'), value: data?.totaux.sauvegarde ?? 0, tile: 'violet' as const },
    { icon: Share2, label: t('etablissement.analytics.kpiPartage'), value: data?.totaux.partage ?? 0, tile: 'amber' as const },
  ]

  return (
    <GlassCard className="p-5 sm:p-6" glow>
      <SectionHeader
        eyebrow={t('etablissement.analytics.eyebrow')}
        title={t('etablissement.analytics.title')}
        description={t('etablissement.analytics.description')}
        action={
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-xl border border-white/70 bg-white/80 p-1 shadow-sm dark:border-white/10 dark:bg-slate-900/70">
              {PERIOD_OPTIONS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => selectPeriod(p)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    period === p
                      ? 'bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  {p}d
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={refresh}
              aria-label={t('etablissement.analytics.refresh')}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/70 bg-white/80 text-slate-500 shadow-sm transition hover:text-slate-900 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:text-white"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        }
      />

      {loading ? (
        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800/60" />
            ))}
          </div>
          <div className="h-48 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800/60" />
        </div>
      ) : error ? (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-red-200 bg-red-50/70 px-6 py-10 text-center dark:border-red-900/40 dark:bg-red-950/20">
          <ShieldAlert className="h-8 w-8 text-urgence-500" />
          <p className="text-sm font-semibold text-red-900 dark:text-red-200">{t('etablissement.analytics.error')}</p>
          <button
            type="button"
            onClick={refresh}
            className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white transition hover:opacity-90 dark:bg-white dark:text-slate-900"
          >
            {t('etablissement.analytics.retry')}
          </button>
        </div>
      ) : !data ? null : (
        <div className="mt-6 space-y-6">
          {/* KPI row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {kpis.map((kpi, i) => (
              <StatCard
                key={kpi.label}
                icon={kpi.icon}
                label={kpi.label}
                animateTo={kpi.value}
                tile={kpi.tile}
                highlight={kpi.highlight}
                delay={i * 60}
              />
            ))}
          </div>

          {/* Stock : total + evolution */}
          {data.total > 0 ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <GlassCard className="flex flex-col justify-between !p-5">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                    {t('etablissement.analytics.totalLabel')}
                  </p>
                  <p className="mt-2 font-display text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                    <LiveNumber target={data.total} />
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-400 dark:text-slate-500">
                    {t('etablissement.analytics.since')} {shortDate(data.since.slice(0, 10), locale)}
                  </p>
                </div>
                <div className="mt-4 inline-flex w-fit items-center gap-3 rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-500 dark:bg-slate-800/80 dark:text-slate-300">
                  <span className="h-2 w-2 rounded-full bg-mint-500" />
                  {t('etablissement.analytics.liveBadge')}
                </div>
              </GlassCard>
              <GlassCard className="!p-5 lg:col-span-2">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-extrabold text-slate-900 dark:text-white">{t('etablissement.analytics.chartTitle')}</p>
                    <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">{t('etablissement.analytics.chartSubtitle')}</p>
                  </div>
                </div>
                <InteractionArea serie={data.serie} accent={accent} />
              </GlassCard>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white/50 px-6 py-10 text-center dark:border-slate-800 dark:bg-slate-900/40">
              <BarChart3 className="h-8 w-8 text-slate-300 dark:text-slate-600" />
              <p className="max-w-md text-sm font-semibold leading-6 text-slate-500 dark:text-slate-400">
                {t('etablissement.analytics.noData')}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Répartition */}
            <GlassCard className="!p-5">
              <p className="text-sm font-extrabold text-slate-900 dark:text-white">{t('etablissement.analytics.breakdownTitle')}</p>
              <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">{t('etablissement.analytics.breakdownSubtitle')}</p>
              <div className="mt-4 space-y-3">
                {breakdown.length === 0 ? (
                  <p className="py-6 text-center text-xs font-semibold text-slate-400">{t('etablissement.analytics.breakdownEmpty')}</p>
                ) : (
                  breakdown.slice(0, 8).map((row) => {
                    const maxCount = breakdown[0].count
                    const color = TYPE_COLORS[row.type] ?? '#64748b'
                    return (
                      <div key={row.type} className="flex items-center gap-3">
                        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg" style={{ background: `${color}1a`, color }}>
                          <TypeIcon type={row.type} className="h-3.5 w-3.5" />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-xs font-bold text-slate-700 dark:text-slate-200">
                          {t(`etablissement.analytics.types.${row.type}`)}
                        </span>
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${Math.max((row.count / maxCount) * 100, 6)}%`, backgroundColor: color }}
                          />
                        </div>
                        <span className="w-10 text-right text-xs font-black tabular-nums text-slate-900 dark:text-white">
                          <LiveNumber target={row.count} />
                        </span>
                      </div>
                    )
                  })
                )}
              </div>
            </GlassCard>

            {/* Services en forte demande */}
            <GlassCard className="!p-5">
              <p className="text-sm font-extrabold text-slate-900 dark:text-white">{t('etablissement.analytics.topServicesTitle')}</p>
              <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">{t('etablissement.analytics.topServicesSubtitle')}</p>
              <div className="mt-4 space-y-3">
                {data.topServices.length === 0 ? (
                  <p className="py-6 text-center text-xs font-semibold text-slate-400">{t('etablissement.analytics.topServicesEmpty')}</p>
                ) : (
                  data.topServices.slice(0, 6).map((svc, i) => {
                    const maxCount = data.topServices[0].nb
                    return (
                      <div key={svc.service} className="flex items-center gap-3">
                        <span
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[11px] font-black text-white ${
                            i === 0 ? 'bg-amber-500' : i === 1 ? 'bg-slate-400' : i === 2 ? 'bg-orange-600' : 'bg-slate-200 dark:bg-slate-800'
                          }`}

                        >
                          <span className={i > 2 ? 'text-slate-500 dark:text-slate-300' : ''}>{i + 1}</span>
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-bold text-slate-800 dark:text-slate-100">
                            {svc.service}
                            {i === 0 && <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                              {t('etablissement.analytics.tendance')}
                            </span>}
                          </p>
                          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-600 transition-all"
                              style={{ width: `${Math.max((svc.nb / maxCount) * 100, 6)}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-xs font-black tabular-nums text-slate-900 dark:text-white">
                          <LiveNumber target={svc.nb} />
                        </span>
                      </div>
                    )
                  })
                )}
              </div>
            </GlassCard>
          </div>

          {/* Activité des médecins */}
          <GlassCard className="!p-5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-extrabold text-slate-900 dark:text-white">{t('etablissement.analytics.docsTitle')}</p>
                <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">{t('etablissement.analytics.docsSubtitle')}</p>
              </div>
              {data.medecinsActivite.length > 0 && (
                <span className="rounded-full bg-mint-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-mint-700 dark:bg-mint-500/15 dark:text-mint-300">
                  {data.medecinsActivite.length} {t('etablissement.analytics.docsCount')}
                </span>
              )}
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {data.medecinsActivite.length === 0 ? (
                <div className="col-span-full flex flex-col items-center gap-2 py-8 text-center">
                  <UserRound className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                  <p className="text-xs font-semibold text-slate-400">{t('etablissement.analytics.docsEmpty')}</p>
                </div>
              ) : (
                data.medecinsActivite.slice(0, 6).map((m, i) => {
                  const total = m.consultations + m.prescriptions
                  const name = [m.prenom, m.nom].filter(Boolean).join(' ') || `#${m.medecinId}`
                  const sub = m.fonction || m.specialite || t('etablissement.analytics.docsSansFonction')
                  const initials = name
                    .split(' ')
                    .slice(0, 2)
                    .map((w) => w[0])
                    .join('')
                    .toUpperCase()
                  return (
                    <div
                      key={m.medecinId}
                      className="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/70 p-3.5 shadow-sm dark:border-white/10 dark:bg-slate-900/60"
                      style={{ animationDelay: `${i * 50}ms` }}
                    >
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-display text-sm font-black text-white"
                        style={{ background: `color-mix(in srgb, ${accent} 82%, white)` }}
                      >
                        {initials || '?'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-xs font-extrabold text-slate-900 dark:text-white">{name}</p>
                          <span className="text-[10px] font-black tabular-nums text-slate-500 dark:text-slate-300">
                            {m.consultations} {t('etablissement.analytics.docsConsultations')} · {m.prescriptions}{' '}
                            {t('etablissement.analytics.docsPrescriptions')}
                          </span>
                        </div>
                        <p className="truncate text-[11px] font-semibold text-slate-400 dark:text-slate-500">{sub}</p>
                        <div className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                          {total > 0 ? (
                            <>
                              <div
                                className="h-full rounded-l-full bg-mint-500 transition-all"
                                style={{ width: `${(m.consultations / Math.max(maxDocActivity, 1)) * 100}%` }}
                              />
                              <div
                                className="h-full rounded-r-full bg-violet-500 transition-all"
                                style={{ width: `${(m.prescriptions / Math.max(maxDocActivity, 1)) * 100}%` }}
                              />
                            </>
                          ) : (
                            <div className="h-full w-full rounded-full bg-slate-100 dark:bg-slate-800" />
                          )}
                        </div>
                        <p className="mt-1.5 text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                          {total > 0
                            ? `${t('etablissement.analytics.lastActivity')} ${fullDate(m.dernierActivite, locale)}`
                            : t('etablissement.analytics.docsAucune')}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </GlassCard>
        </div>
      )}
    </GlassCard>
  )
}

function LiveNumber({ target }: { target: number }) {
  const { i18n } = useTranslation()
  const animated = useCountUp(target, 500)
  return <>{new Intl.NumberFormat(i18n.language === 'en' ? 'en-US' : 'fr-FR').format(Math.round(animated))}</>
}

function TypeIcon({ type, className }: { type: string; className?: string }) {
  switch (type) {
    case 'fiche':
      return <Eye className={className} />
    case 'telephone':
      return <Phone className={className} />
    case 'email':
      return <Mail className={className} />
    case 'site_web':
      return <Globe className={className} />
    case 'itineraire':
      return <Navigation className={className} />
    case 'partage':
      return <Share2 className={className} />
    case 'sauvegarde':
      return <Bookmark className={className} />
    case 'sos':
      return <Siren className={className} />
    case 'suggestion':
      return <MessageSquare className={className} />
    case 'proximite':
      return <MapPin className={className} />
    case 'service':
      return <Stethoscope className={className} />
    case 'avis':
      return <Star className={className} />
    default:
      return <BarChart3 className={className} />
  }
}
