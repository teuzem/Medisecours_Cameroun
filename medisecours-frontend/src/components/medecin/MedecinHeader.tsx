'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Search, ChevronDown, User, Loader2, Stethoscope, Building2, Activity, MessageCircle, Bell, MessageSquare, Clock, LogOut } from 'lucide-react'
import Avatar from '../ui/Avatar'
import CertifiedBadge from '../ui/CertifiedBadge'
import { useAuth } from '../../hooks/useAuth'
import api from '../../api/axios'
import { imgUrl } from '../../lib/config'
import { useNotification } from '../../contexts/NotificationContext'
import DashboardThemeToggle from '../ui/DashboardThemeToggle'
import LanguageSwitcher from '../ui/LanguageSwitcher'

type SearchCategory = 'patients' | 'consultations' | 'messages' | 'maladies' | 'centres'

interface SearchItem {
  id: string | number
  nom?: string
  prenom?: string
  telephone?: string
  email?: string
  motif?: string
  statut?: string
  patient_nom?: string
  patient_prenom?: string
  contenu?: string
  expediteur_nom?: string
  expediteur_prenom?: string
  createdAt?: string
  niveauGravite?: string
  urgence?: boolean
  type?: string
  ville?: string
}

interface SearchResults {
  patients?: SearchItem[]
  consultations?: SearchItem[]
  messages?: SearchItem[]
  maladies?: SearchItem[]
  centres?: SearchItem[]
}

const CATEGORY_CONFIG: Record<SearchCategory, { labelKey: string; icon: React.ElementType; color: string; href: (item: SearchItem) => string }> = {
  patients: {
    labelKey: 'medecin.header.catPatients',
    icon: User,
    color: '#3B6EF8',
    href: (item) => `/medecin/patients?id=${item.id}`,
  },
  consultations: {
    labelKey: 'medecin.header.catConsultations',
    icon: Stethoscope,
    color: '#F59E0B',
    href: (item) => `/medecin/consultations?id=${item.id}`,
  },
  messages: {
    labelKey: 'medecin.header.catMessages',
    icon: MessageCircle,
    color: '#10B981',
    href: (item) => `/medecin/messages?id=${item.id}`,
  },
  maladies: {
    labelKey: 'medecin.header.catMaladies',
    icon: Activity,
    color: '#EF4444',
    href: (item) => `/maladies/${item.id}`,
  },
  centres: {
    labelKey: 'medecin.header.catCentres',
    icon: Building2,
    color: '#8B5CF6',
    href: () => `/centres`,
  },
}

function timeAgo(dateString: string, t: TFunction) {
  if (!dateString) return ''
  const diff = Date.now() - new Date(dateString).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return t('medecin.header.justNow')
  if (minutes < 60) return t('medecin.header.minutesAgo', { count: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('medecin.header.hoursAgo', { count: hours })
  const days = Math.floor(hours / 24)
  if (days < 30) return t('medecin.header.daysAgo', { count: days })
  return t('medecin.header.monthsAgo', { count: Math.floor(days / 30) })
}

export default function MedecinHeader() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const { t } = useTranslation()
  const estSurPageNotifications = pathname?.includes('/medecin/notifications')
  const {
    notifications, notifLoading, notifOpen, notificationCount, msgDisplayCount,
    msgNotifications, msgLoading, msgOpen,
    openNotif, dismissNotif, clearAllNotifications, closeNotif,
    openMsg, dismissMsg, closeMsg,
  } = useNotification()

  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [showResults, setShowResults] = useState(false)
  const [results, setResults] = useState<SearchResults | null>(null)
  const [loading, setLoading] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  const searchRef = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)
  const msgRef = useRef<HTMLDivElement>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<NodeJS.Timeout>(undefined as any)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedQuery(searchQuery), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [searchQuery])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowResults(false)
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false)
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) closeNotif()
      if (msgRef.current && !msgRef.current.contains(e.target as Node)) closeMsg()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [closeNotif, closeMsg])

  useEffect(() => {
    const q = debouncedQuery.trim()
    if (q.length < 2) return
    let cancelled = false
    api.get<SearchResults>('/api/search', { params: { q } })
      .then(({ data }) => {
        if (!cancelled) {
          setResults(data)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResults(null)
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [debouncedQuery])

  const hasResults = results && Object.values(results).some((arr) => arr && arr.length > 0)

  const handleSelect = useCallback((category: SearchCategory, item: SearchItem) => {
    router.push(CATEGORY_CONFIG[category].href(item))
    setShowResults(false)
    setSearchQuery('')
  }, [router])

  const photoUrl = user?.photoProfil ? imgUrl(user.photoProfil) : null

  return (
    <div className="flex items-center gap-3">
      {/* Global search */}
      <div ref={searchRef} className="relative hidden sm:block">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => {
            const value = e.target.value
            setSearchQuery(value)
            setShowResults(true)
            if (value.trim().length < 2) {
              setResults(null)
              setLoading(false)
            } else {
              setLoading(true)
            }
          }}
          onFocus={() => setShowResults(true)}
          placeholder={t('medecin.header.searchPlaceholder')}
          className="w-[320px] xl:w-[420px] rounded-full bg-[#F3F4F6] py-2 pl-10 pr-4 text-sm text-[#374151] placeholder-[#9CA3AF] outline-none transition focus:bg-white focus:ring-2 focus:ring-[#3B6EF8]/20"
        />
        {showResults && debouncedQuery.trim().length >= 2 && (
          <div className="absolute right-0 top-full mt-2 w-full min-w-[360px] rounded-xl border border-[#E5E7EB] bg-white shadow-lg max-h-[70vh] overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-[#9CA3AF]">
                <Loader2 className="h-4 w-4 animate-spin" /> {t('medecin.header.searching')}
              </div>
            )}
            {!loading && hasResults && (
              (Object.entries(CATEGORY_CONFIG) as [SearchCategory, typeof CATEGORY_CONFIG[SearchCategory]][])
                .filter(([key]) => results![key] && results![key]!.length > 0)
                .map(([key, config]) => (
                  <div key={key}>
                    <div className="sticky top-0 bg-white z-10 px-4 py-1.5 border-b border-[#E5E7EB] flex items-center gap-2">
                      <config.icon className="h-3.5 w-3.5" style={{ color: config.color }} />
                      <span className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: config.color }}>{t(config.labelKey)}</span>
                      <span className="ml-auto text-[10px] text-[#9CA3AF]">{results![key]!.length}</span>
                    </div>
                    {results![key]!.map((item) => (
                      <button
                        key={`${key}-${item.id}`}
                        onClick={() => handleSelect(key, item)}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-[#374151] hover:bg-[#F3F4F6] transition border-b border-[#F3F4F6] last:border-0"
                      >
                        <Avatar name={`${item.prenom || item.nom || item.motif || ''}`} size="sm" />
                        <div className="min-w-0 flex-1">
                          {key === 'patients' && (
                            <>
                              <p className="font-medium truncate">{item.prenom} {item.nom}</p>
                              <p className="text-xs text-[#9CA3AF] truncate">{item.telephone || item.email}</p>
                            </>
                          )}
                          {key === 'consultations' && (
                            <>
                              <p className="font-medium truncate">{item.motif || t('medecin.header.noMotif')}</p>
                              <p className="text-xs text-[#9CA3AF] truncate">
                                {item.patient_prenom} {item.patient_nom} · <span className={`inline-block w-2 h-2 rounded-full ${item.statut === 'TERMINEE' ? 'bg-green-500' : item.statut === 'EN_COURS' ? 'bg-yellow-500' : item.statut === 'ANNULEE' ? 'bg-red-500' : 'bg-blue-500'}`} /> {item.statut?.toLowerCase()}
                              </p>
                            </>
                          )}
                          {key === 'messages' && (
                            <>
                              <p className="font-medium truncate">{item.expediteur_prenom} {item.expediteur_nom}</p>
                              <p className="text-xs text-[#9CA3AF] truncate">{item.contenu}</p>
                            </>
                          )}
                          {key === 'maladies' && (
                            <>
                              <p className="font-medium truncate">{item.nom}</p>
                              <p className="text-xs text-[#9CA3AF] truncate">
                                {item.niveauGravite} {item.urgence ? ` · ${t('medecin.header.urgency')}` : ''}
                              </p>
                            </>
                          )}
                          {key === 'centres' && (
                            <>
                              <p className="font-medium truncate">{item.nom}</p>
                              <p className="text-xs text-[#9CA3AF] truncate">{item.ville} · {item.type}</p>
                            </>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                ))
            )}
            {!loading && debouncedQuery.trim().length >= 2 && results && !hasResults && (
              <div className="px-4 py-6 text-center text-sm text-[#9CA3AF]">
                {t('medecin.header.noResults', { query: debouncedQuery })}
              </div>
            )}
          </div>
        )}
        {showResults && debouncedQuery.trim().length > 0 && debouncedQuery.trim().length < 2 && (
          <div className="absolute right-0 top-full mt-2 w-full min-w-[320px] rounded-xl border border-[#E5E7EB] bg-white shadow-lg">
            <div className="px-4 py-6 text-center text-sm text-[#9CA3AF]">{t('medecin.header.minChars')}</div>
          </div>
        )}
      </div>

      <DashboardThemeToggle />

      <LanguageSwitcher />

      {/* Notification icon + dropdown */}
      <div ref={notifRef} className="relative">
        <button
          onClick={openNotif}
          className={`relative flex h-10 w-10 items-center justify-center rounded-xl transition ${notifOpen ? 'bg-[#F0F4FF]' : 'hover:bg-[#F3F4F6]'}`}
          aria-label={t('medecin.header.notifications')}
        >
          <Bell className={`h-5 w-5 ${notifOpen ? 'text-[#3B6EF8]' : 'text-[#6B7280]'}`} />
          {!estSurPageNotifications && notificationCount > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#EF4444] px-1 text-[10px] font-bold leading-none text-white">
              {notificationCount > 99 ? '99+' : notificationCount}
            </span>
          )}
        </button>
        {notifOpen && (
          <div className="absolute right-0 top-full mt-2 w-[380px] origin-top-right rounded-xl border border-[#E5E7EB] bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] px-4 py-3">
              <h3 className="text-sm font-bold text-[#0F2C52]">{t('medecin.header.notifications')}</h3>
              <div className="flex items-center gap-3">
                {notifications.some(n => n.unread) && (
                  <button
                    onClick={() => clearAllNotifications()}
                    className="text-xs font-semibold text-[#3B6EF8] hover:underline"
                  >
                    {t('medecin.header.markAllRead')}
                  </button>
                )}
                <button
                  onClick={() => { closeNotif(); router.push('/medecin/notifications') }}
                  className="text-xs font-semibold text-[#3B6EF8] hover:underline"
                >
                  {t('medecin.header.seeAll')}
                </button>
              </div>
            </div>
            <div className="max-h-[360px] overflow-y-auto">
              {notifLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-[#3B6EF8]" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <Bell className="mx-auto mb-2 h-8 w-8 text-[#D1D5DB]" />
                  <p className="text-sm text-[#9CA3AF]">{t('medecin.header.noNotifications')}</p>
                </div>
              ) : (
                <div className="py-1">
                  {notifications.slice(0, 10).map((n) => (
                    <button
                      key={n.id}
                      onClick={() => dismissNotif(n.id, n.href)}
                      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-[#F9FAFB] ${n.unread ? 'bg-[#F0F4FF]/50' : ''}`}
                    >
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${n.type === 'message' ? 'bg-[rgba(59,110,248,0.12)]' : 'bg-[rgba(245,158,11,0.12)]'}`}>
                        <MessageSquare className={`h-4 w-4 ${n.type === 'message' ? 'text-[#3B6EF8]' : 'text-[#D97706]'}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`truncate text-sm ${n.unread ? 'font-bold text-[#0F2C52]' : 'font-medium text-[#374151]'}`}>{n.title}</p>
                          <span className="flex shrink-0 items-center gap-1 text-[10px] text-[#9CA3AF]">
                            <Clock className="h-3 w-3" />
                            {timeAgo(n.time, t)}
                          </span>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-[#6B7280]">
                          {n.description || t('medecin.header.newInfo')}
                        </p>
                        <span className="mt-1 inline-flex text-[11px] font-semibold text-[#315FD6]">
                          {n.type === 'message' ? t('medecin.header.viewConversation') : t('medecin.header.viewDetails')}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Profile */}
      <div ref={profileRef} className="relative">
        <button
          onClick={() => setProfileOpen(!profileOpen)}
          className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition hover:bg-[#F3F4F6]"
        >
          <Avatar name={`${user?.prenom || ''} ${user?.nom || ''}`} size="sm" src={photoUrl} />
          <div className="hidden text-left sm:block">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold text-[#0F2C52]">
                Dr. {user?.prenom} {user?.nom}
              </p>
              {user?.estValide && <CertifiedBadge className="h-4 w-4" />}
            </div>
            <p className="text-xs text-[#6B7280]">Médecin</p>
          </div>
          <ChevronDown className="hidden h-4 w-4 text-[#6B7280] sm:block" />
        </button>
        {profileOpen && (
          <div className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-[#E5E7EB] bg-white shadow-lg overflow-hidden">
            <div className="border-b border-[#E5E7EB] px-4 py-3 sm:hidden">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-semibold text-[#0F2C52]">Dr. {user?.prenom} {user?.nom}</p>
                {user?.estValide && <CertifiedBadge className="h-4 w-4" />}
              </div>
              <p className="text-xs text-[#6B7280]">{t('medecin.header.doctor')}</p>
            </div>
            <button
              onClick={() => { router.push('/medecin/profil'); setProfileOpen(false) }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-[#374151] hover:bg-[#F3F4F6] transition"
            >
              <User className="h-4 w-4 text-[#9CA3AF]" /> {t('medecin.header.profile')}
            </button>
            <div className="border-t border-[#E5E7EB]" />
            <button
              onClick={() => { logout(); router.push('/login'); setProfileOpen(false) }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-[#DC2626] hover:bg-[#FEF2F2] transition"
            >
              <LogOut className="h-4 w-4" /> {t('medecin.header.logout')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
