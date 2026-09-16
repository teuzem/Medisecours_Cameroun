'use client'

import { AlertCircle, Clock, Ban, Activity } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { DashboardAlerts as Alerts } from '../../../types/api'

export default function DashboardAlerts({ alerts: data }: { alerts?: Alerts }) {
  const { t } = useTranslation()
  const alerts = data ?? { enAttenteLongue: 0, enCoursLongue: 0, urgentes: 0 }

  const items = [
    {
      labelKey: 'medecin.dashboard.alerts.waiting48h',
      descKey: 'medecin.dashboard.alerts.waiting48hDesc',
      value: alerts.enAttenteLongue,
      icon: Clock,
      color: '#EF4444',
      bg: '#FEF2F2',
    },
    {
      labelKey: 'medecin.dashboard.alerts.longOngoing',
      descKey: 'medecin.dashboard.alerts.longOngoingDesc',
      value: alerts.enCoursLongue,
      icon: AlertCircle,
      color: '#F59E0B',
      bg: '#FFFBEB',
    },
    {
      labelKey: 'medecin.dashboard.alerts.toHandle',
      descKey: 'medecin.dashboard.alerts.toHandleDesc',
      value: alerts.urgentes,
      icon: Activity,
      color: '#3B6EF8',
      bg: '#EFF6FF',
    },
  ]

  const totalAlerts = alerts.enAttenteLongue + alerts.enCoursLongue

  return (
    <div className="rounded-2xl bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-[#0F2C52]">{t('medecin.dashboard.alerts.title')}</h3>
          <p className="text-xs text-[#6B7280]">{t('medecin.dashboard.alerts.subtitle')}</p>
        </div>
        {totalAlerts > 0 && (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-100 text-[10px] font-bold text-red-600">
            {totalAlerts}
          </span>
        )}
      </div>

      <div className="space-y-2.5">
        {items.map((item) => (
          <div key={item.labelKey} className="flex items-center gap-3 rounded-xl p-3" style={{ backgroundColor: item.bg }}>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: item.color + '20' }}>
              <item.icon className="h-4 w-4" style={{ color: item.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[#374151]">{t(item.labelKey)}</p>
              <p className="text-[10px] text-[#6B7280] truncate">{t(item.descKey)}</p>
            </div>
            <span className="text-lg font-bold" style={{ color: item.color }}>{item.value}</span>
          </div>
        ))}
      </div>

      {totalAlerts === 0 && (
        <div className="flex items-center gap-2 justify-center py-6 text-sm text-[#10B981]">
          <Ban className="h-4 w-4" /> {t('medecin.dashboard.alerts.none')}
        </div>
      )}
    </div>
  )
}
