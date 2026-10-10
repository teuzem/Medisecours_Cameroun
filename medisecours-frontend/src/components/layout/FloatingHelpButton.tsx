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
      className="group fixed bottom-[84px] right-3 z-40 flex h-12 w-12 items-center justify-center bg-primary-500 text-white shadow-[0_10px_28px_rgba(21,42,69,0.35)] transition-colors hover:bg-primary-600 sm:right-5 lg:bottom-6"
    >
      <HelpCircle className="h-5 w-5" />
      <span className="pointer-events-none absolute right-full mr-2 whitespace-nowrap border border-primary-500/20 bg-white px-3 py-1 text-[11px] font-semibold text-primary-600 opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100 dark:border-white/15 dark:bg-primary-800 dark:text-primary-100">
        {t('visitor.floatingHelp.guide')}
      </span>
    </Link>
  )
}
