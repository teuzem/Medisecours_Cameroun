'use client'

import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { FlaskConical } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { DashboardAllergie } from '../../../types/api'

const BLOOD_COLORS: Record<string, string> = {
  'A+': '#3B6EF8',
  'A-': '#6B8FF8',
  'B+': '#F59E0B',
  'B-': '#F0B84D',
  'AB+': '#10B981',
  'AB-': '#34D399',
  'O+': '#EF4444',
  'O-': '#F87171',
}

export default function DashboardBloodAllergies({
  bloodDistribution,
  allergies,
}: {
  bloodDistribution: Record<string, number>
  allergies?: DashboardAllergie[]
}) {
  const { t } = useTranslation()
  const bloodData = Object.entries(bloodDistribution)
    .map(([name, value]) => ({ name, value, color: BLOOD_COLORS[name] || '#9CA3AF' }))
    .sort((a, b) => b.value - a.value)

  const hasBloodData = bloodData.length > 0
  const hasAllergies = allergies && allergies.length > 0
  const hasAny = hasBloodData || hasAllergies

  if (!hasAny) {
    return (
      <div className="rounded-2xl bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
        <h3 className="text-sm font-bold text-[#0F2C52] mb-1">{t('medecin.dashboard.blood.patients')}</h3>
        <div className="flex h-[200px] items-center justify-center">
          <p className="text-sm text-[#9CA3AF]">{t('medecin.dashboard.blood.noPatientData')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
      <h3 className="text-sm font-bold text-[#0F2C52] mb-1">{t('medecin.dashboard.blood.patients')}</h3>
      <p className="text-xs text-[#6B7280] mb-3">{t('medecin.dashboard.blood.subtitle')}</p>

      {hasBloodData && (
        <>
          <ResponsiveContainer width="100%" height={130}>
            <PieChart>
              <Pie
                data={bloodData}
                cx="50%"
                cy="50%"
                innerRadius={35}
                outerRadius={55}
                paddingAngle={2}
                dataKey="value"
                stroke="none"
              >
                {bloodData.map((e, i) => (
                  <Cell key={i} fill={e.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-1.5 mb-3">
            {bloodData.map((b) => (
              <div key={b.name} className="flex items-center justify-between text-[10px]">
                <span className="flex items-center gap-1 text-[#374151]">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: b.color }} />
                  {b.name}
                </span>
                <span className="font-semibold text-[#0F2C52]">{b.value}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {hasAllergies && (
        <div>
          <p className="flex items-center gap-1 text-[10px] font-semibold text-[#6B7280] mb-1.5">
            <FlaskConical className="h-3 w-3" /> {t('medecin.dashboard.blood.frequentAllergies')}
          </p>
          <div className="flex flex-wrap gap-1">
            {allergies!.slice(0, 4).map((a) => (
              <span
                key={a.name}
                className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700"
                title={t('medecin.dashboard.blood.patientCount', { count: a.count })}
              >
                {a.name}
                <span className="text-[9px] text-amber-500">{a.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
