'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { HelpCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export default function FloatingHelpButton() {
  const { t } = useTranslation()
  const pathname = usePathname()
  const isMessagingRoute =
    pathname === '/messages' ||
    pathname?.startsWith('/patient/messages') ||
    pathname?.startsWith('/medecin/messages')

  if (pathname === '/guide-utilisation' || pathname === '/medecin/guide-utilisation' || isMessagingRoute) return null

  const guideHref = pathname?.startsWith('/medecin') ? '/medecin/guide-utilisation' : '/guide-utilisation'

  return (
    <Link
      href={guideHref}
      aria-label={t('visitor.floatingHelp.guide')}
      title={t('visitor.floatingHelp.guide')}
      className="group fixed bottom-[76px] right-3 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-white/60 bg-[linear-gradient(135deg,rgba(37,99,235,0.94),rgba(79,70,229,0.9))] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_10px_28px_rgba(79,70,229,0.42)] backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110 sm:right-5 lg:bottom-6"
    >
      <HelpCircle className="h-5 w-5" />
      <span className="pointer-events-none absolute right-full mr-2 whitespace-nowrap rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200">
        {t('visitor.floatingHelp.guide')}
      </span>
    </Link>
  )
}
