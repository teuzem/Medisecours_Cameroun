'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Activity, Ambulance, ClipboardList, LayoutDashboard, LogOut, Menu, Package, Settings, Users,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import GlassCard from '../../components/ui/GlassCard'
import { ToastProvider, useToast } from '../../components/ui/Toast'
import api from '../../api/axios'

const NAV = [
  { href: '/personnel/tableau-de-bord', key: 'tableauDeBord', icon: LayoutDashboard },
  { href: '/personnel/accueil', key: 'accueil', icon: Users, types: ['RECEPTIONNISTE', 'INFIRMIER', 'AIDE_SOIGNANT'] },
  { href: '/personnel/dossiers', key: 'dossiers', icon: ClipboardList, types: ['RECEPTIONNISTE', 'INFIRMIER', 'AIDE_SOIGNANT'] },
  { href: '/personnel/soins', key: 'soins', icon: Activity, types: ['INFIRMIER', 'AIDE_SOIGNANT'] },
  { href: '/personnel/pharmacie', key: 'pharmacie', icon: Package, types: ['PHARMACIEN'] },
  { href: '/personnel/ambulance', key: 'ambulance', icon: Ambulance, types: ['AMBULANCIER'] },
  { href: '/personnel/parametres', key: 'parametres', icon: Settings },
]

function PersonnelShell({ children }: { children: React.ReactNode }) {
  const { user, logout, mounted } = useAuth()
  const { t } = useTranslation()
  const pathname = usePathname()
  const router = useRouter()
  const toast = useToast()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [profil, setProfil] = useState<any>(null)
  const [profilLoaded, setProfilLoaded] = useState(false)

  useEffect(() => {
    if (!mounted) return
    let active = true
    api.get('/api/personnel/moi')
      .then((res) => {
        if (active) setProfil(res.data)
      })
      .catch(() => {
        if (active) setProfil(null)
      })
      .finally(() => {
        if (active) setProfilLoaded(true)
      })
    return () => { active = false }
  }, [mounted])

  const statut = profil?.statutValidation
  const estValide = statut === 'VALIDE'

  useEffect(() => {
    if (profilLoaded && statut === 'REJETE') {
      toast.error(t('personnel.attente.rejeteTitre'))
    }
  }, [profilLoaded, statut, toast, t])

  const handleLogout = async () => {
    await logout()
    router.replace('/personnel')
  }

  const prevPathname = useRef(pathname)
  useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname
      queueMicrotask(() => setMobileOpen(false))
    }
  }, [pathname])

  if (!mounted || !profilLoaded) {
    return (
      <div className="dashboard-theme dashboard-shell flex min-h-screen items-center justify-center">
        <LoadingSpinner label={t('personnel.layout.chargement')} />
      </div>
    )
  }

  if (!estValide) {
    return (
      <div className="dashboard-theme dashboard-shell flex min-h-screen items-center justify-center p-4">
        <GlassCard className="w-full max-w-lg p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-500/10">
            <ClipboardList className="h-7 w-7 text-amber-600" aria-hidden />
          </div>
          <h1 className="font-display text-xl font-bold text-[#0F2C52] dark:text-white">
            {statut === 'REJETE' ? t('personnel.attente.rejeteTitre') : t('personnel.attente.titre')}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-[#6B7280] dark:text-[#9CA3AF]">
            {t('personnel.attente.intro', { etablissement: profil?.etablissement?.nom ?? '—' })}
          </p>
          {profil?.validationMotif && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
              {t('personnel.attente.motif')} : {profil.validationMotif}
            </p>
          )}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-lg bg-[#0F2C52] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#16395F] dark:bg-mint-600 dark:hover:bg-mint-500"
            >
              {t('personnel.attente.actualiser')}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg border border-[#E5E7EB] px-4 py-2.5 text-sm font-semibold text-[#6B7280] hover:bg-[#F3F4F6] dark:border-white/10 dark:text-[#9CA3AF] dark:hover:bg-white/5"
            >
              {t('personnel.attente.deconnexion')}
            </button>
          </div>
        </GlassCard>
      </div>
    )
  }

  const typePersonnel = profil?.typePersonnel as string | undefined
  const navItems = NAV.filter((item) => !item.types || !typePersonnel || item.types.includes(typePersonnel))
  const activeHref = navItems.find((item) => pathname.startsWith(item.href))?.href ?? navItems[0]?.href

  const nav = (
    <nav className="flex flex-col gap-1 p-3" aria-label={t('personnel.layout.espace')}>
      {navItems.map((item) => {
        const Icon = item.icon
        const active = activeHref === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              active
                ? 'bg-[#0F2C52] text-white dark:bg-mint-600'
                : 'text-[#6B7280] hover:bg-[#F3F4F6] dark:text-[#9CA3AF] dark:hover:bg-white/5'
            }`}
          >
            <Icon className="h-4.5 w-4.5 shrink-0" aria-hidden />
            {t(`personnel.layout.${item.key}`)}
          </Link>
        )
      })}
    </nav>
  )

  return (
    <div className="dashboard-theme dashboard-shell flex min-h-screen">
      <div className="hidden md:block">
        <div className="sticky top-0 flex h-screen w-[256px] shrink-0 flex-col overflow-y-auto border-r border-[#E5E7EB] bg-white dark:border-white/10 dark:bg-[#0B1A33]">
          <div className="border-b border-[#E5E7EB] px-5 py-4 dark:border-white/10">
            <p className="font-display text-sm font-bold text-[#0F2C52] dark:text-white">
              {t('personnel.layout.espace')}
            </p>
            <p className="mt-0.5 truncate text-xs text-[#6B7280] dark:text-[#9CA3AF]">
              {typePersonnel ? t(`personnel.layout.poste.${typePersonnel}`) : ''}
              {profil?.etablissement?.nom ? ` · ${profil.etablissement.nom}` : ''}
            </p>
          </div>
          {nav}
          <div className="mt-auto border-t border-[#E5E7EB] p-3 dark:border-white/10">
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#6B7280] hover:bg-[#F3F4F6] dark:text-[#9CA3AF] dark:hover:bg-white/5"
            >
              <LogOut className="h-4.5 w-4.5" aria-hidden />
              {t('personnel.layout.deconnexion')}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/30 md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -288 }}
              animate={{ x: 0 }}
              exit={{ x: -288 }}
              transition={{ type: 'tween', duration: 0.2 }}
              className="fixed inset-y-0 left-0 z-50 flex w-[288px] flex-col bg-white dark:bg-[#0B1A33] md:hidden"
            >
              <div className="border-b border-[#E5E7EB] px-5 py-4 dark:border-white/10">
                <p className="font-display text-sm font-bold text-[#0F2C52] dark:text-white">
                  {t('personnel.layout.espace')}
                </p>
              </div>
              {nav}
              <div className="mt-auto border-t border-[#E5E7EB] p-3 dark:border-white/10">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#6B7280] hover:bg-[#F3F4F6] dark:text-[#9CA3AF] dark:hover:bg-white/5"
                >
                  <LogOut className="h-4.5 w-4.5" aria-hidden />
                  {t('personnel.layout.deconnexion')}
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="dashboard-panel sticky top-0 z-30 flex h-16 items-center justify-between border-b px-4 shadow-none sm:px-6">
          <div className="flex items-center gap-4">
            <button
              type="button"
              className="flex items-center justify-center rounded-lg p-2 text-[#6B7280] hover:bg-[#F3F4F6] md:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label={t('medecin.openMenu')}
            >
              <Menu className="h-5 w-5" />
            </button>
            <p className="font-display text-sm font-semibold text-[#6B7280] dark:text-[#9CA3AF]">
              {profil?.etablissement?.nom ?? ''}
            </p>
          </div>
          <p className="text-sm font-medium text-[#0F2C52] dark:text-white">
            {user?.prenom} {user?.nom}
          </p>
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}

export default function PersonnelLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { isAuthenticated, isPersonnel, mounted } = useAuth()
  const { t } = useTranslation()
  const router = useRouter()

  const isPublicRoot = pathname === '/personnel'

  useEffect(() => {
    if (isPublicRoot || !mounted) return
    if (!isAuthenticated || !isPersonnel) {
      router.replace('/personnel')
    }
  }, [isPublicRoot, mounted, isAuthenticated, isPersonnel, router])

  if (isPublicRoot) {
    return <ToastProvider>{children}</ToastProvider>
  }

  if (!mounted || !isAuthenticated || !isPersonnel) {
    return (
      <div className="dashboard-theme dashboard-shell flex min-h-screen items-center justify-center">
        <LoadingSpinner label={t('personnel.layout.chargement')} />
      </div>
    )
  }

  return (
    <ToastProvider>
      <PersonnelShell>{children}</PersonnelShell>
    </ToastProvider>
  )
}
