'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export default function CentresRedirect() {
  const router = useRouter()
  const { t } = useTranslation()

  useEffect(() => {
    router.replace('/carte')
  }, [router])

  return (
    <div className="flex h-[calc(100dvh-76px)] w-full items-center justify-center bg-slate-100 dark:bg-slate-950 xl:h-[calc(100dvh-96px)]">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin text-primary-500" />
        {t('visitor.carte.mapLoading')}
      </div>
    </div>
  )
}