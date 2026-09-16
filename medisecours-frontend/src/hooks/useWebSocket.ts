'use client'

import { useEffect, useRef, useCallback, useSyncExternalStore } from 'react'
import { changeLanguage, type AppLocale } from '../i18n'
import { mutate as globalMutate } from 'swr'

function resolveWebSocketUrl(configuredUrl?: string): string {
  const fallbackUrl = 'ws://127.0.0.1:8081/ws'

  try {
    const url = new URL(configuredUrl || fallbackUrl)
    if (url.pathname === '/' || url.pathname === '') {
      url.pathname = '/ws'
    }
    return url.toString()
  } catch {
    return fallbackUrl
  }
}

const WS_URL = resolveWebSocketUrl(process.env.NEXT_PUBLIC_WS_URL)
const MAX_BACKOFF = 30000
const PING_INTERVAL = 30000
const PONG_TIMEOUT = 10000

const connectedSockets = new Set<WebSocket>()
const wsStatusListeners = new Set<() => void>()
let wsConnected = false

export function broadcastLanguageChange(locale: string) {
  if (locale !== 'fr' && locale !== 'en') return

  for (const ws of connectedSockets) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'language_change', locale }))
      break
    }
  }
}

function emitWsStatus() {
  for (const listener of wsStatusListeners) listener()
}

function subscribeWsStatus(listener: () => void) {
  wsStatusListeners.add(listener)
  return () => {
    wsStatusListeners.delete(listener)
  }
}

export function useWsStatus(): boolean {
  return useSyncExternalStore(subscribeWsStatus, () => wsConnected, () => wsConnected)
}

export function useWebSocket(userId: string, token: string, handlers: {
  onNewMessage?: (msg: any) => void
  onMessageDelivered?: (msg: any) => void
  onMessageRead?: (msg: any) => void
  onUserOnline?: (data: any) => void
  onUserOffline?: (data: any) => void
  onConsultationCreated?: (data: any) => void
  onConsultationAccepted?: (data: any) => void
  onConsultationClosed?: (data: any) => void
  onProfilePhotoChanged?: (data: any) => void
  onLanguageChanged?: (data: any) => void
}, role?: string) {
  const wsRef = useRef<WebSocket | null>(null)
  const attemptRef = useRef(0)
  const handlersRef = useRef(handlers)
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pongTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const authenticatedRef = useRef(false)

  useEffect(() => {
    handlersRef.current = handlers
  }, [handlers])

  const clearTimers = useCallback(() => {
    if (pingIntervalRef.current) { clearInterval(pingIntervalRef.current); pingIntervalRef.current = null }
    if (pongTimeoutRef.current) { clearTimeout(pongTimeoutRef.current); pongTimeoutRef.current = null }
  }, [])

  const startPing = useCallback((ws: WebSocket) => {
    clearTimers()
    pingIntervalRef.current = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }))
        pongTimeoutRef.current = setTimeout(() => {
          ws.close()
        }, PONG_TIMEOUT)
      }
    }, PING_INTERVAL)
  }, [clearTimers])

  const handlePong = useCallback(() => {
    if (pongTimeoutRef.current) { clearTimeout(pongTimeoutRef.current); pongTimeoutRef.current = null }
  }, [])

  const subscribe = useCallback((_conversationId: string) => {}, [])
  const unsubscribe = useCallback((_conversationId: string) => {}, [])

  useEffect(() => {
    if (!userId || !token) return

    let disposed = false
    attemptRef.current = 0
    authenticatedRef.current = false
    clearTimers()

    const connect = () => {
      if (disposed) return

      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        if (disposed) {
          ws.close()
          return
        }
        attemptRef.current = 0
        ws.send(JSON.stringify({ type: 'auth', token }))
      }

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data)

          // Auth handshake
          if (parsed.type === 'auth_ok') {
            authenticatedRef.current = true
            connectedSockets.add(ws)
            wsConnected = true
            emitWsStatus()
            startPing(ws)
            return
          }

          if (parsed.type === 'error') {
            // Auth rejected — close and do not retry (bad token)
            ws.close(4003, parsed.message)
            return
          }

          if (parsed.type === 'pong') { handlePong(); return }

          const { event: evt, payload } = parsed
          const h = handlersRef.current
          if (evt === 'new_message' && h.onNewMessage) h.onNewMessage(payload)
          if (evt === 'message_delivered' && h.onMessageDelivered) h.onMessageDelivered(payload)
          if (evt === 'message_read' && h.onMessageRead) h.onMessageRead(payload)
          if (evt === 'user_online' && h.onUserOnline) h.onUserOnline(payload)
          if (evt === 'user_offline' && h.onUserOffline) h.onUserOffline(payload)
          if (evt === 'consultation_created' && h.onConsultationCreated) h.onConsultationCreated(payload)
          if (evt === 'consultation_accepted' && h.onConsultationAccepted) h.onConsultationAccepted(payload)
          if (evt === 'consultation_closed' && h.onConsultationClosed) h.onConsultationClosed(payload)
          if (evt === 'profile_photo_changed' && h.onProfilePhotoChanged) h.onProfilePhotoChanged(payload)
          if (evt === 'language_changed') {
            const locale = payload?.locale
            if (locale === 'fr' || locale === 'en') {
              changeLanguage(locale as AppLocale)
              void globalMutate(() => true)
            }
            if (h.onLanguageChanged) h.onLanguageChanged(payload)
          }
        } catch { /* ignore */ }
      }

      ws.onclose = (event) => {
        clearTimers()
        if (connectedSockets.delete(ws) && connectedSockets.size === 0) {
          wsConnected = false
          emitWsStatus()
        }
        authenticatedRef.current = false
        if (disposed) return
        // Do not retry if auth failed (code 4003)
        if (event.code === 4003) return
        const backoff = Math.min(1000 * Math.pow(2, attemptRef.current), MAX_BACKOFF)
        attemptRef.current++
        setTimeout(() => {
          if (!disposed) connect()
        }, backoff)
      }
    }

    connect()

    return () => {
      disposed = true
      clearTimers()
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [userId, token, startPing, handlePong, clearTimers])

  return { subscribe, unsubscribe }
}
