'use client'

import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export default function CertifiedBadge({ className = 'h-5 w-5' }: { className?: string }) {
  const { t } = useTranslation()
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-[#1DA1F2] text-white ${className}`}
      title={t('visitor.components.certifiedBadge.title')}
      aria-label={t('visitor.components.certifiedBadge.title')}
    >
      <Check className="h-[58%] w-[58%]" strokeWidth={4} aria-hidden="true" />
    </span>
  )
}
