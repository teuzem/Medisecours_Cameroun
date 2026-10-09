'use client'

/**
 * NotificationContext — MediSecours+
 *
 * Architecture "Optimistic Update + Persist" :
 * - Les compteurs de messages et de notifications ont chacun leur endpoint SWR.
 * - Le WebSocket revalide les notifications persistées après un nouveau message.
 * - Les dropdowns (notifications, messages) fetchent leurs données ON DEMAND au clic.
 * - Aucun double-write entre WebSocket et SWR → plus de désynchronisation.
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../hooks/useAuth'
import { useUnreadCount } from '../hooks/useUnreadCount'
import { useConsultationCount } from '../hooks/useConsultationCount'
import { useWebSocket } from '../hooks/useWebSocket'
import useSWR, { mutate as globalMutate } from 'swr'
import api from '../api/axios'
import SosSireneBanner from '../components/ui/SosSireneBanner'
import i18n, { changeLanguage } from '../i18n'
import {
  CONVERSATIONS_KEY,
  NOTIFICATIONS_KEY,
  UNREAD_MESSAGES_KEY,
  UNREAD_NOTIFICATIONS_KEY,
} from '../lib/keys'

const rawFetcher = async (url: string) => {
  const res = await api.get(url)
  return res.data
}

export interface NotifItem {
  id: string
  type: 'message' | 'consultation_open' | 'consultation_closed' | 'consultation_accepted' | 'notification'
  title: string
  description: string
  time: string
  unread: boolean
  href: string
  sender?: any
}

interface NotificationContextValue {
  notifications: NotifItem[]
  notifLoading: boolean
  unreadCount: number
  consultationCount: number
  pendingConsultationCount: number
  notificationCount: number
  openNotif: () => Promise<void>
  dismissNotif: (id: string, href?: string) => Promise<void>
  clearAllNotifications: () => Promise<void>
  closeNotif: () => void
  notifOpen: boolean
  msgNotifications: NotifItem[]
  msgLoading: boolean
  msgOpen: boolean
  openMsg: () => Promise<void>
  dismissMsg: (id: string, href?: string) => Promise<void>
  markConversationAsRead: (convId: string) => Promise<void>
  closeMsg: () => void
  msgDisplayCount: number
  activeConversationId: string | null
  setActiveConversationId: (id: string | null) => void
  subscribeToMessages: (handler: (msg: any) => void) => () => void
  subscribeToProfileChanges: (handler: (data: any) => void) => () => void
  onlineUsers: Set<string>
  sosAlerte: any | null
  sireneActivee: boolean
  couperSirene: () => void
  dismissSosAlerte: () => void
  subscribeToSos: (handler: (type: string, payload: any) => void) => () => void
}

const NotificationCtx = createContext<NotificationContextValue>(null!)

function msgHref(convId: string | number, user: any): string {
  const base = user?.roles?.includes('ROLE_MEDECIN') ? '/medecin' : '/patient'
  return `${base}/messages?conversation=${convId}`
}

function notificationHref(link: string | null | undefined, user: any): string {
  if (!link) {
    return user?.roles?.includes('ROLE_MEDECIN')
      ? '/medecin/notifications'
      : '/notifications'
  }
  if (link.startsWith('/messages')) {
    const base = user?.roles?.includes('ROLE_MEDECIN') ? '/medecin' : '/patient'
    return `${base}/messages${link.slice('/messages'.length)}`
  }
  return link
}

function conversationIdFromHref(href: string | null | undefined): string | null {
  if (!href) return null
  try {
    const url = new URL(href, 'https://medisecours.local')
    return url.searchParams.get('conversation')
  } catch {
    return href.match(/[?&]conversation=([^&]+)/)?.[1] ?? null
  }
}

function notificationToItem(notification: any, user: any): NotifItem {
  const type = notification.type === 'message_received'
    ? 'message'
    : notification.type === 'consultation_accepted'
      ? 'consultation_accepted'
      : notification.type === 'consultation_closed'
        ? 'consultation_closed'
        : 'notification'

  return {
    id: `notif-${notification.id}`,
    type,
    title: notification.title || i18n.t('common.notifications.fallbackTitle'),
    description: notification.body || i18n.t('common.notifications.fallbackBody'),
    time: notification.createdAt,
    unread: !notification.readAt,
    href: notificationHref(notification.link, user),
  }
}

function msgToItem(m: any, rawId: (v: any) => any, user?: any): NotifItem {
  return {
    id: `msg-${m.id}`,
    type: 'message' as const,
    title: m.contenu?.slice(0, 80) || i18n.t('common.notifications.messageFallback'),
    description: m.contenu?.slice(0, 80) || i18n.t('common.notifications.messageFallback'),
    time: m.createdAt,
    unread: true,
    href: msgHref(rawId(m.conversation), user),
    sender: typeof m.expediteur === 'object' ? m.expediteur : null,
  }
}

/** Extrait les messages non lus d'une réponse API (hydra:member ou tableau brut). */
function extractMsgs(data: any): any[] {
  return data?.['hydra:member'] ?? data?.member ?? (Array.isArray(data) ? data : [])
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user, token } = useAuth()
  const { unreadCount } = useUnreadCount()
  const { consultationCount: openConsultationCount } = useConsultationCount()
  const router = useRouter()

  // ── Compteur de notifications persistées ───────────────────────────────
  const { data: notificationCountData } = useSWR(
    user ? UNREAD_NOTIFICATIONS_KEY : null,
    rawFetcher,
    { revalidateOnFocus: true }
  )
  const pendingConsultationCount = openConsultationCount

  // ── États dropdown ─────────────────────────────────────────────────────
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifLoading, setNotifLoading] = useState(false)
  const [notifications, setNotifications] = useState<NotifItem[]>([])

  const [msgOpen, setMsgOpen] = useState(false)
  const [msgLoading, setMsgLoading] = useState(false)
  const [msgItems, setMsgItems] = useState<NotifItem[]>([])

  // ── Event Bus WebSocket ────────────────────────────────────────────────
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set())
  const messageHandlers = React.useRef<((msg: any) => void)[]>([])
  const profileChangeHandlers = React.useRef<((data: any) => void)[]>([])
  const receivedMessageIds = React.useRef<Set<string>>(new Set())
  const conversationReadRequests = React.useRef<Map<string, Promise<void>>>(new Map())

  const subscribeToMessages = useCallback((handler: (msg: any) => void) => {
    messageHandlers.current.push(handler)
    return () => {
      messageHandlers.current = messageHandlers.current.filter((h) => h !== handler)
    }
  }, [])

  const subscribeToProfileChanges = useCallback((handler: (data: any) => void) => {
    profileChangeHandlers.current.push(handler)
    return () => {
      profileChangeHandlers.current = profileChangeHandlers.current.filter((h) => h !== handler)
    }
  }, [])

  // ── État SOS temps réel (postes de l'établissement + répondants) ────────
  const [sosAlerte, setSosAlerte] = useState<any | null>(null)
  const [sireneActivee, setSireneActivee] = useState(false)
  const sosHandlers = React.useRef<((type: string, payload: any) => void)[]>([])
  const audioCtxRef = React.useRef<AudioContext | null>(null)
  const sirenNodesRef = React.useRef<{ osc: OscillatorNode; lfo: OscillatorNode; gain: GainNode } | null>(null)

  const subscribeToSos = useCallback((handler: (type: string, payload: any) => void) => {
    sosHandlers.current.push(handler)
    return () => {
      sosHandlers.current = sosHandlers.current.filter((h) => h !== handler)
    }
  }, [])

  const getAudioCtx = useCallback((): AudioContext | null => {
    if (typeof window === 'undefined') return null
    try {
      const Ctor = window.AudioContext || (window as any).webkitAudioContext
      if (!Ctor) return null
      if (!audioCtxRef.current) audioCtxRef.current = new Ctor()
      if (audioCtxRef.current.state === 'suspended') void audioCtxRef.current.resume()
      return audioCtxRef.current
    } catch {
      return null
    }
  }, [])

  /** Bip court d'alerte (création d'alerte : notification, pas sirène). */
  const playChime = useCallback(() => {
    const ctx = getAudioCtx()
    if (!ctx) return
    try {
      const now = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(660, now)
      osc.frequency.setValueAtTime(880, now + 0.18)
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(0.08, now + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.55)
    } catch { /* audio indisponible */ }
  }, [getAudioCtx])

  const startSiren = useCallback(() => {
    if (sirenNodesRef.current) return
    const ctx = getAudioCtx()
    if (!ctx) return
    try {
      const osc = ctx.createOscillator()
      osc.type = 'square'
      osc.frequency.value = 640
      const lfo = ctx.createOscillator()
      lfo.type = 'sine'
      lfo.frequency.value = 1.7
      const lfoGain = ctx.createGain()
      lfoGain.gain.value = 260
      const gain = ctx.createGain()
      gain.gain.value = 0.05
      lfo.connect(lfoGain)
      lfoGain.connect(osc.frequency)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      lfo.start()
      sirenNodesRef.current = { osc, lfo, gain }
      setSireneActivee(true)
    } catch { /* audio indisponible */ }
  }, [getAudioCtx])

  const stopSiren = useCallback(() => {
    const nodes = sirenNodesRef.current
    const ctx = audioCtxRef.current
    if (!nodes) {
      setSireneActivee(false)
      return
    }
    try {
      if (ctx) {
        nodes.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.04)
        nodes.osc.stop(ctx.currentTime + 0.3)
        nodes.lfo.stop(ctx.currentTime + 0.3)
      } else {
        nodes.osc.stop()
        nodes.lfo.stop()
      }
    } catch { /* déjà arrêté */ }
    sirenNodesRef.current = null
    setSireneActivee(false)
  }, [])

  const couperSirene = useCallback(() => {
    stopSiren()
  }, [stopSiren])

  const dismissSosAlerte = useCallback(() => setSosAlerte(null), [])

  // Arrêt propre de la sirène au démontage du provider.
  useEffect(() => {
    return () => {
      const nodes = sirenNodesRef.current
      if (nodes) {
        try {
          nodes.osc.stop()
          nodes.lfo.stop()
        } catch { /* déjà arrêté */ }
        sirenNodesRef.current = null
      }
      void audioCtxRef.current?.close().catch(() => undefined)
      audioCtxRef.current = null
    }
  }, [])

  const dispatchSos = useCallback((type: string, payload: any) => {
    sosHandlers.current.forEach((h) => {
      try {
        h(type, payload)
      } catch { /* un abonné en erreur ne doit pas casser la chaîne */ }
    })
  }, [])

  const rawId = useCallback((val: any) => {
    if (!val) return null
    if (typeof val === 'object') return val.id
    return val.split('/').pop()
  }, [])

  const markConversationAsRead = useCallback((convId: string): Promise<void> => {
    const normalizedId = String(convId)
    const pendingRequest = conversationReadRequests.current.get(normalizedId)
    if (pendingRequest) return pendingRequest

    setMsgItems((prev) => prev.filter((item) => (
      conversationIdFromHref(item.href) !== normalizedId
    )))
    setNotifications((prev) => prev.filter((item) => (
      item.type !== 'message' || conversationIdFromHref(item.href) !== normalizedId
    )))
    globalMutate(
      NOTIFICATIONS_KEY,
      (cache: any) => {
        if (!cache) return cache
        const items = extractMsgs(cache)
        const filtered = items.filter((notification: any) => (
          notification.type !== 'message_received'
          || conversationIdFromHref(notification.link) !== normalizedId
        ))
        if (Array.isArray(cache)) return filtered
        if (cache?.member) return { ...cache, member: filtered }
        if (cache?.['hydra:member']) return { ...cache, 'hydra:member': filtered }
        return cache
      },
      { revalidate: false },
    )

    const request = api.patch(`/api/conversations/${normalizedId}/read`)
      .then((response) => {
        const markedCount = Number(response.data?.markedCount || 0)
        const notificationMarkedCount = Number(response.data?.notificationMarkedCount || 0)

        if (markedCount > 0) {
          globalMutate(
            UNREAD_MESSAGES_KEY,
            (data: any) => ({
              unreadCount: Math.max(0, Number(data?.unreadCount || 0) - markedCount),
            }),
            { revalidate: false },
          )
        }
        if (notificationMarkedCount > 0) {
          globalMutate(
            UNREAD_NOTIFICATIONS_KEY,
            (data: any) => ({
              unreadCount: Math.max(0, Number(data?.unreadCount || 0) - notificationMarkedCount),
            }),
            { revalidate: false },
          )
        }
      })
      .catch(() => {
        // La revalidation finale restaure la vérité serveur si la lecture échoue.
      })
      .finally(() => {
        conversationReadRequests.current.delete(normalizedId)
        globalMutate(UNREAD_MESSAGES_KEY)
        globalMutate(UNREAD_NOTIFICATIONS_KEY)
        globalMutate(NOTIFICATIONS_KEY)
        globalMutate(CONVERSATIONS_KEY)
      })

    conversationReadRequests.current.set(normalizedId, request)
    return request
  }, [])

  const activateConversation = useCallback((id: string | null) => {
    setActiveConversationId(id)
    if (id) {
      void markConversationAsRead(id)
    }
  }, [markConversationAsRead])

  // ── WebSocket listener — injecte chaque message reçu dans le cache SWR ──
  // L'injection utilise revalidate:false pour ne PAS écraser l'état optimiste
  // de la page chat (allLoadedMsgs géré par subscribeToMessages).
  // Le compteur unread est mis à jour immédiatement par l'événement WebSocket.
  useWebSocket(user?.id || '', token || '', {
    onNewMessage: (payload: any) => {
      const messageId = String(payload?.id ?? payload?.['@id'] ?? '')
      if (messageId && receivedMessageIds.current.has(messageId)) return
      if (messageId) {
        receivedMessageIds.current.add(messageId)
        if (receivedMessageIds.current.size > 500) {
          const oldest = receivedMessageIds.current.values().next().value
          if (oldest) receivedMessageIds.current.delete(oldest)
        }
      }

      // 1. Handlers enregistrés (page messages → ajout instantané dans allLoadedMsgs)
      messageHandlers.current.forEach((h) => h(payload))

      if (!payload || rawId(payload.expediteur) === user?.id) return

      // 2. Injection optimiste dans les caches SWR /api/messages* (sans re-fetch)
      //    revalidate:false → le message reste dans le cache même après clearAll
      //    EXCLUT les clés "conversation=" (gérées par la page chat via subscribeToMessages)
      //    pour éviter que le useEffect msgData ne surcharge allLoadedMsgs (race condition).
      globalMutate(
        (key: string) => typeof key === 'string' && key.startsWith('/api/messages') && key !== UNREAD_MESSAGES_KEY && !key.includes('conversation='),
        (cache: any) => {
          if (!cache) return cache
          if (Array.isArray(cache)) {
            if (cache.some((m: any) => String(m.id) === String(payload.id))) return cache
            return [payload, ...cache]
          }
          if (cache?.['hydra:member']) {
            if (cache['hydra:member'].some((m: any) => String(m.id) === String(payload.id))) return cache
            return { ...cache, 'hydra:member': [payload, ...cache['hydra:member']] }
          }
          return cache
        },
        { revalidate: false }
      )

      // 3. Sidebar conversations — revalide pour afficher le dernier message
      const convId = String(rawId(payload.conversation))
      globalMutate('/api/conversations', (cache: any) => {
        if (!cache || !convId) return cache
        const conversations = Array.isArray(cache) ? cache : cache?.['hydra:member'] || []
        const next = conversations.map((conversation: any) =>
          String(conversation.id) === convId
            ? { ...conversation, dernierMessage: payload, updatedAt: payload.createdAt }
            : conversation
        )
        next.sort((a: any, b: any) =>
          String(b.dernierMessage?.createdAt || b.updatedAt || '')
            .localeCompare(String(a.dernierMessage?.createdAt || a.updatedAt || ''))
        )
        return Array.isArray(cache) ? next : { ...cache, 'hydra:member': next }
      }, { revalidate: false })

      // 4. Une conversation visible est lue immédiatement, messages et
      //    notifications persistées compris.
      if (convId === activeConversationId) {
        void markConversationAsRead(convId)
        return
      }

      globalMutate(UNREAD_NOTIFICATIONS_KEY)
      globalMutate(NOTIFICATIONS_KEY)

      // 5. Compteur unread — revalidate:true pour sync serveur
      globalMutate(UNREAD_MESSAGES_KEY, (data: any) => {
        if (!data) return { unreadCount: 1 }
        return { unreadCount: data.unreadCount + 1 }
      }, { revalidate: false })
    },
    onMessageDelivered: (payload: any) => {
      messageHandlers.current.forEach((h) => h({ _type: 'message_delivered', ...payload }))
    },
    onMessageRead: (payload: any) => {
      messageHandlers.current.forEach((h) => h({ _type: 'message_read', ...payload }))
      // Revalide le compteur pour récupérer la vraie valeur serveur
      globalMutate(UNREAD_MESSAGES_KEY)
    },
    onUserOnline: (payload: any) => {
      if (payload?.userId) {
        setOnlineUsers(prev => {
          const next = new Set(prev)
          next.add(String(payload.userId))
          return next
        })
      }
    },
    onUserOffline: (payload: any) => {
      if (payload?.userId) {
        setOnlineUsers(prev => {
          const next = new Set(prev)
          next.delete(String(payload.userId))
          return next
        })
      }
    },
    onProfilePhotoChanged: (payload: any) => {
      // Dispatch aux abonnés (pages messages pour mettre à jour allUsers)
      profileChangeHandlers.current.forEach((h) => h(payload))
      // Revalide les conversations SWR pour récupérer le nouveau photoProfil
      globalMutate(CONVERSATIONS_KEY)
    },
    onLanguageChanged: (payload: any) => {
      if (payload?.locale === 'fr' || payload?.locale === 'en') {
        changeLanguage(payload.locale)
      }
    },
    // ── SOS temps réel (événements d'équipe : réservés aux postes de l'établissement) ──
    onSosCreee: (payload: any) => {
      setSosAlerte({ ...payload, type: 'creee' })
      playChime()
      dispatchSos('sos_creee', payload)
    },
    onSosVerifiee: (payload: any) => {
      setSosAlerte({ ...payload, type: 'verifiee' })
      if (payload?.sireneActive !== false) startSiren()
      dispatchSos('sos_verifiee', payload)
    },
    onSosPriseEnCharge: (payload: any) => {
      stopSiren()
      setSosAlerte({ ...payload, type: 'prise_en_charge' })
      dispatchSos('sos_prise_en_charge', payload)
    },
    onSosCloturee: (payload: any) => {
      stopSiren()
      setSosAlerte(null)
      dispatchSos('sos_cloturee', payload)
    },
    // ── Suivi demandeur/répondant (jamais de sirène ici) ──
    onSosSuivi: (payload: any) => {
      dispatchSos('sos_suivi', payload)
    },
  })

  // ── Dropdown notifications : fetch ON DEMAND au clic ───────────────────
  const openNotif = useCallback(async () => {
    if (notifOpen) { setNotifOpen(false); return }
    setNotifLoading(true)
    setNotifOpen(true)
    try {
      const response = await api.get(NOTIFICATIONS_KEY)
      const items: NotifItem[] = extractMsgs(response.data)
        .filter((notification) => (
          notification.type !== 'message_received' || !notification.readAt
        ))
        .map((notification) => notificationToItem(notification, user))
      items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      setNotifications(items)
    } catch {
      setNotifications([])
    } finally {
      setNotifLoading(false)
    }
  }, [notifOpen, user])

  const closeNotif = useCallback(() => setNotifOpen(false), [])

  const dismissNotif = useCallback(async (id: string, href?: string) => {
    const entityId = id.replace('notif-', '')
    const wasUnread = notifications.some((item) => item.id === id && item.unread)
    setNotifications((prev) => prev.map((item) => (
      item.id === id ? { ...item, unread: false } : item
    )))
    setNotifOpen(false)
    if (wasUnread) {
      try {
        await api.patch(
          `/api/notifications/${entityId}`,
          { readAt: new Date().toISOString() },
          { headers: { 'Content-Type': 'application/merge-patch+json' } },
        )
        globalMutate(UNREAD_NOTIFICATIONS_KEY, (data: any) => {
          if (!data || data.unreadCount <= 0) return { unreadCount: 0 }
          return { unreadCount: data.unreadCount - 1 }
        }, { revalidate: false })
        globalMutate(NOTIFICATIONS_KEY)
      } catch {
        setNotifications((prev) => prev.map((item) => (
          item.id === id ? { ...item, unread: true } : item
        )))
        globalMutate(UNREAD_NOTIFICATIONS_KEY)
        globalMutate(NOTIFICATIONS_KEY)
      }
    }
    if (href) router.push(href)
  }, [notifications, router])

  // ── Dropdown messages : fetch ON DEMAND au clic ─────────────────────────
  const openMsg = useCallback(async () => {
    if (msgOpen) { setMsgOpen(false); return }
    setMsgLoading(true)
    setMsgOpen(true)
    try {
      const res = await api.get('/api/messages?itemsPerPage=50&order[createdAt]=desc')
      const raw = extractMsgs(res.data)
      const items: NotifItem[] = []
      for (const m of raw) {
        if (rawId(m.expediteur) === user?.id) continue
        if (m.statut === 'LU') continue
        items.push(msgToItem(m, rawId, user))
      }
      items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      setMsgItems(items)
    } catch { /* ignore */ }
    setMsgLoading(false)
  }, [msgOpen, user, rawId])

  const closeMsg = useCallback(() => setMsgOpen(false), [])

  const dismissMsg = useCallback(async (id: string, href?: string) => {
    const entityId = id.replace('msg-', '')
    setMsgItems((prev) => prev.filter((m) => m.id !== id))
    setMsgOpen(false)
    globalMutate(UNREAD_MESSAGES_KEY, (data: any) => {
      if (!data || data.unreadCount <= 0) return { unreadCount: 0 }
      return { unreadCount: data.unreadCount - 1 }
    }, { revalidate: false })
    try {
      await api.patch(`/api/messages/${entityId}/read`)
    } catch { /* best effort */ }
    if (href) router.push(href)
  }, [router])

  // Persiste la lecture globale, puis resynchronise les caches.
  const clearAllNotifications = useCallback(async () => {
    const previousNotifications = notifications
    setNotifications((current) => current.map((item) => ({ ...item, unread: false })))
    globalMutate(UNREAD_NOTIFICATIONS_KEY, { unreadCount: 0 }, false)

    try {
      await api.patch('/api/notifications/mark-all-read')
      globalMutate(UNREAD_NOTIFICATIONS_KEY)
      globalMutate(NOTIFICATIONS_KEY)
    } catch (err) {
      console.error('[clearAllNotifications] Erreur:', err)
      setNotifications(previousNotifications)
      globalMutate(UNREAD_NOTIFICATIONS_KEY)
      globalMutate(NOTIFICATIONS_KEY)
    }
  }, [notifications])

  const notificationCount = notificationCountData?.unreadCount || 0

  const msgDisplayCount = msgItems.length

  const ctxValue = useMemo(() => ({
    notifications, notifLoading, unreadCount,
    consultationCount: openConsultationCount, pendingConsultationCount, notificationCount,
    openNotif, dismissNotif, clearAllNotifications, closeNotif, notifOpen,
    msgNotifications: msgItems, msgLoading, msgOpen, openMsg, dismissMsg, markConversationAsRead, closeMsg, msgDisplayCount,
    activeConversationId, setActiveConversationId: activateConversation, subscribeToMessages, subscribeToProfileChanges, onlineUsers,
    sosAlerte, sireneActivee, couperSirene, dismissSosAlerte, subscribeToSos,
  }), [
    notifications, notifLoading, unreadCount,
    openConsultationCount, pendingConsultationCount, notificationCount,
    openNotif, dismissNotif, clearAllNotifications, closeNotif, notifOpen,
    msgItems, msgLoading, msgOpen, openMsg, dismissMsg, markConversationAsRead, closeMsg, msgDisplayCount,
    activeConversationId, activateConversation, subscribeToMessages, subscribeToProfileChanges, onlineUsers,
    sosAlerte, sireneActivee, couperSirene, dismissSosAlerte, subscribeToSos,
  ])

  return (
    <NotificationCtx.Provider value={ctxValue}>
      {children}
      <SosSireneBanner
        alerte={sosAlerte}
        sireneActivee={sireneActivee}
        couperSirene={couperSirene}
        dismiss={dismissSosAlerte}
      />
    </NotificationCtx.Provider>
  )
}

export function useNotification() {
  return useContext(NotificationCtx)
}
