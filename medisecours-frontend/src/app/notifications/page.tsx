'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import useSWR, { mutate as globalMutate } from 'swr'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, MessageSquare, ArrowRight, Clock } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../components/ui/Toast'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import EmptyState from '../../components/ui/EmptyState'
import api from '../../api/axios'
import { fetcher } from '../../lib/fetcher'
import { NOTIFICATIONS_KEY, UNREAD_NOTIFICATIONS_KEY } from '../../lib/keys'
import { useTranslation } from 'react-i18next'

interface NotificationRecord {
  id: number
  type: string
  title: string
  body?: string | null
  link?: string | null
  createdAt: string
  readAt?: string | null
}

function timeAgo(dateString, t) {
  if (!dateString) return ''
  const diff = Date.now() - new Date(dateString).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return t('visitor.notifications.justNow')
  if (minutes < 60) return t('visitor.notifications.minutesAgo', { count: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('visitor.notifications.hoursAgo', { count: hours })
  const days = Math.floor(hours / 24)
  if (days < 30) return t('visitor.notifications.daysAgo', { count: days })
  return t('visitor.notifications.monthsAgo', { count: Math.floor(days / 30) })
}

const stagger = { animate: { transition: { staggerChildren: 0.05 } } }
const itemFade = {
  initial: { opacity: 0, y: 12, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring' as const, damping: 22, stiffness: 320, mass: 0.9 } },
}

export default function NotificationsPage() {
  const { t } = useTranslation()
  const { user, mounted } = useAuth()
  const router = useRouter()
  const toast = useToast()
  const { data, error, isLoading, mutate } = useSWR<NotificationRecord[]>(
    user ? NOTIFICATIONS_KEY : null,
    fetcher,
    { revalidateOnFocus: true },
  )
  const notifications = useMemo(
    () => (Array.isArray(data) ? data : []).filter((notification) => (
      notification.type !== 'message_received' || !notification.readAt
    )),
    [data],
  )

  const notificationItems = useMemo(() => {
    const items = []
    for (const notification of notifications) {
      items.push({
        id: notification.id,
        title: notification.title,
        description: notification.body || '',
        time: notification.createdAt,
        unread: !notification.readAt,
        link: notification.link || '/notifications',
        type: notification.type,
      })
    }
    items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    return items
  }, [notifications])

  const unreadCount = useMemo(() => notificationItems.filter(n => n.unread).length, [notificationItems])

  if (!mounted || isLoading) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <LoadingSpinner label={t('visitor.notifications.loading')} />
    </div>
  )

  return (
    <div className="mx-auto max-w-3xl px-4 pb-12 pt-6 sm:px-6 sm:pt-8">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', damping: 20, stiffness: 300 }} className="mb-8">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#3B6EF8]/10">
            <Bell className="h-6 w-6 text-[#3B6EF8]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#0F2C52]">{t('visitor.notifications.title')}</h1>
            <p className="mt-0.5 text-sm text-[#6B7280]">
              {unreadCount > 0
                ? t('visitor.notifications.unreadCount', { count: unreadCount })
                : t('visitor.notifications.allCaughtUp')}
            </p>
          </div>
        </div>
      </motion.div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-6 text-center dark:border-red-900/50 dark:bg-red-950/30">
          <p className="text-sm font-medium text-red-700 dark:text-red-300">
            {t('visitor.notifications.errorLoad')}
          </p>
          <button
            type="button"
            onClick={() => mutate()}
            className="mt-3 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-red-700 shadow-sm dark:bg-slate-900 dark:text-red-300"
          >
            {t('visitor.notifications.retry')}
          </button>
        </div>
      ) : notificationItems.length === 0 ? (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, type: 'spring', damping: 20, stiffness: 300 }}>
          <EmptyState icon={Bell} title={t('visitor.notifications.emptyTitle')} description={t('visitor.notifications.emptyDesc')} />
        </motion.div>
      ) : (
        <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-1.5">
          <AnimatePresence mode="popLayout">
            {notificationItems.map(n => (
              <motion.div key={n.id} layout variants={itemFade} exit={{ opacity: 0, scale: 0.95, y: -8, transition: { duration: 0.15 } }}>
                <button
                  onClick={async () => {
                    if (n.unread) {
                      const readAt = new Date().toISOString()
                      try {
                        await api.patch(`/api/notifications/${n.id}`, { readAt }, {
                          headers: { 'Content-Type': 'application/merge-patch+json' },
                        })
                        await mutate(
                          (current) => current?.map((item) => (
                            item.id === n.id ? { ...item, readAt } : item
                          )),
                          { revalidate: false },
                        )
                        globalMutate(
                          UNREAD_NOTIFICATIONS_KEY,
                          (current: { unreadCount?: number } | undefined) => ({
                            unreadCount: Math.max(0, Number(current?.unreadCount || 0) - 1),
                          }),
                          { revalidate: false },
                        )
                      } catch {
                        toast.error(t('visitor.notifications.errorMarkRead'))
                      }
                    }
                    router.push(n.link)
                  }}
                  className={`group relative flex w-full items-start gap-4 rounded-2xl p-4 text-left transition-all active:scale-[0.98] ${
                    n.unread ? 'bg-[#F0F4FF] shadow-sm shadow-blue-500/5' : 'bg-white hover:bg-[#F9FAFB]'
                  }`}
                  style={{ transition: 'transform 0.1s ease-out, background 0.2s ease-out' }}
                >
                  {n.unread && <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-[#3B6EF8]" />}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[rgba(59,110,248,0.12)] backdrop-blur-sm">
                    <MessageSquare className="h-5 w-5 text-[#3B6EF8]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm ${n.unread ? 'font-bold text-[#0F2C52]' : 'font-semibold text-[#374151]'}`}>{n.title}</p>
                      <span className="flex shrink-0 items-center gap-1 text-[11px] text-[#9CA3AF]">
                        <Clock className="h-3 w-3" />
                        {timeAgo(n.time, t)}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-[#6B7280] dark:text-slate-300">
                      {n.description || t('visitor.notifications.fallbackDesc')}
                    </p>
                    <span className="mt-2 inline-flex text-xs font-semibold text-[#315FD6] dark:text-blue-300">
                      {n.type === 'message_received' ? t('visitor.notifications.viewConversation') : t('visitor.notifications.viewDetails')}
                    </span>
                  </div>
                  <ArrowRight className="mt-2 h-4 w-4 shrink-0 text-[#D1D5DB] transition group-hover:text-[#3B6EF8] group-hover:translate-x-0.5" style={{ transition: 'color 0.2s, transform 0.2s' }} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  )
}
