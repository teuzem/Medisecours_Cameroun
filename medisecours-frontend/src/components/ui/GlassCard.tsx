import type { ElementType, ReactNode } from 'react'

export type GlassCardProps = {
  children: ReactNode
  className?: string
  hover?: boolean
  glow?: boolean
  halo?: boolean
  /** CSS transition-delay (in ms) for the stagger fade-in. */
  delay?: number
  as?: ElementType
}

/**
 * Modern glass widget surface built on the `.wdg` system.
 * The whole card inherits the active workspace accent via `--accent`.
 */
export default function GlassCard({
  children,
  className = '',
  hover = false,
  glow = false,
  halo = false,
  delay,
  as: Tag = 'div',
}: GlassCardProps) {
  const classes = [
    'wdg',
    hover ? 'wdg--hover' : '',
    glow ? 'wdg__glow' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <Tag className={classes} style={delay != null ? { animationDelay: `${delay}ms` } : undefined}>
      {halo && <span className="wdg__halo" aria-hidden="true" />}
      <div className="relative">{children}</div>
    </Tag>
  )
}
