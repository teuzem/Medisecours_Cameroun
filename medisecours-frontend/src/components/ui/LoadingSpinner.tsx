'use client'

import { useTranslation } from 'react-i18next'

export default function LoadingSpinner({ size = 'md', label }: {
  size?: 'sm' | 'md' | 'lg'
  label?: string
}) {
  const { t } = useTranslation()
  const sizes: Record<string, string> = { sm: 'w-4 h-4 border-2', md: 'w-8 h-8 border-[3px]', lg: 'w-14 h-14 border-4' }
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-primary-300">
      <div
        className={`${sizes[size]} rounded-full border-mint-500 border-t-transparent animate-spin`}
        role="status"
        aria-label={label || t('visitor.components.loadingSpinner.label')}
      />
      <span className="text-sm">{label || t('visitor.components.loadingSpinner.label')}</span>
    </div>
  )
}
