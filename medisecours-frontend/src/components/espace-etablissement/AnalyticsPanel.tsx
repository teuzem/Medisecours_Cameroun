'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  BarChart3,
  Bookmark,
  CalendarDays,
  Clock,
  Download,
  Eye,
  Gauge,
  Globe,
  Lightbulb,
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
  Target,
  TrendingDown,
  TrendingUp,
  UsersRound,
  UserRound,
  Zap,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts'
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
  serieHoraire?: number[]
  comparaison?: {
    totalPeriodePrecedente: number
    totauxPeriodePrecedente: Record<string, number>
    croissancePourcent: number
  }
  topServices: { service: string; nb: number }[]
  medecinsActivite: MedecinActivite[]
  equipe?: { actifs: Record<string, number>; total: number; medecinsAffilies: number }
}

const PERIOD_OPTIONS = [7, 30, 90, 360] as const
const METRIC_OPTIONS = ['all', ...ANALYTIC_TYPES] as const
const LIVE_REFRESH_VISIBLE_MS = 15_000
const LIVE_REFRESH_HIDDEN_MS = 60_000

/* ──────────────────────────────────────────────────────────────────────────
 * Helpers
 * ────────────────────────────────────────────────────────────────────────── */

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

function hourLabel(hour: number, locale: string) {
  return `${String(hour).padStart(2, '0')}h`
}

/* ──────────────────────────────────────────────────────────────────────────
 * Storytelling — récits calculés depuis les données
 * ────────────────────────────────────────────────────────────────────────── */

type Insight = { icon: any; text: string; tone: 'accent' | 'mint' | 'amber' | 'red' }

function buildInsights(
  data: AnalyticsData,
  t: (key: string, opts?: Record<string, unknown>) => string,
  locale: string,
): Insight[] {
  const insights: Insight[] = []
  const serie = data.serie ?? []
  if (serie.length === 0 || data.total === 0) return insights

  // Pic horaire
  const heures = data.serieHoraire ?? []
  if (heures.length === 24 && heures.some((v) => v > 0)) {
    let peakHour = 0
    let peakValue = 0
    heures.forEach((v, h) => {
      if (v > peakValue) {
        peakValue = v
        peakHour = h
      }
    })
    insights.push({
      icon: Clock,
      text: t('etablissement.analytics.insightPeakHour', { hour: hourLabel(peakHour, locale), count: peakValue }),
      tone: 'accent',
    })
  }

  // Jour de la semaine le plus actif (lundi=0)
  const weekdayTotals = Array.from({ length: 7 }, () => 0)
  for (const point of serie) {
    const date = new Date(`${point.jour}T00:00:00`)
    const idx = (date.getDay() + 6) % 7
    weekdayTotals[idx] += ANALYTIC_TYPES.reduce((sum, k) => sum + (point[k] ?? 0), 0)
  }
  const peakDayIdx = weekdayTotals.indexOf(Math.max(...weekdayTotals))
  const weekdayName = new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(new Date(2024, 0, 8 + peakDayIdx))
  insights.push({
    icon: CalendarDays,
    text: t('etablissement.analytics.insightPeakDay', { day: weekdayName, count: weekdayTotals[peakDayIdx] }),
    tone: 'mint',
  })

  // Moyenne journalière
  const avg = Math.round((data.total / serie.length) * 10) / 10
  insights.push({
    icon: Gauge,
    text: t('etablissement.analytics.insightAvgDaily', { avg: avg.toLocaleString(locale), period: data.period }),
    tone: 'accent',
  })

  // Type dominant
  const sortedTypes = ANALYTIC_TYPES.map((type) => ({ type, count: data.totaux[type] ?? 0 }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count)
  if (sortedTypes[0]) {
    const share = data.total > 0 ? Math.round((sortedTypes[0].count / data.total) * 100) : 0
    insights.push({
      icon: TrendingUp,
      text: t('etablissement.analytics.insightTopType', {
        type: t(`etablissement.analytics.types.${sortedTypes[0].type}`),
        count: sortedTypes[0].count,
        share,
      }),
      tone: 'amber',
    })
  }

  // Croissance vs période précédente
  const croissance = data.comparaison?.croissancePourcent ?? 0
  if (croissance > 0) {
    insights.push({
      icon: TrendingUp,
      text: t('etablissement.analytics.insightGrowthUp', { rate: croissance }),
      tone: 'mint',
    })
  } else if (croissance < 0) {
    insights.push({
      icon: TrendingDown,
      text: t('etablissement.analytics.insightGrowthDown', { rate: Math.abs(croissance) }),
      tone: 'red',
    })
  }

  return insights
}

/* ──────────────────────────────────────────────────────────────────────────
 * Charts (recharts)
 * ────────────────────────────────────────────────────────────────────────── */

function sampleSerie(serie: SeriePoint[], maxPoints = 60) {
  if (serie.length <= maxPoints) return serie
  const stride = Math.ceil(serie.length / maxPoints)
  return serie.filter((_, index) => index % stride === 0 || index === serie.length - 1)
}

function StackedActivityChart({
  serie,
  accent,
  metric,
}: {
  serie: SeriePoint[]
  accent: string
  metric: (typeof METRIC_OPTIONS)[number]
}) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'en' ? 'en-US' : 'fr-FR'
  const keys: readonly string[] = metric === 'all' ? ANALYTIC_TYPES : [metric]
  const points = useMemo(() => {
    const sampled = sampleSerie(serie)
    return sampled.map((point) => {
      const row: Record<string, string | number> = {
        date: shortDate(point.jour, locale),
        total: keys.reduce((sum, key) => sum + (point[key] ?? 0), 0),
      }
      for (const key of keys) row[key] = point[key] ?? 0
      return row
    })
  }, [serie, metric, locale])

  return (
    <div>
      <div className="h-56 w-full" role="img" aria-label={t('etablissement.analytics.stackAria')}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <defs>
              {keys.map((key) => (
                <linearGradient key={key} id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={TYPE_COLORS[key] ?? accent} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={TYPE_COLORS[key] ?? accent} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-200 dark:text-slate-800" />
            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} dy={8} minTickGap={24} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} allowDecimals={false} />
            <RechartsTooltip
              contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: 11 }}
              formatter={(value: number, name: string) => [value, t(`etablissement.analytics.types.${name}`, name)]}
            />
            {keys.map((key) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                stackId="1"
                stroke={TYPE_COLORS[key] ?? accent}
                strokeWidth={1.5}
                fillOpacity={1}
                fill={`url(#grad-${key})`}
                animationDuration={800}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {metric === 'all' && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {ANALYTIC_TYPES.map((key) => (
            <span key={key} className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: TYPE_COLORS[key] }} />
              {t(`etablissement.analytics.types.${key}`)}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function HourlyChart({ serieHoraire, accent }: { serieHoraire: number[]; accent: string }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'en' ? 'en-US' : 'fr-FR'
  const points = useMemo(
    () => serieHoraire.map((value, hour) => ({ hour: hourLabel(hour, locale), value })),
    [serieHoraire, locale],
  )

  return (
    <div className="h-48 w-full" role="img" aria-label={t('etablissement.analytics.hourlyAria')}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={points} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-200 dark:text-slate-800" />
          <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#9CA3AF' }} interval={2} />
          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} allowDecimals={false} />
          <RechartsTooltip
            cursor={{ fill: 'rgba(0,0,0,0.04)' }}
            contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: 11 }}
            formatter={(value: number) => [value, t('etablissement.analytics.interactionCount', { count: value })]}
          />
          <Bar dataKey="value" fill={accent} radius={[3, 3, 0, 0]} maxBarSize={18} animationDuration={800} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function TypeDonut({ totaux, accent }: { totaux: Record<string, number>; accent: string }) {
  const { t } = useTranslation()
  const data = useMemo(
    () =>
      ANALYTIC_TYPES.map((type) => ({
        name: t(`etablissement.analytics.types.${type}`),
        value: totaux[type] ?? 0,
        color: TYPE_COLORS[type] ?? accent,
      })).filter((d) => d.value > 0),
    [totaux, t, accent],
  )

  if (data.length === 0) return null

  return (
    <div className="relative h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={52} outerRadius={80} paddingAngle={3} dataKey="value" animationDuration={800}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <RechartsTooltip
            contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: 11 }}
            formatter={(value: number, name: string) => [value, name]}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-black tabular-nums text-slate-900 dark:text-white">{data.reduce((sum, d) => sum + d.value, 0)}</span>
        <span className="text-[10px] text-slate-400">{t('etablissement.analytics.totalLabel')}</span>
      </div>
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
 * Legacy-style widgets conservés (funnel, conversion, weekday, bars)
 * ────────────────────────────────────────────────────────────────────────── */

function EngagementFunnel({ totals }: { totals: Record<string, number> }) {
  const { t } = useTranslation()
  const stages = [
    { key: 'reach', icon: Eye, label: t('etablissement.analytics.funnelReach'), value: totals.fiche ?? 0, color: '#1E3A5F' },
    { key: 'contact', icon: Phone, label: t('etablissement.analytics.funnelContact'), value: (totals.telephone ?? 0) + (totals.email ?? 0) + (totals.site_web ?? 0), color: '#059669' },
    { key: 'intent', icon: Target, label: t('etablissement.analytics.funnelIntent'), value: (totals.itineraire ?? 0) + (totals.sauvegarde ?? 0) + (totals.partage ?? 0), color: '#4f46e5' },
    { key: 'care', icon: Siren, label: t('etablissement.analytics.funnelCare'), value: (totals.sos ?? 0) + (totals.avis ?? 0) + (totals.service ?? 0), color: '#dc2626' },
  ]
  const max = Math.max(stages[0]?.value ?? 0, 1)
  return (
    <div className="space-y-3">
      {stages.map(({ key, icon: Icon, label, value, color }) => (
        <div key={key} title={`${label}: ${value}`} className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg text-white" style={{ backgroundColor: color }}>
            <Icon className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-xs font-bold text-slate-700 dark:text-slate-200">{label}</span>
              <span className="text-xs font-black tabular-nums text-slate-900 dark:text-white">{value}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div className="h-full rounded-full transition-all" style={{ width: `${Math.max((value / max) * 100, value > 0 ? 4 : 0)}%`, backgroundColor: color }} />
            </div>
          </div>
          <span className="text-[10px] font-bold text-slate-400">{max > 0 ? `${Math.round((value / max) * 100)}%` : '0%'}</span>
        </div>
      ))}
    </div>
  )
}

function ConversionOverview({ totals, accent }: { totals: Record<string, number>; accent: string }) {
  const { t } = useTranslation()
  const reach = Math.max(totals.fiche ?? 0, 0)
  const stages = [
    { key: 'contact', label: t('etablissement.analytics.funnelContact'), value: (totals.telephone ?? 0) + (totals.email ?? 0) + (totals.site_web ?? 0) },
    { key: 'intent', label: t('etablissement.analytics.funnelIntent'), value: (totals.itineraire ?? 0) + (totals.sauvegarde ?? 0) + (totals.partage ?? 0) },
    { key: 'care', label: t('etablissement.analytics.funnelCare'), value: (totals.sos ?? 0) + (totals.avis ?? 0) + (totals.service ?? 0) },
  ]
  const max = Math.max(reach, ...stages.map((stage) => stage.value), 1)
  const finalRate = reach > 0 ? Math.round((stages[2].value / reach) * 100) : 0

  return (
    <div className="space-y-3">
      {stages.map((stage) => {
        const rate = reach > 0 ? Math.round((stage.value / reach) * 100) : 0
        return (
          <div key={stage.key} title={`${stage.label}: ${stage.value} · ${rate}%`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <div className="min-w-0">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="truncate text-[11px] font-bold text-slate-700 dark:text-slate-200">{stage.label}</span>
                <span className="text-[10px] font-black tabular-nums text-slate-500 dark:text-slate-400">{rate}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div className="h-full rounded-full transition-all" style={{ width: `${Math.max((stage.value / max) * 100, stage.value > 0 ? 3 : 0)}%`, backgroundColor: accent }} />
              </div>
            </div>
            <span className="w-12 text-right text-xs font-black tabular-nums text-slate-900 dark:text-white">{stage.value}</span>
          </div>
        )
      })}
      <p className="rounded-lg bg-slate-50 px-3 py-2 text-[10px] font-semibold leading-4 text-slate-600 dark:bg-slate-900/70 dark:text-slate-300">
        {t('etablissement.analytics.storyConversion', { rate: finalRate })}
      </p>
    </div>
  )
}

function WeekdayActivity({ serie, accent }: { serie: SeriePoint[]; accent: string }) {
  const { i18n, t } = useTranslation()
  const locale = i18n.language === 'en' ? 'en-US' : 'fr-FR'
  const days = useMemo(() => {
    const values = Array.from({ length: 7 }, (_, index) => ({
      index,
      label: new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(2024, 0, 7 + index)),
      total: 0,
    }))
    for (const point of serie) {
      const date = new Date(`${point.jour}T00:00:00`)
      const mondayIndex = (date.getDay() + 6) % 7
      values[mondayIndex].total += ANALYTIC_TYPES.reduce((sum, key) => sum + (point[key] ?? 0), 0)
    }
    return values
  }, [locale, serie])
  const max = Math.max(...days.map((day) => day.total), 1)
  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((day) => (
        <div key={day.index} title={`${day.label}: ${day.total}`} className="min-w-0 text-center">
          <div className="flex h-24 items-end justify-center rounded-md bg-slate-50 p-1 dark:bg-slate-950/40">
            <div
              className="w-full max-w-6 rounded-sm transition-all"
              style={{ height: `${Math.max((day.total / max) * 100, day.total > 0 ? 6 : 2)}%`, backgroundColor: accent }}
              title={`${day.label}: ${day.total}`}
            />
          </div>
          <p className="mt-1 truncate text-[10px] font-bold uppercase text-slate-400">{day.label}</p>
          <p className="text-xs font-black tabular-nums text-slate-700 dark:text-slate-200">{day.total}</p>
        </div>
      ))}
      <p className="col-span-full mt-1 text-[10px] font-semibold text-slate-400">{t('etablissement.analytics.weekdayHint')}</p>
    </div>
  )
}

function LiveNumber({ target }: { target: number }) {
  const { i18n } = useTranslation()
  const animated = useCountUp(target, 500)
  return <>{new Intl.NumberFormat(i18n.language === 'en' ? 'en-US' : 'fr-FR').format(Math.round(animated))}</>
}

function SignalRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2.5 last:border-0 last:pb-0 dark:border-slate-800">
      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-lg font-black tabular-nums text-slate-900 dark:text-white">
        <LiveNumber target={value} />
      </span>
    </div>
  )
}

function TypeIcon({ type, className }: { type: string; className?: string }) {
  switch (type) {
    case 'fiche': return <Eye className={className} />
    case 'telephone': return <Phone className={className} />
    case 'email': return <Mail className={className} />
    case 'site_web': return <Globe className={className} />
    case 'itineraire': return <Navigation className={className} />
    case 'partage': return <Share2 className={className} />
    case 'sauvegarde': return <Bookmark className={className} />
    case 'sos': return <Siren className={className} />
    case 'suggestion': return <MessageSquare className={className} />
    case 'proximite': return <MapPin className={className} />
    case 'service': return <Stethoscope className={className} />
    case 'avis': return <Star className={className} />
    default: return <BarChart3 className={className} />
  }
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
  const [metric, setMetric] = useState<(typeof METRIC_OPTIONS)[number]>('all')
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const intervalRef = useRef<number | null>(null)

  // Temps réel : polling adaptatif selon la visibilité de l'onglet.
  useEffect(() => {
    let cancelled = false

    const load = () => {
      api
        .get<AnalyticsData>('/api/carte/evenements', { params: { centre: centreId, period } })
        .then(({ data: d }) => {
          if (cancelled) return
          setData(d)
          setError(false)
          setLastRefresh(new Date())
        })
        .catch(() => {
          if (!cancelled) setError(true)
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }

    const startInterval = () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current)
      const delay = typeof document !== 'undefined' && document.visibilityState === 'visible'
        ? LIVE_REFRESH_VISIBLE_MS
        : LIVE_REFRESH_HIDDEN_MS
      intervalRef.current = window.setInterval(load, delay)
    }

    const onVisibility = () => startInterval()

    load()
    startInterval()
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility)
    }

    return () => {
      cancelled = true
      if (intervalRef.current) window.clearInterval(intervalRef.current)
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility)
      }
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

  const exportAnalytics = () => {
    if (!data || typeof window === 'undefined') return
    const headers = ['date', ...ANALYTIC_TYPES]
    const rows = data.serie.map((point) => [point.jour, ...ANALYTIC_TYPES.map((type) => String(point[type] ?? 0))])
    const csv = [headers, ...rows].map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `medisecours-analytics-${centreId}-${period}d.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const breakdown = useMemo(() => {
    if (!data) return []
    return ANALYTIC_TYPES.map((type) => ({ type, count: data.totaux[type] ?? 0 }))
      .filter((row) => row.count > 0)
      .sort((a, b) => b.count - a.count)
  }, [data])

  const insights = useMemo(() => (data ? buildInsights(data, t, locale) : []), [data, t, locale])

  const maxDocActivity = useMemo(() => {
    if (!data) return 0
    return Math.max(...data.medecinsActivite.map((m) => m.consultations + m.prescriptions), 0)
  }, [data])

  const croissance = data?.comparaison?.croissancePourcent ?? 0
  const growthTone = croissance > 0 ? 'up' : croissance < 0 ? 'down' : 'neutral'

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
        title={t('etablissement.analytics.title')}
        description={t('etablissement.analytics.description')}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
              {PERIOD_OPTIONS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => selectPeriod(p)}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-bold transition ${
                    period === p
                      ? 'bg-primary-900 text-white dark:bg-white dark:text-primary-900'
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
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-white"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={exportAnalytics}
              disabled={!data || loading}
              aria-label={t('etablissement.analytics.export')}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-white"
            >
              <Download className="h-4 w-4" />
            </button>
          </div>
        }
      />

      {loading ? (
        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-lg bg-slate-200/70 dark:bg-slate-800/60" />
            ))}
          </div>
          <div className="h-48 animate-pulse rounded-lg bg-slate-200/70 dark:bg-slate-800/60" />
        </div>
      ) : error ? (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-lg border border-red-200 bg-red-50/70 px-6 py-10 text-center dark:border-red-900/40 dark:bg-red-950/20">
          <ShieldAlert className="h-8 w-8 text-red-500" />
          <p className="text-sm font-semibold text-red-900 dark:text-red-200">{t('etablissement.analytics.error')}</p>
          <button
            type="button"
            onClick={refresh}
            className="rounded-lg bg-primary-900 px-4 py-2 text-xs font-bold text-white transition hover:opacity-90 dark:bg-white dark:text-primary-900"
          >
            {t('etablissement.analytics.retry')}
          </button>
        </div>
      ) : !data ? null : (
        <div className="mt-6 space-y-5">
          {/* Live status + growth */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex w-fit items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-500 dark:bg-slate-800/80 dark:text-slate-300">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-mint-500" />
              </span>
              {t('etablissement.analytics.liveBadge')}
              {lastRefresh && (
                <span className="font-normal text-slate-400">
                  · {t('etablissement.analytics.lastUpdated', { time: fullDate(lastRefresh.toISOString(), locale) })}
                </span>
              )}
            </div>
            <div
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold ${
                growthTone === 'up'
                  ? 'bg-mint-50 text-primary-700 dark:bg-primary-500/10 dark:text-mint-200'
                  : growthTone === 'down'
                    ? 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              {growthTone === 'up' ? <TrendingUp className="h-3.5 w-3.5" /> : growthTone === 'down' ? <TrendingDown className="h-3.5 w-3.5" /> : <Zap className="h-3.5 w-3.5" />}
              {t('etablissement.analytics.growthLabel')} {croissance > 0 ? '+' : ''}
              {croissance}%
              <span className="font-normal opacity-70">({t('etablissement.analytics.previousPeriod')})</span>
            </div>
          </div>

          {/* KPI row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {kpis.map((kpi, i) => (
              <StatCard key={kpi.label} icon={kpi.icon} label={kpi.label} animateTo={kpi.value} tile={kpi.tile} highlight={kpi.highlight} delay={i * 60} />
            ))}
          </div>

          {/* Storytelling insights */}
          {insights.length > 0 && (
            <GlassCard className="!p-4">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4" style={{ color: accent }} />
                <p className="text-sm font-extrabold text-slate-900 dark:text-white">{t('etablissement.analytics.insightsTitle')}</p>
              </div>
              <p className="mt-0.5 text-[11px] font-semibold text-slate-400 dark:text-slate-500">{t('etablissement.analytics.insightsSubtitle')}</p>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {insights.map((insight, i) => (
                  <li
                    key={i}
                    className={`flex items-start gap-2.5 rounded-lg border p-2.5 ${
                      insight.tone === 'mint'
                        ? 'border-mint-200 bg-mint-50 dark:border-primary-500/25 dark:bg-primary-500/10'
                        : insight.tone === 'amber'
                          ? 'border-amber-200 bg-amber-50 dark:border-amber-500/25 dark:bg-amber-500/10'
                          : insight.tone === 'red'
                            ? 'border-red-200 bg-red-50 dark:border-red-500/25 dark:bg-red-500/10'
                            : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/60'
                    }`}
                  >
                    <insight.icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden="true" />
                    <p className="text-[11px] font-semibold leading-4 text-slate-700 dark:text-slate-200">{insight.text}</p>
                  </li>
                ))}
              </ul>
            </GlassCard>
          )}

          {/* Daily stacked + funnel */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <GlassCard className="!p-5 lg:col-span-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" style={{ color: accent }} />
                    <p className="text-sm font-extrabold text-slate-900 dark:text-white">{t('etablissement.analytics.stackTitle')}</p>
                  </div>
                  <p className="mt-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500">{t('etablissement.analytics.stackSubtitle')}</p>
                </div>
                <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.04em] text-slate-400">
                  <span>{t('etablissement.analytics.metricLabel')}</span>
                  <select
                    value={metric}
                    onChange={(event) => setMetric(event.target.value as (typeof METRIC_OPTIONS)[number])}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold normal-case tracking-normal text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  >
                    {METRIC_OPTIONS.map((key) => (
                      <option key={key} value={key}>
                        {key === 'all' ? t('etablissement.analytics.metricAll') : t(`etablissement.analytics.types.${key}`)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mt-4">
                <StackedActivityChart serie={data.serie} accent={accent} metric={metric} />
              </div>
            </GlassCard>
            <GlassCard className="!p-5">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                <p className="text-sm font-extrabold text-slate-900 dark:text-white">{t('etablissement.analytics.funnelTitle')}</p>
              </div>
              <p className="mt-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500">{t('etablissement.analytics.funnelSubtitle')}</p>
              <div className="mt-5">
                <EngagementFunnel totals={data.totaux} />
              </div>
              <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-[10px] font-semibold leading-4 text-slate-600 dark:bg-slate-900/70 dark:text-slate-300">
                {t('etablissement.analytics.storyFunnel', {
                  reach: data.totaux.fiche ?? 0,
                  care: (data.totaux.sos ?? 0) + (data.totaux.avis ?? 0) + (data.totaux.service ?? 0),
                })}
              </p>
            </GlassCard>
          </div>

          {/* Hourly + donut */}
          {(data.serieHoraire?.some((v) => v > 0) || data.total > 0) && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <GlassCard className="!p-5 lg:col-span-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" style={{ color: accent }} />
                  <p className="text-sm font-extrabold text-slate-900 dark:text-white">{t('etablissement.analytics.hourlyTitle')}</p>
                </div>
                <p className="mt-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500">{t('etablissement.analytics.hourlySubtitle')}</p>
                <div className="mt-3">
                  {data.serieHoraire ? <HourlyChart serieHoraire={data.serieHoraire} accent={accent} /> : null}
                </div>
              </GlassCard>
              <GlassCard className="!p-5">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" style={{ color: accent }} />
                  <p className="text-sm font-extrabold text-slate-900 dark:text-white">{t('etablissement.analytics.breakdownTitle')}</p>
                </div>
                <p className="mt-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500">{t('etablissement.analytics.breakdownSubtitle')}</p>
                <div className="mt-3">
                  <TypeDonut totaux={data.totaux} accent={accent} />
                </div>
              </GlassCard>
            </div>
          )}

          {/* Conversion */}
          <GlassCard className="!p-5">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4" style={{ color: accent }} />
              <p className="text-sm font-extrabold text-slate-900 dark:text-white">{t('etablissement.analytics.conversionTitle')}</p>
            </div>
            <p className="mt-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500">{t('etablissement.analytics.conversionSubtitle')}</p>
            <div className="mt-4">
              <ConversionOverview totals={data.totaux} accent={accent} />
            </div>
          </GlassCard>

          {/* Total + weekday */}
          {data.total > 0 ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <GlassCard className="flex flex-col justify-between !p-5">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.04em] text-slate-400 dark:text-slate-500">{t('etablissement.analytics.totalLabel')}</p>
                  <p className="mt-2 font-display text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                    <LiveNumber target={data.total} />
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-400 dark:text-slate-500">
                    {t('etablissement.analytics.since')} {shortDate(data.since.slice(0, 10), locale)}
                  </p>
                  {data.comparaison && (
                    <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
                      {t('etablissement.analytics.previousPeriod')}: <span className="font-bold tabular-nums">{data.comparaison.totalPeriodePrecedente}</span>
                    </p>
                  )}
                </div>
              </GlassCard>
              <GlassCard className="!p-5 lg:col-span-2">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" style={{ color: accent }} />
                  <p className="text-sm font-extrabold text-slate-900 dark:text-white">{t('etablissement.analytics.weekdayTitle')}</p>
                </div>
                <p className="mt-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500">{t('etablissement.analytics.weekdaySubtitle')}</p>
                <div className="mt-4">
                  <WeekdayActivity serie={data.serie} accent={accent} />
                </div>
              </GlassCard>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-slate-200 bg-white/50 px-6 py-10 text-center dark:border-slate-800 dark:bg-slate-900/40">
              <BarChart3 className="h-8 w-8 text-slate-300 dark:text-slate-600" />
              <p className="max-w-md text-sm font-semibold leading-6 text-slate-500 dark:text-slate-400">{t('etablissement.analytics.noData')}</p>
            </div>
          )}

          {/* Breakdown list + top services */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
                      <div key={row.type} title={`${t(`etablissement.analytics.types.${row.type}`)}: ${row.count}`} className="flex items-center gap-3">
                        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg" style={{ background: `${color}1a`, color }}>
                          <TypeIcon type={row.type} className="h-3.5 w-3.5" />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-xs font-bold text-slate-700 dark:text-slate-200">
                          {t(`etablissement.analytics.types.${row.type}`)}
                        </span>
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                          <div className="h-full rounded-full transition-all" style={{ width: `${Math.max((row.count / maxCount) * 100, 6)}%`, backgroundColor: color }} />
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
                      <div key={svc.service} title={`${svc.service}: ${svc.nb}`} className="flex items-center gap-3">
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
                            {i === 0 && (
                              <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.04em] text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                                {t('etablissement.analytics.tendance')}
                              </span>
                            )}
                          </p>
                          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                            <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${Math.max((svc.nb / maxCount) * 100, 6)}%` }} />
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

          {/* Team signals */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <GlassCard className="!p-5 lg:col-span-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-extrabold text-slate-900 dark:text-white">{t('etablissement.analytics.docsTitle')}</p>
                  <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">{t('etablissement.analytics.docsSubtitle')}</p>
                </div>
                {data.medecinsActivite.length > 0 && (
                  <span className="rounded-full bg-mint-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.04em] text-primary-700 dark:bg-primary-500/15 dark:text-mint-200">
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
                  data.medecinsActivite.slice(0, 6).map((m) => {
                    const total = m.consultations + m.prescriptions
                    const name = [m.prenom, m.nom].filter(Boolean).join(' ') || `#${m.medecinId}`
                    const sub = m.fonction || m.specialite || t('etablissement.analytics.docsSansFonction')
                    const initials = name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
                    return (
                      <div key={m.medecinId} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3.5 dark:border-slate-700 dark:bg-slate-900/60">
                        <span
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg font-display text-sm font-black text-white"
                          style={{ background: accent }}
                        >
                          {initials || '?'}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-xs font-extrabold text-slate-900 dark:text-white">{name}</p>
                            <span className="text-[10px] font-black tabular-nums text-slate-500 dark:text-slate-300">
                              {m.consultations} {t('etablissement.analytics.docsConsultations')} · {m.prescriptions} {t('etablissement.analytics.docsPrescriptions')}
                            </span>
                          </div>
                          <p className="truncate text-[11px] font-semibold text-slate-400 dark:text-slate-500">{sub}</p>
                          <div className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                            {total > 0 ? (
                              <>
                                <div className="h-full rounded-l-full bg-mint-500 transition-all" style={{ width: `${(m.consultations / Math.max(maxDocActivity, 1)) * 100}%` }} />
                                <div className="h-full rounded-r-full bg-primary-500 transition-all" style={{ width: `${(m.prescriptions / Math.max(maxDocActivity, 1)) * 100}%` }} />
                              </>
                            ) : (
                              <div className="h-full w-full rounded-full bg-slate-100 dark:bg-slate-800" />
                            )}
                          </div>
                          <p className="mt-1.5 text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                            {total > 0 ? `${t('etablissement.analytics.lastActivity')} ${fullDate(m.dernierActivite, locale)}` : t('etablissement.analytics.docsAucune')}
                          </p>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </GlassCard>
            <GlassCard className="!p-5">
              <div className="flex items-center gap-2">
                <UsersRound className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                <p className="text-sm font-extrabold text-slate-900 dark:text-white">{t('etablissement.analytics.teamSignalTitle')}</p>
              </div>
              <p className="mt-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500">{t('etablissement.analytics.teamSignalSubtitle')}</p>
              <div className="mt-5 space-y-3">
                <SignalRow label={t('etablissement.analytics.teamMembers')} value={data.equipe?.total ?? 0} />
                <SignalRow label={t('etablissement.analytics.teamDoctors')} value={data.equipe?.medecinsAffilies ?? data.medecinsActivite.length} />
                <SignalRow label={t('etablissement.analytics.teamActive')} value={Object.values(data.equipe?.actifs ?? {}).reduce((sum, count) => sum + count, 0)} />
                <div className="flex items-center gap-2 pt-2 text-[10px] font-semibold text-slate-400">
                  <span className="h-2 w-2 rounded-full bg-mint-500" />
                  {t('etablissement.analytics.generatedAt', { date: fullDate(data.generatedAt, locale) })}
                </div>
              </div>
            </GlassCard>
          </div>
        </div>
      )}
    </GlassCard>
  )
}
