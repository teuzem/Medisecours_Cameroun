import { type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

export default function UrgencyBadge({ children = 'Urgence' }: { children?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-urgence-500 text-white animate-pulse-urgence">
      <AlertTriangle className="w-3.5 h-3.5" />
      {children}
    </span>
  )
}
