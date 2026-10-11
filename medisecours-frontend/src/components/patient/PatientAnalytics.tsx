'use client'

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import useSWR from 'swr'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
  BarChart, Bar,
} from 'recharts'
import { Activity, CalendarCheck, HeartPulse, Pill, TrendingUp, TrendingDown } from 'lucide-react'
import api from '../../api/axios'
import { PATIENT_DASHBOARD_KEY } from '../../lib/keys'
import type { PatientDashboardData } from '../../types/api'

const STATUS_COLORS: Record<string, string> = {
  OUVERTE: '#1E3A5F',
  EN_COURS: '#F59E0B',
  TERMINEE: '#10B981',
  ANNULEE: '#EF4444',
}

const STATUS_LABEL_KEYS: Record<string, string> = {
  OUVERTE: 'consultations.pending',
  EN_COURS: 'consultations.inProgress',
  TERMINEE: 'consultations.finished',
  ANNULEE: 'consultations.cancelled',
}

const PERIODS = [7, 30, 90, 365] as const
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]
const WEEKDAY_LABEL_KEYS = [
  'patient.analytics.dayShort.0',
  'patient.analytics.dayShort.1',
  'patient.analytics.dayShort.2',
  'patient.analytics.dayShort.3',
  'patient.analytics.dayShort.4',
  'patient.analytics.dayShort.5',
  'patient.analytics.dayShort.6',
]

async function fetcher(url: string): Promise<PatientDashboardData> {
  const { data } = await api.get(url)
  return data as PatientDashboardData
}

export default function PatientAnalytics() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'en' ? 'en-GB' : 'fr-FR'
  const [period, setPeriod] = useState(30)

  const { data } = useSWR<PatientDashboardData>(
    `${PATIENT_DASHBOARD_KEY}?period=${period}`,
    fetcher,
    { revalidateOnFocus: false, keepPreviousData: true },
  )

  const timelineData = useMemo(
    () =>
      (data?.timeline ?? []).map((p) => ({
        date: new Date(p.date).toLocaleDateString(locale, { day: '2-digit', month: 'short' }),
        consultations: p.count,
      })),
    [data, locale],
  )

  const statusData = useMemo(() => {
    const counts = data?.statusCounts ?? {}
    return Object.keys(counts)
      .map((key) => ({
        name: t(STATUS_LABEL_KEYS[key] || key),
        value: counts[key] || 0,
        color: STATUS_COLORS[key] || '#9CA3AF',
      }))
      .filter((item) => item.value > 0)
  }, [data, t])

  const weekdayData = useMemo(() => {
    const dist = data?.weekdayDistribution ?? []
    return WEEKDAY_ORDER.map((dow) => ({
      jour: t(WEEKDAY_LABEL_KEYS[dow] || String(dow)),
      count: dist[dow] ?? 0,
    }))
  }, [data, t])

  const etablissementData = useMemo(
    () => (data?.etablissementBreakdown ?? []).map((item) => ({ nom: item.nom, count: item.count })),
    [data],
  )

  const croissance = data?.comparaison?.croissancePourcent ?? null
  const kpis = data?.kpis

  return (
    <section aria-label={t('patient.analytics.title')} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-primary-900 dark:text-white">{t('patient.analytics.title')}</h2>
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900" role="group" aria-label={t('patient.analytics.periodLabel')}>
          {PERIODS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setPeriod(value)}
              aria-pressed={period === value}
              className={`min-h-8 rounded-lg px-2.5 text-[11px] font-bold transition ${
                period === value
                  ? 'bg-primary-900 text-white'
                  : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {t('patient.analytics.periodDays', { count: value })}
            </button>
          ))}
        </div>
      </div>

      {data && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { icon: Activity, label: t('patient.analytics.kpiConsultations'), value: kpis?.consultations ?? 0 },
            { icon: CalendarCheck, label: t('patient.analytics.kpiPeriod'), value: kpis?.consultationsPeriode ?? 0 },
            { icon: Pill, label: t('patient.analytics.kpiPrescriptions'), value: kpis?.prescriptionsActives ?? 0 },
            { icon: HeartPulse, label: t('patient.analytics.kpiFavorites'), value: kpis?.favoris ?? 0 },
          ].map((kpi) => (
            <div key={kpi.label} className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.04em] text-slate-400">
                <kpi.icon className="h-3.5 w-3.5" />
                {kpi.label}
              </p>
              <p className="mt-1 text-2xl font-bold text-primary-900 dark:text-white">{kpi.value}</p>
            </div>
          ))}
        </div>
      )}

      {croissance !== null && (
        <div className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold ${
          croissance >= 0
            ? 'border-mint-200 bg-mint-50 text-mint-700 dark:border-mint-900 dark:bg-mint-950/40 dark:text-mint-400'
            : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-400'
        }`}>
          {croissance >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
          {croissance >= 0
            ? t('patient.analytics.growthUp', { value: Math.abs(croissance) })
            : t('patient.analytics.growthDown', { value: Math.abs(croissance) })}
        </div>
      )}

      {data && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[60%_40%]">
          <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <p className="text-xs font-bold text-primary-900 dark:text-white">{t('patient.analytics.timelineTitle')}</p>
            <div className="mt-3 h-[200px] w-full">
              {timelineData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timelineData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="patientConsults" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1E3A5F" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#1E3A5F" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} minTickGap={24} dy={8} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} allowDecimals={false} />
                    <RechartsTooltip contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }} />
                    <Area type="monotone" dataKey="consultations" name={t('patient.analytics.consultationsLabel')} stroke="#1E3A5F" strokeWidth={2.5} fillOpacity={1} fill="url(#patientConsults)" animationDuration={1200} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-400">{t('patient.analytics.noData')}</div>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <p className="text-xs font-bold text-primary-900 dark:text-white">{t('patient.analytics.statusTitle')}</p>
            <div className="mt-3 h-[200px] w-full relative">
              {statusData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusData} cx="50%" cy="50%" innerRadius={48} outerRadius={76} paddingAngle={5} dataKey="value" animationDuration={1200}>
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-400">{t('patient.analytics.noData')}</div>
              )}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none">
                <span className="text-xl font-bold text-primary-900 dark:text-white">{statusData.reduce((a, c) => a + c.value, 0)}</span>
                <span className="text-[10px] text-slate-500">{t('patient.analytics.totalLabel')}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {data && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <p className="text-xs font-bold text-primary-900 dark:text-white">{t('patient.analytics.weekdayTitle')}</p>
            <div className="mt-3 h-[180px] w-full">
              {weekdayData.some((d) => d.count > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weekdayData} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                    <XAxis dataKey="jour" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} allowDecimals={false} />
                    <RechartsTooltip cursor={{ fill: '#F3F4F6' }} contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }} />
                    <Bar dataKey="count" name={t('patient.analytics.consultationsLabel')} fill="#10B981" radius={[3, 3, 0, 0]} maxBarSize={32} animationDuration={1200} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-400">{t('patient.analytics.noData')}</div>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <p className="text-xs font-bold text-primary-900 dark:text-white">{t('patient.analytics.etablissementTitle')}</p>
            <div className="mt-3 h-[180px] w-full">
              {etablissementData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={etablissementData} layout="vertical" margin={{ top: 5, right: 16, left: 4, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F3F4F6" />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} allowDecimals={false} />
                    <YAxis type="category" dataKey="nom" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B7280' }} width={110} />
                    <RechartsTooltip cursor={{ fill: '#F3F4F6' }} contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }} />
                    <Bar dataKey="count" name={t('patient.analytics.consultationsLabel')} fill="#1E3A5F" radius={[0, 3, 3, 0]} maxBarSize={18} animationDuration={1200} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-400">{t('patient.analytics.noData')}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
