'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Bell,
  BookOpen,
  Building2,
  ClipboardCheck,
  Flag,
  HeartPulse,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import api from '../../api/axios'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import NotificationBell from '../../components/ui/NotificationBell'
import DashboardThemeToggle from '../../components/ui/DashboardThemeToggle'
import FloatingHelpButton from '../../components/layout/FloatingHelpButton'
import LanguageSwitcher from '../../components/ui/LanguageSwitcher'

function SidebarBlock({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`dashboard-panel rounded-[24px] border ${className}`}>
      {children}
    </div>
  )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { t, i18n } = useTranslation()
  const { user, isAdmin, mounted, logout } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  const NAV_GROUPS = [
    {
      label: t('admin.layout.navPrincipal'),
      items: [{ href: '/admin', label: t('admin.layout.navOverview'), icon: LayoutDashboard, exact: true }],
    },
    {
      label: t('admin.layout.navGestion'),
      items: [
        { href: '/admin/utilisateurs', label: t('admin.layout.navUtilisateurs'), icon: Users },
        { href: '/admin/medecins', label: t('admin.layout.navMedecins'), icon: ShieldCheck, badge: 'pending' },
        { href: '/admin/centres', label: t('admin.layout.navCentres'), icon: Building2 },
      ],
    },
    {
      label: t('admin.layout.navContenu'),
      items: [
        { href: '/admin/catalogue', label: t('admin.layout.navCatalogue'), icon: BookOpen },
        { href: '/admin/protocoles', label: t('admin.layout.navProtocoles'), icon: ClipboardCheck },
        { href: '/admin/signalements', label: t('admin.layout.navSignalements'), icon: Flag, badge: 'reports' },
        { href: '/admin/parametres', label: t('admin.layout.navParametres'), icon: Settings },
      ],
    },
  ]

  const PAGE_META: Record<string, { title: string; subtitle: string }> = {
    '/admin': {
      title: t('admin.layout.pageMeta.overviewTitle'),
      subtitle: t('admin.layout.pageMeta.overviewSubtitle'),
    },
    '/admin/utilisateurs': {
      title: t('admin.layout.pageMeta.utilisateursTitle'),
      subtitle: t('admin.layout.pageMeta.utilisateursSubtitle'),
    },
    '/admin/medecins': {
      title: t('admin.layout.pageMeta.medecinsTitle'),
      subtitle: t('admin.layout.pageMeta.medecinsSubtitle'),
    },
    '/admin/centres': {
      title: t('admin.layout.pageMeta.centresTitle'),
      subtitle: t('admin.layout.pageMeta.centresSubtitle'),
    },
    '/admin/catalogue': {
      title: t('admin.layout.pageMeta.catalogueTitle'),
      subtitle: t('admin.layout.pageMeta.catalogueSubtitle'),
    },
    '/admin/protocoles': {
      title: t('admin.layout.pageMeta.protocolesTitle'),
      subtitle: t('admin.layout.pageMeta.protocolesSubtitle'),
    },
    '/admin/signalements': {
      title: t('admin.layout.pageMeta.signalementsTitle'),
      subtitle: t('admin.layout.pageMeta.signalementsSubtitle'),
    },
    '/admin/parametres': {
      title: t('admin.layout.pageMeta.parametresTitle'),
      subtitle: t('admin.layout.pageMeta.parametresSubtitle'),
    },
  }
  const [mobileOpen, setMobileOpen] = useState(false)
  const [now, setNow] = useState(new Date())
  const [pendingCount, setPendingCount] = useState(0)
  const [reportCount, setReportCount] = useState(0)

  useEffect(() => {
    if (mounted && !isAdmin) router.replace('/login')
  }, [mounted, isAdmin, router])

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    api.get('/api/admin/stats')
      .then((res) => setPendingCount(res.data?.utilisateurs?.medecinsEnAttente ?? 0))
      .catch(() => {})
    api.get('/api/admin/signalements/stats')
      .then((res) => setReportCount(res.data?.nouveaux ?? 0))
      .catch(() => {})
  }, [])

  if (!mounted || !isAdmin) {
    return (
      <div className="dashboard-theme dashboard-shell min-h-screen flex items-center justify-center">
        <LoadingSpinner label={t('admin.layout.loading')} />
      </div>
    )
  }

  const pageMeta = PAGE_META[pathname] || {
    title: t('admin.layout.fallbackTitle'),
    subtitle: t('admin.layout.fallbackSubtitle'),
  }
  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname.startsWith(href))
  const initials = `${user?.prenom?.[0] || ''}${user?.nom?.[0] || ''}`.toUpperCase() || 'AD'
  const fullName = [user?.prenom, user?.nom].filter(Boolean).join(' ') || 'Administrateur'

  const sidebarContent = (
    <SidebarBlock className="flex h-full flex-col">
      <div className="flex items-center justify-between px-5 py-5">
        <Link href="/admin" className="flex items-center gap-3" onClick={() => setMobileOpen(false)}>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0f2418] text-white">
            <HeartPulse className="h-5 w-5" />
          </div>
          <div>
            <p className="font-display text-base font-extrabold tracking-tight text-[#162117]">MediSecours</p>
            <p className="text-[11px] font-medium text-[#7a8577]">{t('admin.layout.adminConsole')}</p>
          </div>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="md:hidden rounded-full border border-[#dde3d8] p-2 text-[#556254]"
          aria-label={t('admin.layout.closeMenu')}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-4 pb-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-2 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#7c8778]">{group.label}</p>
            <div className="space-y-1.5">
              {group.items.map(({ href, label, icon: Icon, exact, badge }: { href: string; label: string; icon: any; exact?: boolean; badge?: string }) => {
                const active = isActive(href, exact)
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center justify-between gap-3 rounded-2xl px-3.5 py-3 text-sm transition ${
                      active
                        ? 'bg-[#0f2418] text-white shadow-[0_12px_24px_rgba(15,36,24,0.2)]'
                        : 'text-[#5d675b] hover:bg-[#edf1ea] hover:text-[#162117]'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${active ? 'bg-white/10' : 'bg-white text-[#5f6d5e]'}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="font-medium">{label}</span>
                    </span>
                    {badge === 'pending' && pendingCount > 0 && (
                      <span className={`min-w-[22px] rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold ${active ? 'bg-[#59c56c] text-[#0f2418]' : 'bg-[#0f2418] text-white'}`}>
                        {pendingCount}
                      </span>
                    )}
                    {badge === 'reports' && reportCount > 0 && (
                      <span className={`min-w-[22px] rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold ${active ? 'bg-red-300 text-red-950' : 'bg-red-600 text-white'}`}>
                        {reportCount}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="space-y-4 px-4 pb-4">
        <div className="rounded-[22px] border border-[#e4e8df] bg-[#eff3eb] p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#243124]">
            <Sparkles className="h-4 w-4 text-[#59c56c]" />
            {t('admin.layout.assistantAdmin')}
          </div>
          <div className="rounded-full border border-[#cfe3cb] bg-white px-3 py-2 text-xs text-[#7b8677]">
            {t('admin.layout.assistantHint')}
          </div>
          <div className="mt-3 flex gap-2">
            <span className="rounded-full bg-white px-3 py-1 text-[11px] font-medium text-[#4c584c]">{t('admin.layout.audit')}</span>
            <span className="rounded-full bg-white px-3 py-1 text-[11px] font-medium text-[#4c584c]">{t('admin.layout.support')}</span>
          </div>
        </div>

        <div className="rounded-[22px] border border-[#e4e8df] bg-white px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#0f2418] text-sm font-bold text-white">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[#172216]">{fullName}</p>
              <p className="truncate text-xs text-[#7d877a]">{user?.email}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <Link
              href="/admin/parametres"
              onClick={() => setMobileOpen(false)}
              className="inline-flex items-center gap-2 rounded-full bg-[#edf3ea] px-3 py-2 text-xs font-semibold text-[#334032] transition hover:bg-[#e5ede1]"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              {t('admin.layout.support')}
            </Link>
            <button
              type="button"
              onClick={() => {
                logout()
                router.push('/')
              }}
              className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold text-[#7c5b5b] transition hover:bg-[#f9ecec]"
            >
              <LogOut className="h-3.5 w-3.5" />
              {t('admin.layout.logout')}
            </button>
          </div>
        </div>
      </div>
    </SidebarBlock>
  )

  return (
    <div className="dashboard-theme dashboard-shell min-h-screen p-3 sm:p-5 md:pl-0">
      <div className="flex min-h-[calc(100vh-1.5rem)] gap-4 lg:gap-5">
        <aside className="hidden w-[290px] shrink-0 md:block md:sticky md:top-5 md:self-start md:max-h-[calc(100vh-2.5rem)] md:overflow-y-auto">
          <SidebarBlock className="flex h-full flex-col md:rounded-l-none md:border-l-0">
            <div className="flex items-center justify-between px-5 py-5">
              <Link href="/admin" className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0f2418] text-white">
                  <HeartPulse className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-display text-base font-extrabold tracking-tight text-[#162117]">MediSecours</p>
                  <p className="text-[11px] font-medium text-[#7a8577]">{t('admin.layout.adminConsole')}</p>
                </div>
              </Link>
            </div>

            <nav className="flex-1 space-y-5 overflow-y-auto px-4 pb-4">
              {NAV_GROUPS.map((group) => (
                <div key={group.label}>
                  <p className="px-2 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#7c8778]">{group.label}</p>
                  <div className="space-y-1.5">
                    {group.items.map(({ href, label, icon: Icon, exact, badge }: { href: string; label: string; icon: any; exact?: boolean; badge?: string }) => {
                      const active = isActive(href, exact)
                      return (
                        <Link
                          key={href}
                          href={href}
                          className={`flex items-center justify-between gap-3 rounded-2xl px-3.5 py-3 text-sm transition ${
                            active
                              ? 'bg-[#0f2418] text-white shadow-[0_12px_24px_rgba(15,36,24,0.2)]'
                              : 'text-[#5d675b] hover:bg-[#edf1ea] hover:text-[#162117]'
                          }`}
                        >
                          <span className="flex items-center gap-3">
                            <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${active ? 'bg-white/10' : 'bg-white text-[#5f6d5e]'}`}>
                              <Icon className="h-4 w-4" />
                            </span>
                            <span className="font-medium">{label}</span>
                          </span>
                          {badge === 'pending' && pendingCount > 0 && (
                            <span className={`min-w-[22px] rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold ${active ? 'bg-[#59c56c] text-[#0f2418]' : 'bg-[#0f2418] text-white'}`}>
                              {pendingCount}
                            </span>
                          )}
                          {badge === 'reports' && reportCount > 0 && (
                            <span className={`min-w-[22px] rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold ${active ? 'bg-red-300 text-red-950' : 'bg-red-600 text-white'}`}>
                              {reportCount}
                            </span>
                          )}
                        </Link>
                      )
                    })}
                  </div>
                </div>
              ))}
            </nav>

            <div className="space-y-4 px-4 pb-4">
              <div className="rounded-[22px] border border-[#e4e8df] bg-[#eff3eb] p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#243124]">
                  <Sparkles className="h-4 w-4 text-[#59c56c]" />
                  {t('admin.layout.assistantAdmin')}
                </div>
                <div className="rounded-full border border-[#cfe3cb] bg-white px-3 py-2 text-xs text-[#7b8677]">
                  {t('admin.layout.assistantHint')}
                </div>
                <div className="mt-3 flex gap-2">
                  <span className="rounded-full bg-white px-3 py-1 text-[11px] font-medium text-[#4c584c]">{t('admin.layout.audit')}</span>
                  <span className="rounded-full bg-white px-3 py-1 text-[11px] font-medium text-[#4c584c]">{t('admin.layout.support')}</span>
                </div>
              </div>

              <div className="rounded-[22px] border border-[#e4e8df] bg-white px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#0f2418] text-sm font-bold text-white">
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#172216]">{fullName}</p>
                    <p className="truncate text-xs text-[#7d877a]">{user?.email}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <Link
                    href="/admin/parametres"
                    className="inline-flex items-center gap-2 rounded-full bg-[#edf3ea] px-3 py-2 text-xs font-semibold text-[#334032] transition hover:bg-[#e5ede1]"
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                    {t('admin.layout.support')}
                  </Link>
                  <button
                    type="button"
                    onClick={() => { logout(); router.push('/') }}
                    className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold text-[#7c5b5b] transition hover:bg-[#f9ecec]"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    {t('admin.layout.logout')}
                  </button>
                </div>
              </div>
            </div>
          </SidebarBlock>
        </aside>

        <AnimatePresence>
          {mobileOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-[#0f2418]/30 backdrop-blur-sm md:hidden"
                onClick={() => setMobileOpen(false)}
              />
              <motion.aside
                initial={{ x: -320 }}
                animate={{ x: 0 }}
                exit={{ x: -320 }}
                transition={{ type: 'tween', duration: 0.22 }}
                className="fixed inset-y-3 left-3 z-50 w-[290px] md:hidden"
              >
                {sidebarContent}
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        <div className="flex min-w-0 flex-1 flex-col">
          <SidebarBlock className="flex flex-col">
            <header className="border-b border-[#e7ebe3] px-4 py-4 sm:px-6">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    className="mt-0.5 rounded-full border border-[#dde3d8] bg-white p-2 text-[#566255] md:hidden"
                    onClick={() => setMobileOpen(true)}
                    aria-label={t('admin.layout.openMenu')}
                  >
                    <Menu className="h-4 w-4" />
                  </button>

                  <div className="hidden h-12 w-12 items-center justify-center rounded-full bg-[radial-gradient(circle_at_top,_#ffffff,_#dbe4d8)] shadow-inner sm:flex">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0f2418] text-sm font-bold text-white">
                      {initials}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-[#172216] sm:text-base">
                      {pathname === '/admin' ? t('admin.layout.welcome', { name: user?.prenom || 'Admin' }) : pageMeta.title}
                    </p>
                    <p className="mt-1 text-xs text-[#7b8677] sm:text-sm">{pageMeta.subtitle}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end xl:self-auto">
                  <div className="hidden rounded-full border border-[#dfe5db] bg-white px-3 py-2 text-xs font-medium capitalize text-[#6a7667] sm:flex">
                    {now.toLocaleDateString(i18n.language?.startsWith('en') ? 'en-US' : 'fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </div>
                  <button
                    type="button"
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-[#dfe5db] bg-white text-[#445244] transition hover:bg-[#edf2ea]"
                    aria-label={t('admin.layout.search')}
                  >
                    <Search className="h-4 w-4" />
                  </button>
                  <DashboardThemeToggle />
                  <LanguageSwitcher />
                  <NotificationBell count={pendingCount} href="/admin/medecins" badgeColor="#59c56c" dotColor="#59c56c" />
                </div>
              </div>
            </header>

            <main className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
              {children}
            </main>
          </SidebarBlock>
        </div>
      </div>
      <FloatingHelpButton />
    </div>
  )
}
