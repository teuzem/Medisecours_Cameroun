// @ts-nocheck
'use client'

import { useTranslation } from 'react-i18next'
import { Pill, Clock } from 'lucide-react'
import EmptyState from '../../../components/ui/EmptyState'

export default function PharmacyPage() {
  const { t } = useTranslation()
  return (
    <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
      <div className="text-center max-w-sm">
        <EmptyState
          icon={Pill}
          title={t('medecin.pharmacy.title')}
          description={t('medecin.pharmacy.description')}
        />
        <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
          <Clock className="w-3.5 h-3.5" /> {t('medecin.pharmacy.soon')}
        </div>
      </div>
    </div>
  )
}
