import type { ReactNode } from 'react'

export type SectionHeaderProps = {
  title: string
  eyebrow?: string
  description?: string
  action?: ReactNode
  /** Render a large title variant. */
  large?: boolean
}

/**
 * Consistent block heading: micro eyebrow + display title + optional action.
 */
export default function SectionHeader({ title, eyebrow, description, action, large = false }: SectionHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
            {eyebrow}
          </p>
        )}
        <h2 className={`font-display font-extrabold tracking-tight text-slate-900 dark:text-white ${large ? 'text-xl sm:text-2xl' : 'text-sm uppercase tracking-wide text-slate-500 dark:text-slate-400'}`}>
          {title}
        </h2>
        {description && <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  )
}