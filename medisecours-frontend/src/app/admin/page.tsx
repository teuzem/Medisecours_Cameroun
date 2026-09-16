'use client'

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Building2,
  Download,
  FolderHeart,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Star,
  Stethoscope,
  Users,
} from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { useTranslation } from 'react-i18next'
import { fetcher } from '../../lib/fetcher'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { useToast } from '../../components/ui/Toast'

const CHART_COLORS = ['#0f2418', '#2f6b45', '#66bb6a', '#b7dfb2', '#e7efe3']

export default function AdminOverview() {
  const { t } = useTranslation()
  const [period, setPeriod] = useState('30d')
  const toast = useToast()

  const QUICK_ACTIONS = [
    {
      href: '/admin/utilisateurs',
      label: t('admin.dashboard.qaUtilisateurs'),
      description: t('admin.dashboard.qaUtilisateursDesc'),
      icon: Users,
    },
    {
      href: '/admin/medecins',
      label: t('admin.dashboard.qaMedecins'),
      description: t('admin.dashboard.qaMedecinsDesc'),
      icon: ShieldCheck,
    },
    {
      href: '/admin/centres',
      label: t('admin.dashboard.qaCentres'),
      description: t('admin.dashboard.qaCentresDesc'),
      icon: Building2,
    },
    {
      href: '/admin/catalogue',
      label: t('admin.dashboard.qaCatalogue'),
      description: t('admin.dashboard.qaCatalogueDesc'),
      icon: BookOpen,
    },
  ]

  const RECOMMENDATION_PRESETS = [
    {
      title: t('admin.dashboard.recValiderPracticiens'),
      description: t('admin.dashboard.recValiderPracticiensDesc'),
      href: '/admin/medecins',
      icon: ShieldCheck,
    },
    {
      title: t('admin.dashboard.recVerifierAvis'),
      description: t('admin.dashboard.recVerifierAvisDesc'),
      href: '/admin/avis',
      icon: Star,
    },
    {
      title: t('admin.dashboard.recMettreAJourCatalogue'),
      description: t('admin.dashboard.recMettreAJourCatalogueDesc'),
      href: '/admin/catalogue',
      icon: FolderHeart,
    },
  ]

  const { data: dashboardData, error, isLoading, isValidating, mutate } = useSWR(
    `/api/admin/dashboard?period=${period}`,
    fetcher,
    { revalidateOnFocus: false }
  )

  const exportCsv = useCallback(() => {
    if (!dashboardData) return

    const stats = dashboardData.stats
    const rows = [
      [t('admin.dashboard.csvIndicator'), t('admin.dashboard.csvValue')],
      [t('admin.dashboard.csvTotalUtilisateurs'), stats?.utilisateurs?.total ?? 0],
      [t('admin.dashboard.csvPatients'), stats?.utilisateurs?.patients ?? 0],
      [t('admin.dashboard.csvMedecinsValides'), stats?.utilisateurs?.medecinsValides ?? 0],
      [t('admin.dashboard.csvMedecinsEnAttente'), stats?.utilisateurs?.medecinsEnAttente ?? 0],
      [t('admin.dashboard.csvMaladies'), stats?.contenu?.maladies ?? 0],
      [t('admin.dashboard.csvCategories'), stats?.contenu?.categories ?? 0],
      [t('admin.dashboard.csvCentres'), stats?.contenu?.centres ?? 0],
      [t('admin.dashboard.csvConsultations'), stats?.activite?.consultations ?? 0],
      [t('admin.dashboard.csvMessages'), stats?.activite?.messages ?? 0],
      [t('admin.dashboard.csvAvis'), stats?.activite?.avis ?? 0],
      [t('admin.dashboard.csvAvisSignales'), stats?.activite?.avisSignales ?? 0],
    ]

    const csv = rows.map((row) => row.map((value) => `"${value}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `medisecours-admin-${period}-${new Date().toISOString().slice(0, 10)}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
    toast.success(t('admin.dashboard.exportToast'))
  }, [dashboardData, period, toast, t])

  const stats = dashboardData?.stats
  const alerts = dashboardData?.alerts ?? []
  const activityFeed = dashboardData?.activityFeed ?? []

  const kpisByKey = useMemo(() => {
    const kpis = dashboardData?.kpis ?? []
    return Object.fromEntries(kpis.map((kpi: any) => [kpi.key, kpi]))
  }, [dashboardData?.kpis])

  const heroValue = stats?.utilisateurs?.total ?? 0
  const heroTrend = kpisByKey.patients?.deltaPercent ?? kpisByKey.medecins?.deltaPercent ?? 0
  const heroSecondary = [
    {
      label: t('admin.dashboard.patients'),
      value: stats?.utilisateurs?.patients ?? 0,
    },
    {
      label: t('admin.dashboard.medecinsValides'),
      value: stats?.utilisateurs?.medecinsValides ?? 0,
    },
  ]

  const summaryCards = [
    {
      label: t('admin.dashboard.summaryConsultations'),
      value: stats?.activite?.consultations ?? 0,
      delta: kpisByKey.consultations?.deltaPercent,
      tone: 'green',
    },
    {
      label: t('admin.dashboard.summaryMessages'),
      value: stats?.activite?.messages ?? 0,
      delta: kpisByKey.messages?.deltaPercent,
      tone: 'rose',
    },
    {
      label: t('admin.dashboard.summaryCentresActifs'),
      value: stats?.contenu?.centres ?? 0,
      delta: kpisByKey.centres?.deltaPercent,
      tone: 'lime',
    },
  ]

  const distributionData = useMemo(() => {
    const gravite = dashboardData?.gravite ?? []
    if (gravite.length > 0) {
      return gravite.map((item: any) => ({
        name: item.name,
        value: item.value,
      }))
    }

    return [
      { name: t('admin.dashboard.patients'), value: stats?.utilisateurs?.patients ?? 0 },
      { name: t('admin.dashboard.medecinsValides'), value: stats?.utilisateurs?.medecinsValides ?? 0 },
      { name: t('admin.dashboard.csvCentres'), value: stats?.contenu?.centres ?? 0 },
      { name: t('admin.dashboard.csvAvis'), value: stats?.activite?.avis ?? 0 },
    ].filter((item: any) => item.value > 0)
  }, [dashboardData?.gravite, stats, t])

  const distributionTotal = distributionData.reduce((sum: number, item: any) => sum + item.value, 0)
  const mainAlert = alerts[0]

  const recommendationCards = [
      ...(alerts.slice(0, 2).map((alert: any) => ({
      title: alert.message,
      description: alert.severity === 'danger'
        ? t('admin.dashboard.recDangerDesc')
        : t('admin.dashboard.recControlDesc'),
      href: alert.href,
      icon: AlertTriangle,
    }))),
    ...RECOMMENDATION_PRESETS,
  ].slice(0, 3)

  if (isLoading && !dashboardData) {
    return <LoadingSpinner label={t('admin.dashboard.loading')} />
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#7d8778]">{t('admin.dashboard.eyebrow')}</p>
          <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-[#152116]">
            {t('admin.dashboard.title')}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[#6d786a]">
            {t('admin.dashboard.description')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-full border border-[#dfe5db] bg-white p-1 shadow-[0_8px_20px_rgba(15,36,24,0.05)]">
            {['7d', '30d', '90d'].map((option: string) => (
              <button
                key={option}
                type="button"
                onClick={() => setPeriod(option)}
                className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                  period === option
                    ? 'bg-[#0f2418] text-white'
                    : 'text-[#677266] hover:bg-[#edf2ea]'
                }`}
              >
                {option.toUpperCase()}
              </button>
            ))}
          </div>
          <ToolbarButton onClick={() => mutate()} disabled={isValidating}>
            <RefreshCw className={`h-4 w-4 ${isValidating ? 'animate-spin' : ''}`} />
            {t('admin.dashboard.refresh')}
          </ToolbarButton>
          <ToolbarButton onClick={exportCsv}>
            <Download className="h-4 w-4" />
            {t('admin.dashboard.exportCsv')}
          </ToolbarButton>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <HeroCard heroValue={heroValue} heroTrend={heroTrend} secondary={heroSecondary} />
        {summaryCards.map((card) => (
          <SummaryCard key={card.label} {...card} />
        ))}
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.6fr_1fr]">
        <SoftPanel className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-lg font-bold text-[#152116]">{t('admin.dashboard.distributionTitle')}</p>
              <p className="mt-1 text-sm text-[#6f796c]">{t('admin.dashboard.distributionSubtitle')}</p>
            </div>
            <span className="rounded-full border border-[#dfe5db] bg-[#f6f8f4] px-3 py-1 text-xs font-semibold text-[#5f6c5d]">
              {period.toUpperCase()}
            </span>
          </div>

          {distributionData.length > 0 ? (
            <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr] lg:items-center">
              <div className="mx-auto h-[260px] w-full max-w-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={distributionData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={72}
                      outerRadius={105}
                      paddingAngle={2}
                    >
                      {distributionData.map((item: any, index: number) => (
                        <Cell key={item.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => formatNumber(value)}
                      contentStyle={{
                        borderRadius: 16,
                        border: '1px solid #e2e7de',
                        boxShadow: '0 10px 30px rgba(15,36,24,0.08)',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-3">
                <div className="rounded-[24px] bg-[#f4f6f1] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7d887a]">{t('admin.dashboard.volumeGlobal')}</p>
                  <p className="mt-2 font-display text-3xl font-extrabold text-[#132014]">
                    {formatNumber(distributionTotal)}
                  </p>
                  <p className="mt-1 text-sm text-[#6f796c]">{t('admin.dashboard.volumeDescription')}</p>
                </div>
                {distributionData.map((item: any, index: number) => (
                  <LegendRow
                    key={item.name}
                    color={CHART_COLORS[index % CHART_COLORS.length]}
                    label={item.name}
                    value={item.value}
                    share={distributionTotal > 0 ? Math.round((item.value / distributionTotal) * 100) : 0}
                  />
                ))}
              </div>
            </div>
          ) : (
            <EmptyState label={t('admin.dashboard.emptyDistribution')} />
          )}
        </SoftPanel>

        <div className="grid gap-4">
          <InsightCard alert={mainAlert} />
          <SoftPanel className="p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-bold text-[#152116]">{t('admin.dashboard.quickActionsTitle')}</p>
                <p className="mt-1 text-sm text-[#6f796c]">{t('admin.dashboard.quickActionsSubtitle')}</p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {QUICK_ACTIONS.map((action: any) => (
                <QuickActionCard key={action.href} {...action} />
              ))}
            </div>
          </SoftPanel>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.45fr_1fr]">
        <SoftPanel className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-lg font-bold text-[#152116]">{t('admin.dashboard.recommendationsTitle')}</p>
              <p className="mt-1 text-sm text-[#6f796c]">{t('admin.dashboard.recommendationsSubtitle')}</p>
            </div>
            <span className="rounded-full border border-[#dfe5db] bg-[#f6f8f4] px-3 py-1 text-xs font-semibold text-[#5f6c5d]">
              {t('admin.dashboard.recommendationsPriority')}
            </span>
          </div>
          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            {recommendationCards.map((card: any) => (
              <RecommendationCard key={`${card.href}-${card.title}`} {...card} />
            ))}
          </div>
        </SoftPanel>

        <SoftPanel className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-lg font-bold text-[#152116]">{t('admin.dashboard.activityTitle')}</p>
              <p className="mt-1 text-sm text-[#6f796c]">{t('admin.dashboard.activitySubtitle')}</p>
            </div>
            <Link href="/admin/avis" className="text-sm font-semibold text-[#1f5a3a] hover:text-[#0f2418]">
              {t('admin.dashboard.viewAll')}
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {activityFeed.length > 0 ? (
              activityFeed.slice(0, 5).map((item: any, index: number) => (
                <ActivityRow key={`${item.at}-${index}`} item={item} />
              ))
            ) : (
              <EmptyState label={t('admin.dashboard.emptyActivity')} />
            )}
          </div>
        </SoftPanel>
      </section>
    </div>
  )
}

function SoftPanel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-[28px] border border-[#e3e7df] bg-white shadow-[0_18px_45px_rgba(15,36,24,0.05)] ${className}`}>
      {children}
    </div>
  )
}

function ToolbarButton({ children, onClick, disabled = false }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 rounded-full border border-[#dfe5db] bg-white px-4 py-2.5 text-sm font-semibold text-[#2b382b] shadow-[0_8px_20px_rgba(15,36,24,0.05)] transition hover:bg-[#edf2ea] disabled:cursor-not-allowed disabled:opacity-70"
    >
      {children}
    </button>
  )
}

  function HeroCard({ heroValue, heroTrend, secondary = [] }: { heroValue?: number; heroTrend?: number; secondary?: { label: string; value: number }[] }) {
    const { t } = useTranslation()
  return (
    <SoftPanel className="overflow-hidden bg-[linear-gradient(135deg,#09170f_0%,#0f2418_60%,#183626_100%)] p-5 text-white sm:p-6">
      <div className="flex h-full flex-col justify-between gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-white/70">{t('admin.dashboard.heroLabel')}</p>
            <p className="mt-3 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
              {formatNumber(heroValue)}
            </p>
            <p className="mt-2 max-w-md text-sm text-white/70">
              {t('admin.dashboard.heroDescription')}
            </p>
          </div>
          <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs font-semibold text-[#8de38d]">
            {t('admin.dashboard.heroTrend', { delta: formatDelta(heroTrend, t) })}
          </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {secondary?.map((item) => (
            <div key={item.label} className="rounded-[22px] border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.2em] text-white/55">{item.label}</p>
              <p className="mt-2 text-2xl font-bold text-white">{formatNumber(item.value)}</p>
            </div>
          ))}
        </div>
      </div>
    </SoftPanel>
  )
}

function SummaryCard({ label, value, delta, tone }: { label: string; value?: number; delta?: number; tone?: string }) {
  const { t } = useTranslation()
  const toneClasses = {
    green: {
      dot: 'bg-[#b7efc3]',
      text: 'text-[#2f6b45]',
      pill: 'bg-[#e7f5ea]',
    },
    rose: {
      dot: 'bg-[#ffd7d7]',
      text: 'text-[#b96b6b]',
      pill: 'bg-[#fff2f2]',
    },
    lime: {
      dot: 'bg-[#d7efbf]',
      text: 'text-[#52713f]',
      pill: 'bg-[#f1f8eb]',
    },
  }

  const ui = toneClasses[tone as keyof typeof toneClasses] || toneClasses.green

  return (
    <SoftPanel className="p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-[#334033]">
        <span className={`h-2.5 w-2.5 rounded-full ${ui.dot}`} />
        {label}
      </div>
      <p className="mt-4 font-display text-3xl font-extrabold tracking-tight text-[#152116]">
        {formatNumber(value)}
      </p>
      <div className="mt-4">
        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${ui.pill} ${ui.text}`}>
          {formatDelta(delta, t)}
        </span>
      </div>
    </SoftPanel>
  )
}

function InsightCard({ alert }: { alert?: any }) {
  const { t } = useTranslation()
  const href = alert?.href || '/admin/medecins'
  const message = alert?.message || t('admin.dashboard.insightStableMessage')
  const count = alert?.count ?? 0

  return (
    <div className="rounded-[28px] bg-[linear-gradient(135deg,#09170f_0%,#0f2418_55%,#132c1f_100%)] p-5 text-white shadow-[0_18px_45px_rgba(15,36,24,0.16)] sm:p-6">
      <div className="flex items-center gap-2 text-sm font-semibold text-white/70">
        <Sparkles className="h-4 w-4 text-[#8ee18f]" />
        {t('admin.dashboard.insightLabel')}
      </div>
      <p className="mt-4 text-2xl font-bold leading-tight">
        {message}
      </p>
      <p className="mt-3 text-sm text-white/70">
        {count > 0 ? t('admin.dashboard.insightCount', { count: formatNumber(count) }) : t('admin.dashboard.insightNoAlert')}
      </p>
      <Link
        href={href}
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#57c66b] px-4 py-3 text-sm font-semibold text-[#0f2418] transition hover:bg-[#6cda80]"
      >
        {t('admin.dashboard.viewSuggestions')}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  )
}

function QuickActionCard({ href, label, description, icon: Icon }: { href: string; label: string; description: string; icon: any }) {
  return (
    <Link
      href={href}
      className="rounded-[22px] border border-[#e4e8df] bg-[#f8faf6] p-4 transition hover:-translate-y-0.5 hover:border-[#cfd7cb] hover:bg-white"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#1f5a3a] shadow-[0_8px_18px_rgba(15,36,24,0.06)]">
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-4 text-sm font-bold text-[#162117]">{label}</p>
      <p className="mt-1 text-xs leading-5 text-[#727d70]">{description}</p>
    </Link>
  )
}

function RecommendationCard({ title, description, href, icon: Icon }: { title: string; description: string; href: string; icon: any }) {
  const { t } = useTranslation()
  return (
    <Link
      href={href}
      className="group rounded-[24px] border border-[#e5e9e1] bg-[#fbfcfa] p-4 transition hover:-translate-y-0.5 hover:border-[#d3dacf] hover:bg-white"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eef4eb] text-[#1f5a3a]">
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-4 text-lg font-bold text-[#152116]">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[#707b6d]">{description}</p>
      <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#1f5a3a]">
        {t('admin.dashboard.open')}
        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
      </div>
    </Link>
  )
}

function ActivityRow({ item }: { item: any }) {
  const { t, i18n } = useTranslation()
  const iconMap = {
    consultation: MessageSquare,
    medecin_inscription: Stethoscope,
    avis: Star,
  }
  const Icon = iconMap[item.type as keyof typeof iconMap] || AlertTriangle

  return (
    <div className="flex items-start gap-3 rounded-[22px] border border-[#ebeee8] bg-[#fafbf8] p-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[#1f5a3a] shadow-[0_8px_18px_rgba(15,36,24,0.05)]">
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[#182417]">{item.message}</p>
        <p className="mt-1 text-xs text-[#768172]">{formatDateTime(item.at, i18n.language) ?? t('admin.dashboard.dateUnavailable')}</p>
      </div>
    </div>
  )
}

function LegendRow({ color, label, value, share }: { color: string; label: string; value?: number; share?: number }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[18px] border border-[#e8ece4] bg-white px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
        <span className="truncate text-sm font-medium text-[#263225]">{label}</span>
      </div>
      <div className="flex items-center gap-4 text-sm">
        <span className="font-semibold text-[#152116]">{formatNumber(value)}</span>
        <span className="text-[#7a8477]">{share}%</span>
      </div>
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-[22px] border border-dashed border-[#dbe1d8] bg-[#f8faf6] px-4 py-10 text-center text-sm text-[#7a8578]">
      {label}
    </div>
  )
}

function formatNumber(value: any) {
  return new Intl.NumberFormat('fr-FR').format(Number(value || 0))
}

function formatDelta(value: any, t: any) {
  if (value === null || value === undefined) return t('admin.dashboard.stable')
  const amount = Math.abs(Number(value))
  const sign = Number(value) > 0 ? '+' : Number(value) < 0 ? '-' : ''
  return `${sign}${amount}%`
}

function formatDateTime(value: any, lang?: string) {
  if (!value) return null
  return new Date(value).toLocaleString(lang?.startsWith('en') ? 'en-US' : 'fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}
