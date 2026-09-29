import type { ReactNode } from 'react'

export type BadgeProps = {
  children: ReactNode
  tone?: 'mint' | 'red' | 'amber' | 'blue' | 'violet' | 'slate'
  dot?: boolean
  pulse?: boolean
}

const TONES = {
  mint: 'wdg-chip wdg-chip--mint',
  red: 'wdg-chip wdg-chip--red',
  amber: 'wdg-chip wdg-chip--amber',
  blue: 'wdg-chip wdg-chip--blue',
  violet: 'wdg-chip wdg-chip--violet',
  slate: 'wdg-chip wdg-chip--slate',
} as const

/**
 * Accent-free pill badge built on the `.wdg-chip` system.
 */
export default function Badge({ children, tone = 'slate', dot = false, pulse = false }: BadgeProps) {
  return (
    <span className={TONES[tone]}>
      {dot && <span className={`inline-block h-1.5 w-1.5 rounded-full ${pulse ? 'wdg-live-dot' : ''}`} style={pulse ? undefined : { background: 'currentColor' }} />}
      {children}
    </span>
  )
}