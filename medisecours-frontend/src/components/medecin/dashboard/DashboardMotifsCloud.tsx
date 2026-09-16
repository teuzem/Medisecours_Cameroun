'use client'

import { useTranslation } from 'react-i18next'

export default function DashboardMotifsCloud({ motifsCount }: { motifsCount: { motif: string; count: number }[] }) {
  const { t } = useTranslation()
  if (!motifsCount || motifsCount.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
        <h3 className="text-sm font-bold text-[#0F2C52] mb-1">{t('medecin.dashboard.motifs.title')}</h3>
        <div className="flex h-[200px] items-center justify-center"><p className="text-sm text-[#9CA3AF]">{t('medecin.dashboard.motifs.noData')}</p></div>
      </div>
    )
  }

  const maxCount = motifsCount[0].count
  const minCount = motifsCount[motifsCount.length - 1].count
  const range = maxCount - minCount || 1

  const cloud = motifsCount.map(({ motif: word, count }) => ({
    word,
    count,
    size: 0.65 + ((count - minCount) / range) * 0.85,
  }))

  return (
    <div className="rounded-2xl bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
      <h3 className="text-sm font-bold text-[#0F2C52] mb-1">{t('medecin.dashboard.motifs.title')}</h3>
      <p className="text-xs text-[#6B7280] mb-3">{t('medecin.dashboard.motifs.subtitle')}</p>
      <div className="flex flex-wrap items-center gap-2.5">
        {cloud.map(({ word, count, size }) => (
          <span
            key={word}
            className="inline-block rounded-full bg-[#EFF6FF] px-3 py-1 text-[#3B6EF8] hover:bg-[#DBEAFE] transition cursor-default"
            style={{ fontSize: `${size}rem`, fontWeight: size > 1 ? 700 : 500 }}
            title={t('medecin.dashboard.motifs.count', { count })}
          >
            {word}
            <span className="ml-1 text-[10px] text-[#6B7280]">{count}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
