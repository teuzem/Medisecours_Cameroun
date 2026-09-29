'use client'

import { useTranslation } from 'react-i18next'
import { severityLabelKey } from '../../lib/domainLabels'

const STYLES: Record<string, string> = {
  'LÉGÈRE': 'bg-mint-100 text-mint-700 border-mint-500/30',
  'MODÉRÉE': 'bg-amber-100 text-amber-700 border-amber-500/30',
  'SÉVÈRE': 'bg-orange-100 text-orange-700 border-orange-500/30',
  'CRITIQUE': 'bg-urgence-100 text-urgence-700 border-urgence-500/30',
  'VARIABLE': 'bg-primary-100 text-primary-700 border-primary-500/30',
}

export default function GravityBadge({ level }: { level?: string }) {
  const { t } = useTranslation()
  const style = STYLES[level ?? 'VARIABLE'] || STYLES['VARIABLE']
  const key = severityLabelKey(level)
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${style}`}>
      {key ? t(key) : level}
    </span>
  )
}
