'use client'

type ToggleProps = {
  checked: boolean
  onChange: (next: boolean) => void
  label?: string
  description?: string
  /** Use the workspace accent instead of the default brand color. */
  accent?: boolean
  size?: 'sm' | 'md'
}

/**
 * Accessible switch styled with the active accent (or brand mint).
 */
export default function Toggle({ checked, onChange, label, description, accent = false, size = 'md' }: ToggleProps) {
  const track = checked
    ? accent
      ? 'bg-[var(--accent,#10b981)]'
      : 'bg-mint-500'
    : 'bg-slate-300 dark:bg-slate-700'
  const knob = size === 'md' ? 'h-5 w-5' : 'h-4 w-4'
  const off = size === 'md' ? 'left-0.5' : 'left-0.5'
  const on = size === 'md' ? 'left-[22px]' : 'left-[18px]'

  return (
    <div className="flex items-center justify-between gap-3">
      {(label || description) && (
        <div className="min-w-0">
          {label && <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{label}</p>}
          {description && <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{description}</p>}
        </div>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${size === 'md' ? 'h-6 w-11' : 'h-5 w-9'} ${track}`}
      >
        <span
          className={`pointer-events-none absolute top-0.5 bottom-0.5 aspect-square rounded-full bg-white shadow transition-all duration-200 ${knob} ${checked ? on : off}`}
        />
      </button>
    </div>
  )
}