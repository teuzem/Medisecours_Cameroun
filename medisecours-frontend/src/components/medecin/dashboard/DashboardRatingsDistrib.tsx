'use client'

import { Star } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const RATING_COLORS = ['#EF4444', '#F97316', '#F59E0B', '#22C55E', '#10B981']

export default function DashboardRatingsDistrib({
  ratingsDistribution,
  totalAvis,
  noteMoyenne = 0,
}: {
  ratingsDistribution: Record<number, number>
  totalAvis: number
  noteMoyenne?: number
}) {
  const { t } = useTranslation()
  const counts = [
    ratingsDistribution[1] || 0,
    ratingsDistribution[2] || 0,
    ratingsDistribution[3] || 0,
    ratingsDistribution[4] || 0,
    ratingsDistribution[5] || 0,
  ]
  const total = totalAvis || 0
  const distrib = counts
    .map((count, i) => ({
      stars: i + 1,
      count,
      pct: total > 0 ? +((count / total) * 100).toFixed(0) : 0,
      color: RATING_COLORS[i],
    }))
    .reverse()

  if (total === 0) {
    return (
      <div className="rounded-2xl bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
        <h3 className="text-sm font-bold text-[#0F2C52] mb-1">{t('medecin.dashboard.ratings.title')}</h3>
        <div className="flex h-[200px] items-center justify-center"><p className="text-sm text-[#9CA3AF]">{t('medecin.dashboard.ratings.noReviews')}</p></div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-bold text-[#0F2C52]">{t('medecin.dashboard.ratings.title')}</h3>
        {noteMoyenne > 0 && (
          <div className="flex items-center gap-1">
            <Star className="h-3.5 w-3.5 text-amber-400" fill="currentColor" />
            <span className="text-sm font-bold text-[#0F2C52]">{noteMoyenne}</span>
            <span className="text-[11px] text-[#9CA3AF]">/5</span>
          </div>
        )}
      </div>
      <p className="text-xs text-[#6B7280] mb-3">{t('medecin.dashboard.ratings.received', { count: total })}</p>

      <div className="space-y-2">
        {distrib.map((d) => (
          <div key={d.stars} className="flex items-center gap-2 text-xs">
            <div className="flex w-12 items-center gap-1 font-medium text-[#374151]">
              <Star className="h-3 w-3 text-amber-400" fill="currentColor" />
              {d.stars}
            </div>
            <div className="flex-1 h-2 rounded-full bg-[#F3F4F6]">
              <div className="h-2 rounded-full transition-all" style={{ width: `${d.pct}%`, backgroundColor: d.color }} />
            </div>
            <span className="w-8 text-right font-semibold text-[#0F2C52]">{d.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}