'use client'

import { useRouter } from 'next/navigation'
import { AlertTriangle, AlertOctagon, AlertCircle, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Consultation } from '../../../types/api'

const PRIORITE_CONFIG = {
  CRITIQUE: { labelKey: 'medecin.dashboard.risk.critical', color: '#EF4444', bg: '#FEF2F2', icon: AlertOctagon },
  URGENTE: { labelKey: 'medecin.dashboard.risk.urgent', color: '#F59E0B', bg: '#FFFBEB', icon: AlertTriangle },
  NORMALE: { labelKey: 'medecin.dashboard.risk.normal', color: '#3B6EF8', bg: '#EFF6FF', icon: AlertCircle },
}

export default function DashboardRiskPatients({ riskConsultations }: { riskConsultations: Consultation[] }) {
  const router = useRouter()
  const { t } = useTranslation()

  const riskItems = riskConsultations || []

  const counts = riskItems.reduce(
    (acc, c) => {
      if (c.priorite === 'CRITIQUE') acc.critiques++
      if (c.priorite === 'URGENTE') acc.urgentes++
      return acc
    },
    { critiques: 0, urgentes: 0 }
  )

  const hasRisk = counts.critiques + counts.urgentes > 0

  return (
    <div className="rounded-2xl bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold text-[#0F2C52]">{t('medecin.dashboard.risk.title')}</h3>
          <p className="text-xs text-[#6B7280]">{t('medecin.dashboard.risk.subtitle')}</p>
        </div>
        {hasRisk && (
          <div className="flex gap-1">
            {counts.critiques > 0 && (
              <span className="flex h-6 items-center gap-1 rounded-full bg-red-100 px-2 text-[10px] font-bold text-red-600">
                <AlertOctagon className="h-3 w-3" /> {counts.critiques}
              </span>
            )}
            {counts.urgentes > 0 && (
              <span className="flex h-6 items-center gap-1 rounded-full bg-amber-100 px-2 text-[10px] font-bold text-amber-600">
                <AlertTriangle className="h-3 w-3" /> {counts.urgentes}
              </span>
            )}
          </div>
        )}
      </div>

      {riskItems.length > 0 ? (
        <div className="space-y-1">
          {riskItems.map((c) => {
            const cfg = PRIORITE_CONFIG[c.priorite as keyof typeof PRIORITE_CONFIG] || PRIORITE_CONFIG.NORMALE
            const Icon = cfg.icon
            return (
              <button
                key={c.id}
                onClick={() => router.push(`/medecin/consultations?id=${c.id}`)}
                className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-[#F9FAFB]"
                style={{ backgroundColor: cfg.bg }}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: cfg.color + '20' }}>
                  <Icon className="h-4 w-4" style={{ color: cfg.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#374151] truncate">
                    {typeof c.patient === 'object' ? `${c.patient?.prenom ?? ''} ${c.patient?.nom ?? ''}` : t('medecin.dashboard.risk.patientFallback')}
                  </p>
                  <p className="text-[11px] text-[#6B7280] truncate">
                    {c.motif || t('medecin.dashboard.risk.noMotif')} · <span style={{ color: cfg.color }} className="font-semibold">{t(cfg.labelKey)}</span>
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-[#D1D5DB]" />
              </button>
            )
          })}
        </div>
      ) : (
        <div className="flex h-[160px] items-center justify-center">
          <div className="text-center">
            <AlertCircle className="mx-auto mb-2 h-8 w-8 text-[#D1D5DB]" />
            <p className="text-sm text-[#9CA3AF]">{t('medecin.dashboard.risk.none')}</p>
          </div>
        </div>
      )}
    </div>
  )
}
