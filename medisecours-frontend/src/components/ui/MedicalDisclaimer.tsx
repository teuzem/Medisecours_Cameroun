'use client'

import { AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export default function MedicalDisclaimer({ variant = 'inline' }: {
  variant?: 'inline' | 'banner'
}) {
  const { t } = useTranslation()
  if (variant === 'banner') {
    return (
      <div className="w-full bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-700/40 px-4 py-2">
        <p className="max-w-6xl mx-auto text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          {t('visitor.components.medicalDisclaimer.bannerGeneral')}{' '}
          {t('visitor.components.medicalDisclaimer.bannerEmergency')}{' '}
          {t('visitor.components.medicalDisclaimer.bannerReplacement')}
        </p>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 px-4 py-3 text-xs text-amber-700 dark:text-amber-400">
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
      <p>
        <strong>{t('visitor.components.medicalDisclaimer.warningTitle')}</strong>
        {' '}
        {t('visitor.components.medicalDisclaimer.warningText1')}
        {' '}
        {t('visitor.components.medicalDisclaimer.warningText2')}
      </p>
    </div>
  )
}
