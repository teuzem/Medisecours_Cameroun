'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import {
  HeartPulse, LayoutDashboard, Users, CalendarClock, MessageCircle,
  BarChart3, Bell, Settings, LogOut, Pill, ClipboardCheck,
  ChevronRight, CircleHelp, Stethoscope,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import Avatar from '../ui/Avatar'
import { useNotification } from '../../contexts/NotificationContext'

const NAV_GROUPS = [
  {
    labelKey: 'medecin.sidebar.workspace',
    items: [
      { href: '/medecin', labelKey: 'medecin.sidebar.overview', icon: LayoutDashboard, exact: true },
    ],
  },
  {
    labelKey: 'medecin.sidebar.medicalTracking',
    items: [
      { href: '/medecin/patients', labelKey: 'medecin.sidebar.myPatients', icon: Users },
      { href: '/medecin/consultations', labelKey: 'medecin.sidebar.consultations', icon: CalendarClock, badge: 'consultations' },
      { href: '/medecin/rapports', labelKey: 'medecin.sidebar.reports', icon: BarChart3 },
    ],
  },
  {
    labelKey: 'medecin.sidebar.communication',
    items: [
      { href: '/medecin/messages', labelKey: 'medecin.sidebar.messages', icon: MessageCircle, badge: 'unread' },
      { href: '/medecin/notifications', labelKey: 'medecin.sidebar.notifications', icon: Bell, badge: 'notifications' },
    ],
  },
  {
    labelKey: 'medecin.sidebar.resources',
    items: [
      { href: '/medecin/prescriptions', labelKey: 'medecin.sidebar.prescriptions', icon: ClipboardCheck },
      { href: '/medecin/pharmacy', labelKey: 'medecin.sidebar.pharmacy', icon: Pill },
      { href: '/medecin/avis', labelKey: 'medecin.sidebar.patientReviews', icon: MessageCircle },
    ],
  },
]

export default function MedecinSidebar({ setMobileOpen }: { setMobileOpen: (open: boolean) => void }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()
  const { unreadCount, pendingConsultationCount, notificationCount } = useNotification()
  const { t } = useTranslation()

  const estSurLaPageMessages = pathname.startsWith('/medecin/messages')

  // NOTE (bug C5 corrigé) : on ne marque PLUS tous les messages comme lus à l'entrée
  // de la page Messages. Cela effaçait les messages urgents non ouverts, y compris
  // ceux des conversations non visualisées. Le marquage "lu" est désormais géré par
  // la page messages elle-même, uniquement pour la conversation réellement ouverte.

  // On cache juste le badge en local tant qu'on est sur la page (le compteur réel
  // est recalculé via le WebSocket / la navigation). Aucune mutation BDD ici.
  const displayUnread = estSurLaPageMessages ? 0 : unreadCount

  const isActive = (href: string, exact: boolean) => (exact ? pathname === href : pathname.startsWith(href))

  const renderBadge = (badgeType: string | undefined) => {
    if (badgeType === 'unread' && displayUnread > 0) {
      return (
        <span className="dashboard-sidebar-badge dashboard-sidebar-badge-danger">
          {displayUnread > 99 ? '99+' : displayUnread}
        </span>
      )
    }
    if (badgeType === 'consultations' && pendingConsultationCount > 0) {
      return (
        <span className="dashboard-sidebar-badge dashboard-sidebar-badge-warning">
          {pendingConsultationCount > 99 ? '99+' : pendingConsultationCount}
        </span>
      )
    }
    if (badgeType === 'notifications' && notificationCount > 0) {
      return (
        <span className="dashboard-sidebar-badge dashboard-sidebar-badge-danger">
          {notificationCount > 99 ? '99+' : notificationCount}
        </span>
      )
    }
    return null
  }

  return (
    <aside className="dashboard-sidebar flex h-full flex-col">
      <div className="dashboard-sidebar-brand">
        <div className="dashboard-sidebar-mark">
          <HeartPulse className="h-[18px] w-[18px]" strokeWidth={2.2} />
        </div>
        <div className="min-w-0">
          <p className="dashboard-sidebar-wordmark">MediSecours<span>+</span></p>
          <p className="dashboard-sidebar-caption">{t('medecin.sidebar.professionalSpace')}</p>
        </div>
      </div>

      <div className="dashboard-sidebar-status">
        <span className="dashboard-sidebar-status-dot" />
        <span>{t('medecin.sidebar.operational')}</span>
        <Stethoscope className="ml-auto h-3.5 w-3.5" />
      </div>

      <nav className="dashboard-sidebar-nav flex-1">
        {NAV_GROUPS.map((group) => (
          <div key={group.labelKey} className="dashboard-sidebar-group">
            <p className="dashboard-sidebar-section-label">{t(group.labelKey)}</p>
            <div className="space-y-1">
              {group.items.map(({ href, labelKey, icon: Icon, exact, badge }) => {
                const active = isActive(href, exact ?? false)
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileOpen?.(false)}
                    aria-current={active ? 'page' : undefined}
                    className={`dashboard-sidebar-link ${active ? 'dashboard-sidebar-link-active' : ''}`}
                  >
                    <span className="dashboard-sidebar-link-icon">
                      <Icon className="h-[17px] w-[17px]" strokeWidth={active ? 2.4 : 2} />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{t(labelKey)}</span>
                    {renderBadge(badge)}
                    {active && <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="dashboard-sidebar-help">
        <div className="flex items-start gap-3">
          <div className="dashboard-sidebar-help-icon">
            <CircleHelp className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="dashboard-sidebar-help-title">{t('medecin.sidebar.needHelp')}</p>
            <p className="dashboard-sidebar-help-copy">
              {t('medecin.sidebar.helpCopy')}
            </p>
            <Link
              href="/medecin/guide-utilisation"
              onClick={() => setMobileOpen?.(false)}
              className="dashboard-sidebar-help-link"
            >
              {t('medecin.sidebar.openGuide')} <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>

      <div className="dashboard-sidebar-account">
        <div className="dashboard-sidebar-account-row">
          <Avatar name={`${user?.prenom || ''} ${user?.nom || ''}`} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              Dr {user?.prenom} {user?.nom}
            </p>
            <p className="dashboard-sidebar-account-role">
              {user?.specialite || t('medecin.sidebar.doctorRole')}
            </p>
          </div>
          <Link
            href="/medecin/profil"
            onClick={() => setMobileOpen?.(false)}
            className="dashboard-sidebar-account-settings"
            aria-label={t('medecin.sidebar.profileTitle')}
            title={t('medecin.sidebar.profileTitle')}
          >
            <Settings className="h-4 w-4" />
          </Link>
        </div>
        <button
          onClick={() => { logout(); router.push('/') }}
          className="dashboard-sidebar-logout"
        >
          <LogOut className="h-4 w-4" />
          {t('medecin.sidebar.logout')}
        </button>
      </div>
    </aside>
  )
}
