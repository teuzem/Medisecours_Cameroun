import type { ReactNode } from 'react'

export type SectionHeaderProps = {
  title: string
  /** Legacy prop: rendered as normal supporting text under the title, never as a kicker. */
  eyebrow?: string
  description?: string
  action?: ReactNode
  /** Render a large title variant. */
  large?: boolean
}

/**
 * Consistent block heading: display title + optional supporting text + optional action.
 */
export default function SectionHeader({ title, eyebrow, description, action, large = false }: SectionHeaderProps) {
  const support = description ?? eyebrow
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className={`font-display font-bold tracking-tight text-slate-900 dark:text-white ${large ? 'text-xl sm:text-2xl' : 'text-sm text-slate-700 dark:text-slate-200'}`}>
          {title}
        </h2>
        {support && <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{support}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  )
}
