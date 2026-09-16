import { memo } from 'react'
import { CheckCheck, Loader2 } from 'lucide-react'

const ReadStatus = memo(function ReadStatus({ statut, sending }: { statut?: string; sending?: boolean }) {
  if (sending) return <Loader2 className="w-3 h-3 animate-spin text-white/60" />
  if (statut === 'LU') return <CheckCheck className="w-3.5 h-3.5 text-cyan-300" />
  return <CheckCheck className="w-3.5 h-3.5 text-white/60" />
})

export default ReadStatus
