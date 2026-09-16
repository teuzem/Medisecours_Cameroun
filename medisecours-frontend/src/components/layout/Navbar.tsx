'use client'
import { Suspense, type ReactNode } from 'react'
import Link from 'next/link'

import Image from 'next/image'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { 
  Sun, Moon,
  MessageCircle, UserCircle, LogOut, 
  Home, Grid, Activity, MapPin, 
  ArrowRight, FileText,
  Cross, Stethoscope, FolderOpen, Pill
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useUnreadCount } from '../../hooks/useUnreadCount'
import { useTheme } from '../../hooks/useTheme'
import { useTranslation } from 'react-i18next'
import { resolveImgPath } from '../../lib/config'
import LanguageSwitcher from '../ui/LanguageSwitcher'

function ConversationAware({ children }: { children: (inConversation: boolean) => ReactNode }) {
  const searchParams = useSearchParams()
  return children(Boolean(searchParams.get('conversation')))
}

export default function Navbar() {
  const { dark, toggleTheme: toggleDark } = useTheme()
  const { isAuthenticated, user, isAdmin, logout } = useAuth()
  const { t } = useTranslation()
  const pathname = usePathname()
  const router = useRouter()
  const { unreadCount } = useUnreadCount()

  const estDansLaMessagerie = pathname.includes('/messages') || pathname.includes('/conversations') || pathname.includes('/medecin/messages')
  const isCentresRoute = pathname === '/centres'

  const initials = user ? `${user.prenom?.[0] || ''}${user.nom?.[0] || ''}`.toUpperCase() : ''
  const isActive = (to: string) => (to === '/' ? pathname === '/' : pathname.startsWith(to))

  /* ─── Desktop links ─── */
  type NavLink = { to: string; label: string; icon: any; badge?: number }
  const publicLinks: NavLink[] = [
    { to: '/', label: t('visitor.nav.home'), icon: Home },
    { to: '/premiers-soins', label: t('visitor.nav.firstAid'), icon: Cross },
    { to: '/maladies', label: t('visitor.nav.orientation'), icon: Activity },
    { to: '/medecins', label: t('visitor.nav.doctors'), icon: Stethoscope },
    { to: '/centres', label: t('visitor.nav.centres'), icon: MapPin },
  ]

  const patientLinks: NavLink[] = [
    { to: '/', label: t('visitor.nav.home'), icon: Home },
    { to: '/premiers-soins', label: t('visitor.nav.firstAid'), icon: Cross },
    { to: '/maladies', label: t('visitor.nav.orientation'), icon: Activity },
    { to: '/medecins', label: t('visitor.nav.doctors'), icon: Stethoscope },
    { to: '/patient/consultations', label: t('visitor.nav.consultations'), icon: FileText },
    { to: '/centres', label: t('visitor.nav.centres'), icon: MapPin },
    { to: '/messages', label: t('visitor.nav.messaging'), icon: MessageCircle, badge: unreadCount },
  ]

  const activeLinks = isAuthenticated && !isAdmin ? patientLinks : publicLinks

  /* ─── Mobile bottom tab bar items ─── */
  const publicMobileNav: NavLink[] = [
    { to: '/', label: t('visitor.nav.home'), icon: Home },
    { to: '/premiers-soins', label: t('visitor.nav.firstAid'), icon: Cross },
    { to: '/maladies', label: t('visitor.nav.orientation'), icon: Activity },
    { to: '/centres', label: t('visitor.nav.centres'), icon: MapPin },
    { to: '/login', label: t('visitor.nav.login'), icon: UserCircle },
  ]

  const patientMobileNav: NavLink[] = [
    { to: '/', label: t('visitor.nav.home'), icon: Home },
    { to: '/premiers-soins', label: t('visitor.nav.firstAid'), icon: Cross },
    { to: '/maladies', label: t('visitor.nav.orientation'), icon: Activity },
    { to: '/medecins', label: t('visitor.nav.doctors'), icon: Stethoscope },
    { to: '/patient/consultations', label: t('visitor.nav.appointments'), icon: FileText },
    { to: '/centres', label: t('visitor.nav.centres'), icon: MapPin },
  ]

  const mobileNavItems: NavLink[] = isAuthenticated && !isAdmin ? patientMobileNav : publicMobileNav

  return (
    <>
      {/* ══════════════════════════════════════════════════════════════════
       *  DESKTOP Floating Navbar (hidden on mobile/tablet)
       * ══════════════════════════════════════════════════════════════════ */}
      <div className="hidden xl:flex fixed top-4 inset-x-0 z-50 justify-center px-4 pointer-events-none">
        <header className="relative isolate overflow-hidden w-full max-w-[1500px] min-w-0 h-16 pointer-events-auto rounded-full border border-white/80 dark:border-white/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.74),rgba(255,255,255,0.38)_48%,rgba(224,231,255,0.48))] dark:bg-[linear-gradient(135deg,rgba(17,24,39,0.82),rgba(30,41,59,0.62)_52%,rgba(49,46,129,0.42))] backdrop-blur-[26px] backdrop-saturate-[1.85] shadow-[0_18px_48px_rgba(30,58,95,0.16),0_4px_14px_rgba(30,58,95,0.08),inset_0_1px_0_rgba(255,255,255,0.98),inset_0_-1px_0_rgba(99,102,241,0.12)] dark:shadow-[0_18px_48px_rgba(0,0,0,0.38),0_4px_14px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.18),inset_0_-1px_0_rgba(129,140,248,0.18)] px-3 flex items-center gap-2 transition-all duration-300 before:absolute before:inset-[1px] before:-z-10 before:rounded-[inherit] before:pointer-events-none before:bg-[radial-gradient(circle_at_12%_0%,rgba(255,255,255,0.86),transparent_30%),radial-gradient(circle_at_88%_110%,rgba(99,102,241,0.16),transparent_34%)] dark:before:bg-[radial-gradient(circle_at_12%_0%,rgba(255,255,255,0.16),transparent_30%),radial-gradient(circle_at_88%_110%,rgba(129,140,248,0.2),transparent_34%)] after:absolute after:top-px after:left-[8%] after:right-[8%] after:h-px after:-z-10 after:rounded-full after:bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.98),transparent)]">
          
          {/* Logo */}
          <Link
            href="/"
            className="flex h-12 w-[132px] shrink-0 items-center justify-center overflow-hidden rounded-xl transition-colors dark:bg-white/90 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_4px_14px_rgba(0,0,0,0.16)] 2xl:h-[52px] 2xl:w-[148px]"
            aria-label={t('visitor.nav.homeAria')}
          >
            <Image
              src="/brand/medisecours-logo.png"
              alt="MediSecours"
              width={853}
              height={299}
              priority
              className="h-auto w-[129px] max-w-full object-contain 2xl:w-[145px]"
            />
          </Link>

          {/* Center: Navigation Links */}
          <nav className="flex min-w-0 flex-1 items-center justify-center gap-0.5 2xl:gap-1">
            {activeLinks.map((l) => {
              const active = isActive(l.to)
              const Icon = l.icon
              return (
                <Link
                  key={l.to}
                  href={l.to}
                  className={`relative flex shrink-0 items-center gap-1.5 whitespace-nowrap px-2.5 2xl:px-4 py-2.5 rounded-full text-[12px] 2xl:text-[13px] font-semibold transition-all duration-200 ${
                    active
                      ? 'border border-white/75 dark:border-white/10 bg-white/55 dark:bg-indigo-500/20 text-indigo-900 dark:text-indigo-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_4px_12px_rgba(79,70,229,0.1)]'
                      : 'border border-transparent text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:border-white/60 dark:hover:border-white/10 hover:bg-white/40 dark:hover:bg-white/5'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${active ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500'}`} />
                  {l.label}
                  
                  {l.badge !== undefined && l.badge > 0 && !estDansLaMessagerie && (
                    <span className="ml-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold shadow-sm animate-pulse">
                      {l.badge > 99 ? '99+' : l.badge}
                    </span>
                  )}

                  {active && (
                    <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-indigo-600 dark:bg-indigo-400 rounded-full shadow-[0_0_8px_rgba(79,70,229,0.8)]" />
                  )}
                </Link>
              )
            })}
            
            {isAdmin && (
              <Link
                href="/admin"
                className={`relative flex shrink-0 items-center gap-1.5 whitespace-nowrap px-2.5 2xl:px-4 py-2.5 rounded-full text-[12px] 2xl:text-[13px] font-semibold transition-all ${
                  isActive('/admin')
                    ? 'bg-indigo-50/80 dark:bg-indigo-900/30 text-indigo-900'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Grid className="w-4 h-4" /> {t('visitor.nav.admin')}
                {isActive('/admin') && <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-indigo-600 rounded-full" />}
              </Link>
            )}
          </nav>

          {/* Right: Actions */}
          <div className="flex shrink-0 items-center gap-1.5 pr-1">
            <LanguageSwitcher />
            {!isAuthenticated && (
              <button
                onClick={toggleDark}
                className="flex items-center justify-center w-9 h-9 rounded-full border border-white/70 dark:border-white/10 bg-white/45 dark:bg-white/5 text-gray-500 dark:text-gray-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_4px_12px_rgba(30,58,95,0.08)] hover:bg-white/70 dark:hover:bg-white/10 hover:text-indigo-600 transition-colors"
                aria-label={t('visitor.nav.toggleTheme')}
              >
                {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            )}

            {isAuthenticated ? (
              <div className="flex items-center gap-2">
                <Link
                  href="/profil"
                  className="group relative flex items-center gap-2 pl-1 pr-3 py-1 border border-white/25 bg-[linear-gradient(135deg,rgba(37,99,235,0.92),rgba(79,70,229,0.84))] backdrop-blur-xl text-white rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_6px_18px_rgba(79,70,229,0.3)] transition-all duration-200 hover:brightness-105 hover:-translate-y-0.5"
                >
                  <div className="w-7 h-7 rounded-full overflow-hidden bg-white/20 flex items-center justify-center text-[10px] font-bold">
                    {user?.photoProfil ? (
                      <img src={resolveImgPath(user.photoProfil)} alt="" className="w-full h-full object-cover" onError={(e) => { const img = e.target as HTMLImageElement; img.style.display = 'none'; const fb = img.nextSibling as HTMLElement | null; if (fb) fb.style.display = 'flex' }} />
                    ) : null}
                    <span style={user?.photoProfil ? { display: 'none' } : undefined} className="flex items-center justify-center w-full h-full">
                      {initials || <UserCircle className="w-4 h-4" />}
                    </span>
                  </div>
                  <span className="hidden 2xl:inline text-[13px] font-semibold">{t('visitor.nav.myProfile')}</span>
                  <ArrowRight className="hidden 2xl:block w-3.5 h-3.5 opacity-70 group-hover:translate-x-0.5 transition-transform" />
                </Link>
                
                <button
                  onClick={() => { logout(); router.push('/') }}
                  className="flex items-center justify-center w-9 h-9 rounded-full border border-white/70 dark:border-white/10 bg-white/45 dark:bg-white/5 text-gray-500 dark:text-gray-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_4px_12px_rgba(30,58,95,0.08)] hover:bg-red-50/80 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400 transition-colors"
                  aria-label={t('visitor.nav.logout')}
                  title={t('visitor.nav.logoutTitle')}
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="group relative flex items-center gap-2 px-5 py-2 border border-white/25 bg-[linear-gradient(135deg,rgba(37,99,235,0.92),rgba(79,70,229,0.84))] backdrop-blur-xl text-white rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_6px_18px_rgba(79,70,229,0.3)] transition-all duration-200 hover:brightness-105 hover:-translate-y-0.5"
              >
                <span className="text-[13px] font-semibold">{t('visitor.nav.login')}</span>
                <ArrowRight className="w-4 h-4 opacity-70 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            )}
          </div>
        </header>
      </div>

      {/* Desktop spacer */}
      {pathname !== '/' && <div className="hidden xl:block h-24" />}


      {/* ══════════════════════════════════════════════════════════════════
       *  MOBILE / TABLET — Minimal Top Bar (logo + theme toggle only)
       *  Wrapped in #app-topbar so it can be hidden on mobile when a
       *  conversation is open (body.chat-open) — the bottom tab bar stays.
      * ══════════════════════════════════════════════════════════════════ */}
      <div id="app-topbar">
      <div className="xl:hidden fixed top-2 inset-x-2 sm:inset-x-4 z-50 isolate overflow-hidden rounded-[22px] border border-white/80 dark:border-white/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.76),rgba(255,255,255,0.42)_52%,rgba(224,231,255,0.5))] dark:bg-[linear-gradient(135deg,rgba(17,24,39,0.84),rgba(30,41,59,0.66)_52%,rgba(49,46,129,0.44))] backdrop-blur-[24px] backdrop-saturate-[1.8] shadow-[0_14px_36px_rgba(30,58,95,0.16),inset_0_1px_0_rgba(255,255,255,0.96)] dark:shadow-[0_14px_36px_rgba(0,0,0,0.36),inset_0_1px_0_rgba(255,255,255,0.16)] before:absolute before:inset-px before:-z-10 before:rounded-[inherit] before:bg-[radial-gradient(circle_at_15%_0%,rgba(255,255,255,0.82),transparent_34%),radial-gradient(circle_at_90%_110%,rgba(99,102,241,0.16),transparent_36%)] dark:before:bg-[radial-gradient(circle_at_15%_0%,rgba(255,255,255,0.14),transparent_34%),radial-gradient(circle_at_90%_110%,rgba(129,140,248,0.2),transparent_36%)]">
        <div className="flex items-center justify-between gap-2 px-3 py-3 sm:px-4">
          <Link
            href="/"
            className="flex h-11 w-[108px] shrink-0 items-center justify-center overflow-hidden rounded-xl transition-colors dark:bg-white/90 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_3px_12px_rgba(0,0,0,0.14)] sm:h-12 sm:w-[142px]"
            aria-label={t('visitor.nav.homeAria')}
          >
            <Image
              src="/brand/medisecours-logo.png"
              alt="MediSecours"
              width={853}
              height={299}
              priority
              className="h-auto w-[104px] max-w-full object-contain sm:w-[138px]"
            />
          </Link>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <LanguageSwitcher />
            {!isAuthenticated && (
              <button
                onClick={toggleDark}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/70 bg-white/45 text-gray-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] transition-colors hover:bg-white/70 hover:text-indigo-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10 sm:h-9 sm:w-9"
                aria-label={t('visitor.nav.toggleTheme')}
              >
                {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            )}

            {isAuthenticated && (
              <>
                {!isAdmin && (
                  <Link
                    href="/messages"
                    className={`relative flex h-8 w-8 items-center justify-center rounded-full border shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] transition-colors sm:h-9 sm:w-9 ${
                      estDansLaMessagerie
                        ? 'border-indigo-200 bg-indigo-100/80 text-indigo-600 dark:border-indigo-400/20 dark:bg-indigo-500/20 dark:text-indigo-300'
                        : 'border-white/70 bg-white/45 text-gray-500 hover:bg-white/70 hover:text-indigo-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10'
                    }`}
                    aria-label={unreadCount > 0 ? t('visitor.nav.unreadMessages', { count: unreadCount }) : t('visitor.nav.messagesAria')}
                  >
                    <MessageCircle className="h-4 w-4" />
                    {unreadCount > 0 && !estDansLaMessagerie && (
                      <span className="absolute -right-1 -top-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white ring-2 ring-white dark:ring-slate-900">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </Link>
                )}
                <Link
                  href="/profil"
                  className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-white/70 bg-white/45 text-gray-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] transition-colors hover:bg-white/70 hover:text-indigo-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10 sm:h-9 sm:w-9"
                  aria-label={t('visitor.nav.profile')}
                >
                  {user?.photoProfil ? (
                    <img src={resolveImgPath(user.photoProfil)} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <UserCircle className="w-5 h-5" />
                  )}
                </Link>
                <button
                  onClick={() => { logout(); router.push('/') }}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/70 bg-white/45 text-gray-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] transition-colors hover:bg-red-50/80 hover:text-red-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-red-500/10 sm:h-9 sm:w-9"
                  aria-label={t('visitor.nav.logout')}
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile top spacer */}
      <div className="xl:hidden h-[76px]" />
      </div>


      {/* ══════════════════════════════════════════════════════════════════
       *  MOBILE / TABLET — Bottom Tab Bar (iOS/Android native feel)
       *  Hidden on mobile/tablet while a conversation is open (?conversation=)
       * ══════════════════════════════════════════════════════════════════ */}
      <Suspense fallback={null}>
        <ConversationAware>
          {(inConversation) => (
      <>
      <nav className={`xl:hidden fixed bottom-2 inset-x-2 sm:inset-x-4 z-50 ${inConversation ? 'hidden md:flex' : ''}`}>
        {/* Glassmorphism container with safe area padding */}
        <div className="relative isolate overflow-hidden w-full max-w-2xl mx-auto rounded-[26px] border border-white/80 dark:border-white/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.76),rgba(255,255,255,0.4)_50%,rgba(224,231,255,0.48))] dark:bg-[linear-gradient(135deg,rgba(17,24,39,0.84),rgba(30,41,59,0.64)_52%,rgba(49,46,129,0.44))] backdrop-blur-[26px] backdrop-saturate-[1.85] shadow-[0_-4px_34px_rgba(30,58,95,0.1),0_16px_40px_rgba(30,58,95,0.16),inset_0_1px_0_rgba(255,255,255,0.96)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.16)] before:absolute before:inset-px before:-z-10 before:rounded-[inherit] before:bg-[radial-gradient(circle_at_12%_0%,rgba(255,255,255,0.84),transparent_34%),radial-gradient(circle_at_88%_110%,rgba(99,102,241,0.16),transparent_36%)] dark:before:bg-[radial-gradient(circle_at_12%_0%,rgba(255,255,255,0.14),transparent_34%),radial-gradient(circle_at_88%_110%,rgba(129,140,248,0.2),transparent_36%)]">
          <div className="flex items-stretch justify-around px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]">
            {mobileNavItems.map((item) => {
              const active = isActive(item.to)
              const Icon = item.icon
              return (
                <Link
                  key={item.to}
                  href={item.to}
                  className="group relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-1"
                >
                  {/* Active pill background behind icon */}
                  <div className={`relative flex h-8 w-10 items-center justify-center rounded-2xl transition-all duration-300 sm:w-12 ${
                    active 
                      ? 'border border-white/75 dark:border-white/10 bg-white/60 dark:bg-indigo-500/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_4px_12px_rgba(79,70,229,0.12)]'
                      : 'border border-transparent group-active:border-white/60 group-active:bg-white/45 dark:group-active:bg-white/5'
                  }`}>
                    <Icon 
                      className={`h-5 w-5 transition-colors duration-200 sm:h-[22px] sm:w-[22px] ${
                        active 
                          ? 'text-indigo-600 dark:text-indigo-400' 
                          : 'text-gray-400 dark:text-gray-500'
                      }`}
                      strokeWidth={active ? 2.5 : 1.8}
                    />

                    {/* Notification badge */}
                    {item.badge !== undefined && item.badge > 0 && !estDansLaMessagerie && (
                      <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold shadow-md ring-2 ring-white dark:ring-[#111827]">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </div>

                  {/* Label */}
                  <span className={`max-w-full truncate text-[8px] font-semibold leading-tight transition-colors duration-200 sm:text-[10px] ${
                    active 
                      ? 'text-indigo-600 dark:text-indigo-400' 
                      : 'text-gray-400 dark:text-gray-500'
                  }`}>
                    {item.label}
                  </span>

                  {/* Active bar indicator */}
                  {active && (
                    <span className="absolute -bottom-1 w-5 h-[3px] rounded-full bg-indigo-600 dark:bg-indigo-400 shadow-[0_0_10px_rgba(79,70,229,0.6)]" />
                  )}
                </Link>
              )
            })}
          </div>
        </div>
      </nav>

      {/* Bottom spacer so page content doesn't hide behind the tab bar */}
      <div className={`xl:hidden h-[88px] ${
        isCentresRoute ? 'hidden' : (inConversation ? 'hidden md:block' : '')
      }`} />
      </>
          )}
        </ConversationAware>
      </Suspense>
    </>
  )
}
