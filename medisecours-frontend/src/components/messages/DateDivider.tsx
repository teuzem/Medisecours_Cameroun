import { memo } from 'react'

const DateDivider = memo(function DateDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-4 my-6">
      <div className="flex-1 h-px bg-gray-200 dark:bg-white/10" />
      <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">{label}</span>
      <div className="flex-1 h-px bg-gray-200 dark:bg-white/10" />
    </div>
  )
})

export default DateDivider
