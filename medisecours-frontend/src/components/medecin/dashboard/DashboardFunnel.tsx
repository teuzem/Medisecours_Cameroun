'use client'

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { DashboardStatusCounts, StatutConsultation } from '../../../types/api'
import { STATUT_CONSULTATION } from '../../../types/api'

const STATUS_ORDER: StatutConsultation[] = [
  STATUT_CONSULTATION.OUVERTE,
  STATUT_CONSULTATION.EN_COURS,
  STATUT_CONSULTATION.TERMINEE,
  STATUT_CONSULTATION.ANNULEE,
]

const STATUS_CONFIG: Record<string, { labelKey: string; color: string }> = {
  OUVERTE: { labelKey: 'medecin.dashboard.status.open', color: '#3B6EF8' },
  EN_COURS: { labelKey: 'medecin.dashboard.status.inProgress', color: '#F59E0B' },
  TERMINEE: { labelKey: 'medecin.dashboard.status.finished', color: '#10B981' },
  ANNULEE: { labelKey: 'medecin.dashboard.status.cancelled', color: '#EF4444' },
}

/**
 * Répartition des consultations par statut.
 *
 * Les données proviennent de l'agrégat SQL backend (`statusCounts`)
 * et reflètent l'ensemble de l'historique du médecin — pas un échantillon.
 */
export default function DashboardFunnel({ statusCounts }: { statusCounts?: DashboardStatusCounts }) {
  const { t } = useTranslation()

  const chartData = useMemo(() => {
    const counts = statusCounts ?? {
      [STATUT_CONSULTATION.OUVERTE]: 0,
      [STATUT_CONSULTATION.EN_COURS]: 0,
      [STATUT_CONSULTATION.TERMINEE]: 0,
      [STATUT_CONSULTATION.ANNULEE]: 0,
    }

    const total = Object.values(counts).reduce((s, v) => s + v, 0) || 1

    return STATUS_ORDER.map((key) => ({
      name: t(STATUS_CONFIG[key]?.labelKey ?? key),
      value: counts[key] ?? 0,
      pct: +(((counts[key] ?? 0) / total) * 100).toFixed(1),
      fill: STATUS_CONFIG[key]?.color ?? '#9CA3AF',
    }))
  }, [statusCounts, t])

  const total = chartData.reduce((s, d) => s + d.value, 0)

  if (total === 0) {
    return (
      <div className="rounded-2xl bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
        <h3 className="text-sm font-bold text-[#0F2C52] mb-1">{t('medecin.dashboard.funnel.title')}</h3>
        <div className="flex h-[240px] items-center justify-center">
          <p className="text-sm text-[#9CA3AF]">{t('medecin.dashboard.funnel.noData')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
      <h3 className="text-sm font-bold text-[#0F2C52] mb-1">{t('medecin.dashboard.funnel.title')}</h3>
      <p className="text-xs text-[#6B7280] mb-4">{t('medecin.dashboard.funnel.total', { count: total })}</p>

      <div className="space-y-2">
        {chartData.map((d) => (
          <div key={d.name}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-medium text-[#374151]">{d.name}</span>
              <span className="font-bold text-[#0F2C52]">{d.value} ({d.pct}%)</span>
            </div>
            <div className="h-2 w-full rounded-full bg-[#F3F4F6]">
              <div className="h-2 rounded-full transition-all" style={{ width: `${d.pct}%`, backgroundColor: d.fill }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
