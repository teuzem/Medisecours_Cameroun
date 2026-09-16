'use client'

import { useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useTranslation } from 'react-i18next'
import type { DashboardTimelinePoint } from '../../../types/api'

type Range = 7 | 14 | 30

/**
 * Activité des consultations sur 7/14/30 jours.
 *
 * Données : agrégat SQL backend (clé `timeline`), série complète sur 30j.
 * L'utilisateur peut resserrer l'affichage à 7/14j localement (les données
 * sont déjà chargées sur 30j, on filtre côté client — zéro appel réseau).
 */
export default function DashboardTimeline({ timeline }: { timeline?: DashboardTimelinePoint[] }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'en' ? 'en-GB' : 'fr-FR'
  const [range, setRange] = useState<Range>(7)

  const data = useMemo(() => {
    const full = Array.isArray(timeline) ? timeline : []
    // On garde la fin de la série (jours les plus récents).
    const sliced = full.slice(-range)
    return sliced.map((p) => ({
      date: new Date(p.date).toLocaleDateString(locale, { day: '2-digit', month: 'short' }),
      consultations: p.count,
    }))
  }, [timeline, range, locale])

  const isEmpty = data.length === 0 || data.every((d) => d.consultations === 0)

  if (isEmpty) {
    return (
      <div className="rounded-2xl bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
        <h3 className="text-sm font-bold text-[#0F2C52] mb-1">{t('medecin.dashboard.timeline.title')}</h3>
        <div className="flex h-[240px] items-center justify-center">
          <p className="text-sm text-[#9CA3AF]">{t('medecin.dashboard.timeline.noData')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-[#0F2C52]">{t('medecin.dashboard.timeline.title')}</h3>
          <p className="text-xs text-[#6B7280]">{t('medecin.dashboard.timeline.subtitle')}</p>
        </div>
        <div className="flex gap-1">
          {([7, 14, 30] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition ${
                range === r ? 'bg-[#3B6EF8] text-white' : 'bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB]'
              }`}
            >
              {r}j
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} barCategoryGap={4} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{ borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 12 }}
            labelStyle={{ fontWeight: 600 }}
          />
          <Bar dataKey="consultations" name={t('medecin.dashboard.timeline.consultations')} fill="#3B6EF8" radius={[4, 4, 0, 0]} maxBarSize={16} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
