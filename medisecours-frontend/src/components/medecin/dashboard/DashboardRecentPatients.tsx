'use client'

import { useRouter } from 'next/navigation'
import { MessageSquare, Stethoscope, Phone } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import Avatar from '../../ui/Avatar'
import { idStrFromRelation } from '../../../types/api'
import type { Patient } from '../../../types/api'

export default function DashboardRecentPatients({ recentPatients }: { recentPatients: Patient[] }) {
  const router = useRouter()
  const { t } = useTranslation()

  const patients = recentPatients || []

  if (patients.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
        <h3 className="text-sm font-bold text-[#0F2C52] mb-1">{t('medecin.dashboard.recent.title')}</h3>
        <div className="flex h-[240px] items-center justify-center"><p className="text-sm text-[#9CA3AF]">{t('medecin.dashboard.recent.noPatients')}</p></div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
      <h3 className="text-sm font-bold text-[#0F2C52] mb-1">{t('medecin.dashboard.recent.title')}</h3>
      <p className="text-xs text-[#6B7280] mb-4">{t('medecin.dashboard.recent.subtitle')}</p>

      <div className="space-y-1">
        {patients.map((p) => {
          const pid = idStrFromRelation(p) || p.id
          return (
            <div
              key={pid}
              className="flex items-center gap-3 rounded-xl p-2.5 transition hover:bg-[#F9FAFB]"
            >
              <Avatar name={`${p.prenom || ''} ${p.nom || ''}`.trim()} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#0F2C52] truncate">
                  {p.prenom} {p.nom}
                </p>
                <p className="text-[11px] text-[#9CA3AF]">
                  {p.telephone ? p.telephone : p.email || '—'}
                </p>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => router.push(`/medecin/consultations?patient=${pid}`)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#EFF6FF] text-[#3B6EF8] hover:bg-[#DBEAFE] transition"
                  title={t('medecin.dashboard.recent.newConsultation')}
                >
                  <Stethoscope className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => router.push(`/medecin/messages?patient=${pid}`)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#ECFDF5] text-[#10B981] hover:bg-[#D1FAE5] transition"
                  title={t('medecin.dashboard.recent.sendMessage')}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                </button>
                {p.telephone && (
                  <a
                    href={`tel:${p.telephone}`}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FFFBEB] text-[#F59E0B] hover:bg-[#FEF3C7] transition"
                    title={t('medecin.dashboard.recent.call')}
                  >
                    <Phone className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
