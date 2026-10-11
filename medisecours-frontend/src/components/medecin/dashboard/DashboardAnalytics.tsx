'use client'

import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar,
} from 'recharts'
import { Download, TrendingUp, TrendingDown, Lightbulb } from 'lucide-react'
import type { DashboardData, StatutConsultation } from '../../../types/api'

const STATUS_COLORS: Record<string, string> = {
  OUVERTE: 'var(--dashboard-accent, #1E3A5F)',
  EN_COURS: '#F59E0B',
  TERMINEE: '#10B981',
  ANNULEE: '#EF4444',
}

const STATUS_LABEL_KEYS: Record<string, string> = {
  OUVERTE: 'medecin.dashboard.status.open',
  EN_COURS: 'medecin.dashboard.status.inProgress',
  TERMINEE: 'medecin.dashboard.status.finished',
  ANNULEE: 'medecin.dashboard.status.cancelled',
}

const PRESCRIPTION_STATUS_LABEL_KEYS: Record<string, string> = {
  BROUILLON: 'medecin.dashboard.prescriptions.draft',
  SIGNEE: 'medecin.dashboard.prescriptions.signed',
  TRANSMISE: 'medecin.dashboard.prescriptions.sent',
  ANNULEE: 'medecin.dashboard.prescriptions.cancelled',
  EXPIREE: 'medecin.dashboard.prescriptions.expired',
  REMPLACEE: 'medecin.dashboard.prescriptions.replaced',
}

const PERIODS = [7, 30, 90, 365] as const

/** DOW Postgres : 0 = dimanche … 6 = samedi → affichage lundi → dimanche. */
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]
const WEEKDAY_LABEL_KEYS = [
  'medecin.dayShort.dimanche',
  'medecin.dayShort.lundi',
  'medecin.dayShort.mardi',
  'medecin.dayShort.mercredi',
  'medecin.dayShort.jeudi',
  'medecin.dayShort.vendredi',
  'medecin.dayShort.samedi',
]

function buildCsv(rows: string[][]): string {
  return rows
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(';'))
    .join('\n')
}

function downloadCsv(content: string, fileName: string) {
  const blob = new Blob([`﻿${content}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export default function DashboardAnalytics({
  data,
  period,
  onPeriodChange,
}: {
  data: DashboardData | undefined
  period: number
  onPeriodChange: (period: number) => void
}) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'en' ? 'en-GB' : 'fr-FR'
  const [exporting, setExporting] = useState(false)

  const timelineData = useMemo(() => {
    const full = Array.isArray(data?.timeline) ? data!.timeline! : []
    return full.map((p) => ({
      date: new Date(p.date).toLocaleDateString(locale, { day: '2-digit', month: 'short' }),
      consultations: p.count,
    }))
  }, [data, locale])

  const statusData = useMemo(() => {
    const counts = data?.statusCounts ?? {}
    return Object.keys(counts).map((key) => ({
      name: t(STATUS_LABEL_KEYS[key] || key),
      value: counts[key as StatutConsultation] || 0,
      color: STATUS_COLORS[key] || '#9CA3AF',
    })).filter((item) => item.value > 0)
  }, [data, t])

  const bloodData = useMemo(() => {
    const dist = data?.bloodDistribution ?? {}
    return Object.keys(dist).map((key) => ({ groupe: key, patients: dist[key] }))
  }, [data])

  const ratingsData = useMemo(() => {
    const dist = data?.ratingsDistribution ?? {}
    return [1, 2, 3, 4, 5].map((star) => ({ etoiles: `${star} ⭐`, avis: dist[star] || 0 }))
  }, [data])

  const hourlyData = useMemo(() => {
    const dist = data?.hourlyDistribution ?? []
    return dist.map((count, hour) => ({
      heure: `${String(hour).padStart(2, '0')}h`,
      count,
    }))
  }, [data])

  const weekdayData = useMemo(() => {
    const dist = data?.weekdayDistribution ?? []
    return WEEKDAY_ORDER.map((dow) => ({
      jour: t(WEEKDAY_LABEL_KEYS[dow] || String(dow)),
      count: dist[dow] ?? 0,
    }))
  }, [data, t])

  const prescriptionData = useMemo(() => {
    const counts = data?.prescriptionsByStatut ?? {}
    return Object.keys(counts)
      .map((statut) => ({
        statut: t(PRESCRIPTION_STATUS_LABEL_KEYS[statut] || statut),
        count: counts[statut] || 0,
      }))
      .filter((item) => item.count > 0)
  }, [data, t])

  const etablissementData = useMemo(
    () => (data?.etablissementBreakdown ?? []).map((item) => ({ nom: item.nom, count: item.count })),
    [data],
  )

  const kpisPeriode = data?.kpisPeriode
  const comparaison = data?.comparaison
  const croissance = comparaison?.croissancePourcent ?? null

  const insights = useMemo(() => {
    const items: string[] = []
    const peakHour = hourlyData.reduce<{ heure: string; count: number } | null>(
      (best, item) => (best === null || item.count > best.count ? item : best),
      null,
    )
    if (peakHour && peakHour.count > 0) {
      items.push(t('medecin.dashboard.analytics.insightPeakHour', { hour: peakHour.heure, count: peakHour.count }))
    }
    const peakDay = weekdayData.reduce<{ jour: string; count: number } | null>(
      (best, item) => (best === null || item.count > best.count ? item : best),
      null,
    )
    if (peakDay && peakDay.count > 0) {
      items.push(t('medecin.dashboard.analytics.insightPeakDay', { day: peakDay.jour, count: peakDay.count }))
    }
    const topCentre = etablissementData[0]
    if (topCentre && topCentre.count > 0) {
      items.push(t('medecin.dashboard.analytics.insightTopCentre', { name: topCentre.nom, count: topCentre.count }))
    }
    if (croissance !== null) {
      items.push(
        croissance >= 0
          ? t('medecin.dashboard.analytics.insightGrowthUp', { value: Math.abs(croissance) })
          : t('medecin.dashboard.analytics.insightGrowthDown', { value: Math.abs(croissance) }),
      )
    }
    return items
  }, [hourlyData, weekdayData, etablissementData, croissance, t])

  const exportCsv = () => {
    if (!data || exporting) return
    setExporting(true)
    try {
      const rows: string[][] = [[t('medecin.dashboard.analytics.csvMetric'), t('medecin.dashboard.analytics.csvValue')]]
      rows.push([t('medecin.dashboard.analytics.consultations'), String(kpisPeriode?.consultations ?? 0)])
      rows.push([t('medecin.dashboard.status.finished'), String(kpisPeriode?.terminees ?? 0)])
      rows.push([t('medecin.dashboard.analytics.newPrescriptions'), String(kpisPeriode?.nouvellesPrescriptions ?? 0)])
      rows.push([t('medecin.dashboard.analytics.distinctPatients'), String(kpisPeriode?.patientsDistinct ?? 0)])
      rows.push([])
      rows.push([t('medecin.dashboard.analytics.hourLabel'), t('medecin.dashboard.analytics.consultations')])
      hourlyData.forEach((item) => rows.push([item.heure, String(item.count)]))
      rows.push([])
      rows.push([t('medecin.dashboard.analytics.weekdayLabel'), t('medecin.dashboard.analytics.consultations')])
      weekdayData.forEach((item) => rows.push([item.jour, String(item.count)]))
      rows.push([])
      rows.push([t('medecin.dashboard.analytics.etablissementLabel'), t('medecin.dashboard.analytics.consultations')])
      etablissementData.forEach((item) => rows.push([item.nom, String(item.count)]))
      downloadCsv(buildCsv(rows), `medisecours-rapport-${period}j.csv`)
    } finally {
      setExporting(false)
    }
  }

  if (!data) return null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900" role="group" aria-label={t('medecin.dashboard.analytics.periodLabel')}>
          {PERIODS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onPeriodChange(value)}
              aria-pressed={period === value}
              className={`min-h-9 rounded-lg px-3 text-xs font-bold transition ${
                period === value
                  ? 'bg-primary-900 text-white'
                  : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {t('medecin.dashboard.analytics.periodDays', { count: value })}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={exportCsv}
          disabled={exporting}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <Download className="h-3.5 w-3.5" />
          {t('medecin.dashboard.analytics.exportCsv')}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: t('medecin.dashboard.analytics.consultations'), value: kpisPeriode?.consultations ?? 0 },
          { label: t('medecin.dashboard.status.finished'), value: kpisPeriode?.terminees ?? 0 },
          { label: t('medecin.dashboard.analytics.newPrescriptions'), value: kpisPeriode?.nouvellesPrescriptions ?? 0 },
          { label: t('medecin.dashboard.analytics.distinctPatients'), value: kpisPeriode?.patientsDistinct ?? 0 },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <p className="text-[11px] font-bold uppercase tracking-[0.04em] text-slate-400">{kpi.label}</p>
            <p className="mt-1 text-2xl font-bold text-primary-900 dark:text-white">{kpi.value}</p>
          </div>
        ))}
      </div>

      {croissance !== null && (
        <div className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold ${
          croissance >= 0
            ? 'border-mint-200 bg-mint-50 text-mint-700 dark:border-mint-900 dark:bg-mint-950/40 dark:text-mint-400'
            : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-400'
        }`}>
          {croissance >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
          {croissance >= 0
            ? t('medecin.dashboard.analytics.growthUp', { value: Math.abs(croissance) })
            : t('medecin.dashboard.analytics.growthDown', { value: Math.abs(croissance) })}
          <span className="font-medium opacity-80">
            {t('medecin.dashboard.analytics.vsPrevious', { count: period })}
          </span>
        </div>
      )}

      {insights.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.04em] text-slate-400">
            <Lightbulb className="h-3.5 w-3.5" />
            {t('medecin.dashboard.analytics.insights')}
          </p>
          <ul className="mt-2 space-y-1.5">
            {insights.map((insight) => (
              <li key={insight} className="text-xs leading-5 text-slate-600 dark:text-slate-300">{insight}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[60%_40%]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <h3 className="text-sm font-bold text-primary-900 dark:text-white mb-1">{t('medecin.dashboard.analytics.evolution')}</h3>
          <p className="text-xs text-slate-500 mb-6">{t('medecin.dashboard.analytics.evolutionSub', { count: period })}</p>

          <div className="h-[240px] w-full">
            {timelineData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorConsults" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1E3A5F" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#1E3A5F" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} dy={10} minTickGap={24} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} allowDecimals={false} />
                  <RechartsTooltip contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }} />
                  <Area
                    type="monotone"
                    dataKey="consultations"
                    name={t('medecin.dashboard.analytics.consultations')}
                    stroke="#1E3A5F"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorConsults)"
                    animationDuration={1200}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">{t('medecin.dashboard.analytics.noRecentData')}</div>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <h3 className="text-sm font-bold text-primary-900 dark:text-white mb-1">{t('medecin.dashboard.analytics.byStatus')}</h3>
          <p className="text-xs text-slate-500 mb-2">{t('medecin.dashboard.analytics.allConsultations')}</p>

          <div className="h-[240px] w-full relative">
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                    animationDuration={1200}
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">{t('medecin.dashboard.analytics.noData')}</div>
            )}

            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold text-primary-900 dark:text-white">
                {statusData.reduce((acc, curr) => acc + curr.value, 0)}
              </span>
              <span className="text-[10px] text-slate-500">{t('medecin.dashboard.analytics.total')}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <h3 className="text-sm font-bold text-primary-900 dark:text-white mb-1">{t('medecin.dashboard.analytics.hourlyTitle')}</h3>
          <p className="text-xs text-slate-500 mb-4">{t('medecin.dashboard.analytics.hourlySub')}</p>
          <div className="h-[200px] w-full">
            {hourlyData.some((d) => d.count > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyData} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                  <XAxis dataKey="heure" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#9CA3AF' }} interval={2} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} allowDecimals={false} />
                  <RechartsTooltip cursor={{ fill: '#F3F4F6' }} contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }} />
                  <Bar dataKey="count" name={t('medecin.dashboard.analytics.interactions')} fill="#1E3A5F" radius={[3, 3, 0, 0]} maxBarSize={16} animationDuration={1200} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">{t('medecin.dashboard.analytics.noData')}</div>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <h3 className="text-sm font-bold text-primary-900 dark:text-white mb-1">{t('medecin.dashboard.analytics.weekdayTitle')}</h3>
          <p className="text-xs text-slate-500 mb-4">{t('medecin.dashboard.analytics.weekdaySub')}</p>
          <div className="h-[200px] w-full">
            {weekdayData.some((d) => d.count > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weekdayData} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                  <XAxis dataKey="jour" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} allowDecimals={false} />
                  <RechartsTooltip cursor={{ fill: '#F3F4F6' }} contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }} />
                  <Bar dataKey="count" name={t('medecin.dashboard.analytics.consultations')} fill="#10B981" radius={[3, 3, 0, 0]} maxBarSize={36} animationDuration={1200} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">{t('medecin.dashboard.analytics.noData')}</div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <h3 className="text-sm font-bold text-primary-900 dark:text-white mb-1">{t('medecin.dashboard.analytics.prescriptionsTitle')}</h3>
          <p className="text-xs text-slate-500 mb-4">{t('medecin.dashboard.analytics.prescriptionsSub')}</p>
          <div className="h-[200px] w-full">
            {prescriptionData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={prescriptionData} layout="vertical" margin={{ top: 5, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F3F4F6" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} allowDecimals={false} />
                  <YAxis type="category" dataKey="statut" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B7280' }} width={90} />
                  <RechartsTooltip cursor={{ fill: '#F3F4F6' }} contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }} />
                  <Bar dataKey="count" name={t('medecin.dashboard.analytics.prescriptions')} fill="#1E3A5F" radius={[0, 3, 3, 0]} maxBarSize={18} animationDuration={1200} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">{t('medecin.dashboard.analytics.noData')}</div>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <h3 className="text-sm font-bold text-primary-900 dark:text-white mb-1">{t('medecin.dashboard.analytics.etablissementTitle')}</h3>
          <p className="text-xs text-slate-500 mb-4">{t('medecin.dashboard.analytics.etablissementSub')}</p>
          <div className="h-[200px] w-full">
            {etablissementData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={etablissementData} layout="vertical" margin={{ top: 5, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F3F4F6" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} allowDecimals={false} />
                  <YAxis type="category" dataKey="nom" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B7280' }} width={120} />
                  <RechartsTooltip cursor={{ fill: '#F3F4F6' }} contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }} />
                  <Bar dataKey="count" name={t('medecin.dashboard.analytics.consultations')} fill="#F59E0B" radius={[0, 3, 3, 0]} maxBarSize={18} animationDuration={1200} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">{t('medecin.dashboard.analytics.noData')}</div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <h3 className="text-sm font-bold text-primary-900 dark:text-white mb-1">{t('medecin.dashboard.analytics.bloodProfile')}</h3>
          <p className="text-xs text-slate-500 mb-2">{t('medecin.dashboard.analytics.patientsDistribution')}</p>

          <div className="h-[220px] w-full">
            {bloodData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={bloodData}>
                  <PolarGrid stroke="#F3F4F6" />
                  <PolarAngleAxis dataKey="groupe" tick={{ fill: '#1E3A5F', fontSize: 11, fontWeight: 600 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={false} axisLine={false} />
                  <Radar
                    name={t('medecin.dashboard.analytics.patients')}
                    dataKey="patients"
                    stroke="#1E3A5F"
                    strokeWidth={2}
                    fill="#1E3A5F"
                    fillOpacity={0.2}
                    animationDuration={1200}
                  />
                  <RechartsTooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">{t('medecin.dashboard.analytics.noData')}</div>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <h3 className="text-sm font-bold text-primary-900 dark:text-white mb-1">{t('medecin.dashboard.analytics.satisfaction')}</h3>
          <p className="text-xs text-slate-500 mb-4">{t('medecin.dashboard.analytics.reviewsDistribution')}</p>

          <div className="h-[220px] w-full">
            {ratingsData.some((d) => d.avis > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ratingsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                  <XAxis dataKey="etoiles" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280', fontWeight: 500 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} allowDecimals={false} />
                  <RechartsTooltip
                    cursor={{ fill: '#F3F4F6' }}
                    contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }}
                  />
                  <Bar
                    dataKey="avis"
                    name={t('medecin.dashboard.analytics.reviews')}
                    fill="#FBBF24"
                    radius={[3, 3, 0, 0]}
                    maxBarSize={40}
                    animationDuration={1200}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">{t('medecin.dashboard.analytics.noReviews')}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
