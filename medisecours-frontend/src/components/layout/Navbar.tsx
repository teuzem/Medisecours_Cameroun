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
  Cross, Stethoscope, FolderOpen, Pill,
  Building2
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
  const { isAuthenticated, user, isAdmin, isEtablissement, logout } = useAuth()
  const { t } = useTranslation()
  const pathname = usePathname()
  const router = useRouter()
  const { unreadCount } = useUnreadCount()

  const estDansLaMessagerie = pathname.includes('/messages') || pathname.includes('/conversations') || pathname.includes('/medecin/messages')
  const isMapRoute = pathname === '/centres' || pathname === '/carte'

  const initials = user ? `${user.prenom?.[0] || ''}${user.nom?.[0] || ''}`.toUpperCase() : ''
  const isActive = (to: string) => (to === '/' ? pathname === '/' : pathname.startsWith(to))

  /* ─── Desktop links ─── */
  type NavLink = { to: string; label: string; icon: any; badge?: number }
  const publicLinks: NavLink[] = [
    { to: '/', label: t('visitor.nav.home'), icon: Home },
    { to: '/premiers-soins', label: t('visitor.nav.firstAid'), icon: Cross },
    { to: '/maladies', label: t('visitor.nav.orientation'), icon: Activity },
{ to: '/medecins', label: t('visitor.nav.doctors'), icon: Stethoscope },
    { to: '/carte', label: t('visitor.nav.carte'), icon: MapPin },
    { to: '/login', label: t('visitor.nav.login'), icon: UserCircle },
  ]

  const patientLinks: NavLink[] = [
    { to: '/', label: t('visitor.nav.home'), icon: Home },
    { to: '/patient/etablissements', label: t('visitor.nav.carte'), icon: Building2 },
    { to: '/premiers-soins', label: t('visitor.nav.firstAid'), icon: Cross },
    { to: '/maladies', label: t('visitor.nav.orientation'), icon: Activity },
    { to: '/medecins', label: t('visitor.nav.doctors'), icon: Stethoscope },
    { to: '/patient/consultations', label: t('visitor.nav.consultations'), icon: FileText },
    { to: '/carte', label: t('visitor.nav.carte'), icon: MapPin },
    { to: '/messages', label: t('visitor.nav.messaging'), icon: MessageCircle, badge: unreadCount },
  ]

  const etablissementLinks: NavLink[] = [
    { to: '/', label: t('visitor.nav.home'), icon: Home },
    { to: '/premiers-soins', label: t('visitor.nav.firstAid'), icon: Cross },
    { to: '/maladies', label: t('visitor.nav.orientation'), icon: Activity },
    { to: '/medecins', label: t('visitor.nav.doctors'), icon: Stethoscope },
    { to: '/carte', label: t('visitor.nav.carte'), icon: MapPin },
    { to: '/espace-etablissement', label: t('visitor.nav.establishment'), icon: Building2 },
  ]

  const activeLinks: NavLink[] = !isAuthenticated
    ? publicLinks
    : isAdmin
      ? publicLinks
      : isEtablissement
        ? etablissementLinks
        : patientLinks

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
    { to: '/carte', label: t('visitor.nav.carte'), icon: MapPin },
  ]

  const etablissementMobileNav: NavLink[] = [
    { to: '/', label: t('visitor.nav.home'), icon: Home },
    { to: '/premiers-soins', label: t('visitor.nav.firstAid'), icon: Cross },
    { to: '/carte', label: t('visitor.nav.carte'), icon: MapPin },
    { to: '/espace-etablissement', label: t('visitor.nav.establishmentShort'), icon: Building2 },
  ]

  const mobileNavItems: NavLink[] = !isAuthenticated
    ? publicMobileNav
    : isAdmin
      ? publicMobileNav
      : isEtablissement
        ? etablissementMobileNav
        : patientMobileNav

  return (
    <>
      {/* ══════════════════════════════════════════════════════════════════
       *  DESKTOP Floating Navbar (hidden on mobile/tablet)
       * ══════════════════════════════════════════════════════════════════ */}
      <div className="hidden xl:block fixed top-0 inset-x-0 z-50 border-b-2 border-primary-500 bg-white dark:border-primary-300 dark:bg-primary-900">
        <header className="mx-auto flex h-16 w-full max-w-[1500px] items-center gap-2 px-4">
          
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
                  className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-2 text-[12px] 2xl:text-[13px] font-semibold transition-colors ${
                    active
                      ? 'bg-primary-500 text-white dark:bg-mint-500 dark:text-primary-900'
                      : 'text-primary-600 hover:bg-primary-500/10 dark:text-primary-200 dark:hover:bg-white/10'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${active ? 'text-white dark:text-primary-900' : 'text-primary-400 dark:text-primary-300'}`} />
                  {l.label}
                  
                  {l.badge !== undefined && l.badge > 0 && !estDansLaMessagerie && (
                    <span className="ml-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-urgence-500 text-white text-[10px] font-bold shadow-sm animate-pulse">
                      {l.badge > 99 ? '99+' : l.badge}
                    </span>
                  )}
                </Link>
              )
            })}
            
            {isAdmin && (
              <Link
                href="/admin"
                className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-[12px] 2xl:text-[13px] font-semibold transition-colors ${
                  isActive('/admin')
                    ? 'bg-primary-500 text-white dark:bg-mint-500 dark:text-primary-900'
                    : 'text-primary-600 hover:bg-primary-500/10 dark:text-primary-200 dark:hover:bg-white/10'
                }`}
              >
                <Grid className="w-4 h-4" /> {t('visitor.nav.admin')}
              </Link>
            )}
          </nav>

          {/* Right: Actions */}
          <div className="flex shrink-0 items-center gap-1.5 pr-1">
            <LanguageSwitcher />
            {!isAuthenticated && (
              <button
                onClick={toggleDark}
                className="flex items-center justify-center w-9 h-9 border border-primary-500/30 text-primary-600 transition-colors hover:bg-primary-500/10 hover:text-primary-500 dark:border-white/20 dark:text-primary-200 dark:hover:bg-white/10"
                aria-label={t('visitor.nav.toggleTheme')}
              >
                {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            )}

            {isAuthenticated ? (
              <div className="flex items-center gap-2">
                <Link
                  href="/profil"
                  className="group relative flex items-center gap-2 pl-1 pr-3 py-1 border border-primary-500/30 text-primary-600 transition-colors hover:bg-primary-500/10 dark:border-white/20 dark:text-primary-100"
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
                  className="flex items-center justify-center w-9 h-9 border border-primary-500/30 text-primary-600 transition-colors hover:bg-urgence-500/10 hover:text-urgence-600 dark:border-white/20 dark:text-primary-200 dark:hover:bg-urgence-500/10 dark:hover:text-urgence-400"
                  aria-label={t('visitor.nav.logout')}
                  title={t('visitor.nav.logoutTitle')}
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="group flex items-center gap-2 px-5 py-2.5 bg-primary-500 text-white transition-colors hover:bg-primary-600 dark:bg-mint-500 dark:text-primary-900 dark:hover:bg-mint-400"
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
      <div className="xl:hidden fixed top-0 inset-x-0 z-50 border-b-2 border-primary-500 bg-white dark:border-primary-300 dark:bg-primary-900">
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
                className="flex h-8 w-8 items-center justify-center border border-primary-500/30 text-primary-600 transition-colors hover:bg-primary-500/10 dark:border-white/20 dark:text-primary-200 dark:hover:bg-white/10 sm:h-9 sm:w-9"
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
                    className={`relative flex h-8 w-8 items-center justify-center rounded-none border transition-colors sm:h-9 sm:w-9 ${
                      estDansLaMessagerie
                        ? 'border-primary-500 bg-primary-500 text-white dark:border-mint-500 dark:bg-mint-500 dark:text-primary-900'
                        : 'border-primary-500/30 text-primary-600 hover:bg-primary-500/10 dark:border-white/20 dark:text-primary-200 dark:hover:bg-white/10'
                    }`}
                    aria-label={unreadCount > 0 ? t('visitor.nav.unreadMessages', { count: unreadCount }) : t('visitor.nav.messagesAria')}
                  >
                    <MessageCircle className="h-4 w-4" />
                    {unreadCount > 0 && !estDansLaMessagerie && (
                      <span className="absolute -right-1 -top-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-urgence-500 px-1 text-[9px] font-bold text-white ring-2 ring-white dark:ring-slate-900">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </Link>
                )}
                <Link
                  href="/profil"
                  className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-primary-500/30 text-primary-600 transition-colors hover:bg-primary-500/10 dark:border-white/20 dark:text-primary-200 dark:hover:bg-white/10 sm:h-9 sm:w-9"
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
                  className="flex h-8 w-8 items-center justify-center border border-primary-500/30 text-primary-600 transition-colors hover:bg-urgence-500/10 hover:text-urgence-600 dark:border-white/20 dark:text-primary-200 dark:hover:bg-urgence-500/10 sm:h-9 sm:w-9"
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
      <nav className={`xl:hidden fixed bottom-0 inset-x-0 z-50 ${inConversation ? 'hidden md:flex' : ''}`}>
        {/* Flat protocol tab bar with safe area padding */}
        <div className="relative w-full max-w-2xl mx-auto border-t-2 border-primary-500 bg-white dark:border-primary-300 dark:bg-primary-900">
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
                  {/* Active indicator background behind icon */}
                  <div className={`relative flex h-8 w-10 items-center justify-center transition-colors duration-300 sm:w-12 ${
                    active 
                      ? 'bg-primary-500/10 dark:bg-mint-500/15'
                      : ''
                  }`}>
                    <Icon 
                      className={`h-5 w-5 transition-colors duration-200 sm:h-[22px] sm:w-[22px] ${
                        active 
                          ? 'text-primary-500 dark:text-mint-400' 
                          : 'text-primary-400 dark:text-primary-300'
                      }`}
                      strokeWidth={active ? 2.5 : 1.8}
                    />

                    {/* Notification badge */}
                    {item.badge !== undefined && item.badge > 0 && !estDansLaMessagerie && (
                      <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-urgence-500 text-white text-[10px] font-bold shadow-md ring-2 ring-white dark:ring-[#111827]">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </div>

                  {/* Label */}
                  <span className={`max-w-full truncate text-[8px] font-semibold leading-tight transition-colors duration-200 sm:text-[10px] ${
                    active 
                      ? 'text-primary-500 dark:text-mint-400' 
                      : 'text-primary-400 dark:text-primary-300'
                  }`}>
                    {item.label}
                  </span>

                  {/* Active bar indicator */}
                  {active && (
                    <span className="absolute -bottom-1 w-5 h-[3px] bg-mint-500" />
                  )}
                </Link>
              )
            })}
          </div>
        </div>
      </nav>

      {/* Bottom spacer so page content doesn't hide behind the tab bar */}
      <div className={`xl:hidden h-[88px] ${
        isMapRoute ? 'hidden' : (inConversation ? 'hidden md:block' : '')
      }`} />
      </>
          )}
        </ConversationAware>
      </Suspense>
    </>
  )
}
