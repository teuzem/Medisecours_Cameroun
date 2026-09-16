'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu } from 'lucide-react'
import { SWRConfig } from 'swr'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import MedecinSidebar from '../../components/medecin/MedecinSidebar'
import MedecinHeader from '../../components/medecin/MedecinHeader'
import { NotificationProvider } from '../../contexts/NotificationContext'
import FloatingHelpButton from '../../components/layout/FloatingHelpButton'
import { swrConfig } from '../../lib/fetcher'

const PAGE_TITLE_KEYS: Record<string, string> = {
  '/medecin': 'layout.overview',
  '/medecin/patients': 'layout.patients',
  '/medecin/consultations': 'consultations.title',
  '/medecin/prescriptions': 'prescriptions.title',
  '/medecin/pharmacy': 'layout.pharmacy',
  '/medecin/messages': 'layout.messages',
  '/medecin/rapports': 'layout.reports',
  '/medecin/notifications': 'layout.notifications',
}

function SidebarWrapper({ setMobileOpen }: { setMobileOpen: (open: boolean) => void }) {
  return (
    <div className="hidden md:block">
      <div className="sticky top-0 h-screen w-[256px] shrink-0 overflow-y-auto">
        <MedecinSidebar setMobileOpen={setMobileOpen} />
      </div>
    </div>
  )
}

function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/30 md:hidden"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: -288 }}
            animate={{ x: 0 }}
            exit={{ x: -288 }}
            transition={{ type: 'tween', duration: 0.2 }}
            className="fixed inset-y-0 left-0 z-50 w-[288px] md:hidden"
          >
            <MedecinSidebar setMobileOpen={onClose} />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

export default function MedecinLayout({ children }: { children: React.ReactNode }) {
  const { user, isMedecin, mounted } = useAuth()
  const { t } = useTranslation()
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    if (mounted && !isMedecin) {
      router.replace('/login')
    }
  }, [mounted, isMedecin, router])

  const prevPathname = useRef(pathname)
  useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname
      queueMicrotask(() => setMobileOpen(false))
    }
  }, [pathname])

  if (!mounted || !isMedecin) {
    return (
      <div className="dashboard-theme dashboard-shell flex min-h-screen items-center justify-center">
        <LoadingSpinner label={t('medecin.loadingSpace')} />
      </div>
    )
  }

  const pageTitle = t(PAGE_TITLE_KEYS[pathname as keyof typeof PAGE_TITLE_KEYS] || 'layout.medecinSpace')

  return (
    <div className="dashboard-theme dashboard-shell flex min-h-screen">
      <NotificationProvider>
        <SWRConfig value={swrConfig}>
          <SidebarWrapper setMobileOpen={setMobileOpen} />
          <MobileDrawer open={mobileOpen} onClose={() => setMobileOpen(false)} />

          <div className="flex min-w-0 flex-1 flex-col">
            <header className="dashboard-panel sticky top-0 z-30 flex h-16 items-center justify-between border-b px-4 shadow-none sm:px-6">
              <div className="flex items-center gap-4">
                <button
                  className="flex items-center justify-center rounded-xl p-2 text-[#6B7280] hover:bg-[#F3F4F6] md:hidden"
                  onClick={() => setMobileOpen(true)}
                  aria-label={t('medecin.openMenu')}
                >
                  <Menu className="h-5 w-5" />
                </button>
                <h1 className="font-display text-lg font-bold text-[#0F2C52] dark:text-white">{pageTitle}</h1>
              </div>
              <MedecinHeader />
            </header>
            <main className="flex-1 overflow-y-auto">{children}</main>
          </div>
          <FloatingHelpButton />
        </SWRConfig>
      </NotificationProvider>
    </div>
  )
}
