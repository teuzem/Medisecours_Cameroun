'use client'

import type { LucideIcon } from 'lucide-react'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { useCountUp } from './useCountUp'

export type StatCardProps = {
  icon: LucideIcon
  label: string
  value?: number | string
  /** Number to animate towards (falls back to `value`). */
  animateTo?: number
  /** Short contextual caption shown under the value. */
  caption?: string
  /** Lowercase caption rendered as a colored trend pill. */
  trend?: { value: string; tone?: 'up' | 'down' | 'neutral' }
  tile?: 'accent' | 'mint' | 'blue' | 'red' | 'amber' | 'violet' | 'teal' | 'sky' | 'amazon'
  /** Red/alert emphasis style. */
  highlight?: boolean
  /** Stagger delay for fade-in (ms). */
  delay?: number
  /** Extra classes for the tile (set the tile color directly). */
  className?: string
}

const TILE_TONES: Record<NonNullable<StatCardProps['tile']>, string> = {
  accent: 'wdg__tile',
  mint: 'wdg__tile wdg__tile--mint',
  blue: 'wdg__tile wdg__tile--blue',
  red: 'wdg__tile wdg__tile--red',
  amber: 'wdg__tile wdg__tile--amber',
  violet: 'wdg__tile wdg__tile--violet',
  teal: 'wdg__tile wdg__tile--teal',
  sky: 'wdg__tile wdg__tile--sky',
  amazon: 'wdg__tile wdg__tile--amazon',
}

const TREND_TONES = {
  up: 'wdg-chip wdg-chip--mint',
  down: 'wdg-chip wdg-chip--red',
  neutral: 'wdg-chip wdg-chip--slate',
} as const

/**
 * Modern KPI widget: accent gradient icon tile + animated count-up value.
 */
export default function StatCard({
  icon: Icon,
  label,
  value,
  animateTo,
  caption,
  trend,
  tile = 'accent',
  highlight = false,
  delay,
  className = '',
}: StatCardProps) {
  const animated = useCountUp(animateTo ?? (typeof value === 'number' ? value : 0))
  const display =
    animateTo != null || typeof value === 'number'
      ? new Intl.NumberFormat('fr-FR').format(Math.round(animated))
      : value

  const iconColor = highlight ? 'text-urgence-500 dark:text-urgence-400' : ''

  return (
    <div
      className={`wdg-anim relative flex flex-col justify-between overflow-hidden rounded-2xl border p-4 shadow-sm transition-transform hover:-translate-y-0.5 ${
        highlight
          ? 'border-urgence-200 bg-urgence-50/70 dark:border-urgence-500/25 dark:bg-urgence-500/10'
          : 'border-white/80 bg-white/90 dark:border-white/10 dark:bg-slate-900/70'
      } ${className}`}
      style={delay != null ? { animationDelay: `${delay}ms` } : undefined}
    >
      {highlight && (
        <span className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-urgence-500/10 blur-2xl" aria-hidden="true" />
      )}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="wdg__eyebrow text-slate-400 dark:text-slate-500">{label}</p>
          <p className="wdg__value mt-2 text-[26px] text-slate-900 dark:text-white">{display}</p>
        </div>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white ${TILE_TONES[tile]} ${iconColor}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      {(caption || trend) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {trend && (
            <span className={TREND_TONES[trend.tone ?? 'neutral']}>
              {trend.tone === 'down' ? <TrendingDown className="h-3 w-3" /> : trend.tone === 'up' ? <TrendingUp className="h-3 w-3" /> : null}
              {trend.value}
            </span>
          )}
          {caption && <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">{caption}</span>}
        </div>
      )}
    </div>
  )
}