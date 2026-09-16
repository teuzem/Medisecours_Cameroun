// @ts-nocheck
'use client'

import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from 'react'
import { API_BASE, resolveImgPath } from '../../../lib/config'

const msgAnim = { animation: 'msgIn .25s ease-out both' }
if (typeof document !== 'undefined') {
  const style = document.createElement('style')
  style.textContent = '@keyframes msgIn{from{opacity:0;transform:translateY(8px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}' +
    '@keyframes dotPulse{0%,80%,100%{transform:scale(0.6);opacity:0.4}40%{transform:scale(1);opacity:1}}'
  document.head.appendChild(style)
}
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Send, CheckCheck, Check, Plus, X, ExternalLink, Loader2, Paperclip, Mic, Square, FileText, ImageIcon, Video, Camera, Search, ChevronDown } from 'lucide-react'
import useSWR, { mutate as globalMutate } from 'swr'
import api from '../../../api/axios'
import { fetcher } from '../../../lib/fetcher'
import { useWsStatus } from '../../../hooks/useWebSocket'
import { UNREAD_MESSAGES_KEY } from '../../../lib/keys'
import { useAuth } from '../../../hooks/useAuth'
import { useNotification } from '../../../contexts/NotificationContext'

import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import EmptyState from '../../../components/ui/EmptyState'
import { useToast } from '../../../components/ui/Toast'

const MSGS_PER_PAGE = 30

function iri(prefix, id) { return `/api/${prefix}/${id}` }
function idFromIri(value) {
  if (!value) return null
  if (typeof value === 'object') return value.id
  return value.split('/').pop()
}
function mediaUrl(path) {
  if (!path || path.startsWith('http') || path.startsWith('blob:') || path.startsWith('data:')) return path
  if (path.startsWith('/api/')) return path
  return API_BASE + (path.startsWith('/') ? path : `/${path}`)
}
function msgMediaUrl(m) {
  const media = m.media
  if (!media) return null
  if (typeof media === 'string') {
    const path = /^\/api\/media_objects\/[^/]+$/.test(media) ? `${media}/download` : media
    return mediaUrl(path)
  }
  const path = media.contentUrl || (media.id ? `/api/media_objects/${media.id}/download` : null)
  return mediaUrl(path)
}

function formatFileSize(bytes, t) {
  if (!bytes) return ''
  if (bytes < 1024) return bytes + ' ' + t('medecin.messages.bytesUnit')
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' ' + t('medecin.messages.kbUnit')
  return (bytes / 1048576).toFixed(1) + ' ' + t('medecin.messages.mbUnit')
}

function formatMsgTime(dateStr, t, locale) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = new Date()
  const diff = (now - d) / 1000
  if (diff < 60) return t('medecin.messages.justNow')
  if (diff < 3600) return t('medecin.messages.minutesAgo', { count: Math.floor(diff / 60) })
  if (diff < 86400) return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  if (diff < 172800) return t('medecin.messages.yesterday', { time: d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) })
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'short' })
}

function formatDuration(sec) {
  if (!sec) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return m + ':' + String(s).padStart(2, '0')
}

function isImageMime(m) { return m?.startsWith('image/') }
function isVideoMime(m) { return m?.startsWith('video/') }
function isAudioMime(m) { return m?.startsWith('audio/') }
const MAX_MESSAGE_MEDIA_SIZE = 25 * 1024 * 1024

function msgTypeFromMime(mime) {
  if (!mime) return 'FICHIER'
  if (isImageMime(mime)) return 'IMAGE'
  if (isVideoMime(mime)) return 'VIDEO'
  if (isAudioMime(mime)) return 'VOIX'
  return 'FICHIER'
}

function msgMediaKind(m) {
  if (m?.typeMessage === 'VOIX') return 'VOIX'
  if (m?.typeMessage === 'VIDEO') return 'VIDEO'
  const mime = m?.media && typeof m.media === 'object' ? m.media.mimeType : null
  if (isVideoMime(mime)) return 'VIDEO'
  if (m?.typeMessage === 'IMAGE') return 'IMAGE'
  if (isImageMime(mime)) return 'IMAGE'
  if (isAudioMime(mime)) return 'VOIX'
  return m?.typeMessage || 'TEXTE'
}

const AVATAR_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#FF8A65', '#81C784']
function avatarColor(name) {
  if (!name) return '#45B7D1'
  return AVATAR_COLORS[name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % AVATAR_COLORS.length]
}
function avatarInitials(name) {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

function lastMsgPreview(m, t) {
  if (!m) return ''
  const kind = msgMediaKind(m)
  if (kind === 'IMAGE') return t('medecin.messages.photo')
  if (kind === 'VOIX') return t('medecin.messages.voiceMessage')
  if (kind === 'VIDEO') return t('medecin.messages.video')
  if (kind === 'FICHIER') return t('medecin.messages.file', { name: m.media?.originalName || t('medecin.messages.fileFallback') })
  return m.contenu || ''
}

function DateDivider({ label }) {
  return (
    <div className="flex items-center gap-4 my-6">
      <div className="flex-1 h-px bg-gray-200 dark:bg-white/10" />
      <span className="text-[11px] font-semibold tracking-wider text-gray-400 dark:text-slate-400 uppercase">{label}</span>
      <div className="flex-1 h-px bg-gray-200 dark:bg-white/10" />
    </div>
  )
}

function TypingDots() {
  return (
    <div className="flex justify-start mb-3 pl-[44px]">
      <div className="bg-[#EDEDED] dark:bg-primary-700 rounded-[18px] rounded-bl-[4px] px-4 py-3 flex items-center gap-1">
        <span className="w-2 h-2 rounded-full bg-gray-400 dark:bg-slate-400" style={{ animation: 'dotPulse 1.4s ease-in-out infinite', animationDelay: '0s' }} />
        <span className="w-2 h-2 rounded-full bg-gray-400 dark:bg-slate-400" style={{ animation: 'dotPulse 1.4s ease-in-out infinite', animationDelay: '0.2s' }} />
        <span className="w-2 h-2 rounded-full bg-gray-400 dark:bg-slate-400" style={{ animation: 'dotPulse 1.4s ease-in-out infinite', animationDelay: '0.4s' }} />
      </div>
    </div>
  )
}

function ReadStatus({ statut, sending }) {
  if (sending) return <Loader2 className="w-3 h-3 animate-spin text-white/60" />
  if (statut === 'LU') return <CheckCheck className="w-3.5 h-3.5 text-cyan-300" />
  return <CheckCheck className="w-3.5 h-3.5 text-white/60" />
}

function UserAvatar({ user: u, size = 40, className = '' }) {
  const [imgErr, setImgErr] = useState(false)
  const src = u?.photoProfil ? resolveImgPath(u.photoProfil) : null
  const name = u ? `${u.prenom || ''} ${u.nom || ''}`.trim() : '?'
  if (src && !imgErr) {
    return (
      <img
        src={src}
        alt={name}
        className={`${className} rounded-full object-cover ring-2 ring-white dark:ring-primary-700 shadow-sm shrink-0`}
        style={{ width: size, height: size }}
        onError={() => setImgErr(true)}
      />
    )
  }
  return (
    <div
      className={`${className} rounded-full flex items-center justify-center text-white font-semibold shrink-0`}
      style={{ width: size, height: size, backgroundColor: avatarColor(name), fontSize: size * 0.38 }}
    >
      {avatarInitials(name)}
    </div>
  )
}

export default function MedecinMessagesPage() {
  const { t } = useTranslation()
  return (
    <Suspense fallback={<LoadingSpinner label={t('common.loading')} />}>
      <MedecinMessagesContent />
    </Suspense>
  )
}

function MedecinMessagesContent() {
  const { user } = useAuth()
  const { setActiveConversationId, subscribeToMessages, subscribeToProfileChanges, onlineUsers, markConversationAsRead, msgNotifications } = useNotification()
  const toast = useToast()
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'en' ? 'en-GB' : 'fr-FR'
  const searchParams = useSearchParams()
  const preselectConv = searchParams.get('conversation')

  const [activeId, setActiveId] = useState(preselectConv || null)
  const preselectPatient = searchParams.get('patient')
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [allUsers, setAllUsers] = useState([])
  const [userSearch, setUserSearch] = useState('')
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [attachments, setAttachments] = useState([])
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recordTimer, setRecordTimer] = useState(0)
  const [recordingBlob, setRecordingBlob] = useState(null)
  const [uploadingMedia, setUploadingMedia] = useState(false)
  const [convSearch, setConvSearch] = useState('')
  const [msgPage, setMsgPage] = useState(1)
  const [allLoadedMsgs, setAllLoadedMsgs] = useState([])
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const bottomRef = useRef(null)
  const fileRef = useRef(null)
  const docRef = useRef(null)
  const cameraRef = useRef(null)
  const recorderRef = useRef(null)
  const recordTimerRef = useRef(null)
  const streamRef = useRef(null)
  const msgContainerRef = useRef(null)
  const activeIdRef = useRef(activeId)
  const loadingMoreRef = useRef(false)
  const hasMoreRef = useRef(true)
  const msgLoadingRef = useRef(false)
  const initialPageReadyRef = useRef(false)
  const olderPageMergeRef = useRef(false)

  const wsOnline = useWsStatus()

  const { data: convData, isLoading: convLoading, error: convError, mutate: mutateConvs } = useSWR('/api/conversations', fetcher, { revalidateOnFocus: false, keepPreviousData: true, refreshInterval: wsOnline ? 0 : 12000 })

  const activeIdNum = activeId ? Number(activeId) : null
  const { data: msgData, isLoading: msgLoading, error: msgError, mutate: mutateMsgs } = useSWR(
    activeIdNum ? `/api/messages?conversation=/api/conversations/${activeIdNum}&order[createdAt]=DESC&order[id]=DESC&itemsPerPage=${MSGS_PER_PAGE}&page=${msgPage}` : null,
    fetcher,
    { revalidateOnFocus: false, refreshInterval: wsOnline ? 0 : 12000 }
  )

  // Keep refs in sync
  useEffect(() => { activeIdRef.current = activeId }, [activeId])
  useEffect(() => { loadingMoreRef.current = loadingMore }, [loadingMore])
  useEffect(() => { hasMoreRef.current = hasMore }, [hasMore])
  useEffect(() => { msgLoadingRef.current = msgLoading }, [msgLoading])

  // Mark only the selected conversation as read.
  useEffect(() => {
    if (!activeId) return
    markConversationAsRead(activeId)
  }, [activeId, markConversationAsRead])

  // Reset pagination when switching conversations
  useEffect(() => {
    // The selected conversation is the external source of truth for this pagination state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMsgPage(1)
    setAllLoadedMsgs([])
    setHasMore(true)
    setLoadingMore(false)
    initialPageReadyRef.current = false
  }, [activeId])

  // Append newly fetched page to allLoadedMsgs (with dedup + scroll preservation)
  useEffect(() => {
    if (!msgData) return
    const arr = Array.isArray(msgData) ? msgData : msgData['hydra:member'] || []
    // Keep only messages belonging to the active conversation.
    // With keepPreviousData, SWR may return the previous conversation's data
    // while the new key loads; filtering prevents cross-conversation pollution.
    const activeMsgs = arr.filter((m) => {
      const convIri = typeof m.conversation === 'object' ? (m.conversation['@id'] || m.conversation.id) : m.conversation
      const convId = idFromIri(convIri)
      return !convId || String(convId) === String(activeIdNum)
    })
    // SWR has completed the page request; synchronize the pagination boundary.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (activeMsgs.length < MSGS_PER_PAGE) setHasMore(false)

    // Save scroll position before updating (for loading older messages)
    const container = msgContainerRef.current
    const prevScrollHeight = container ? container.scrollHeight : 0

    if (msgPage === 1) {
      setAllLoadedMsgs(activeMsgs)
      // Fix: scroll to bottom when entering a conversation and loading first messages
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'auto' })
        initialPageReadyRef.current = true
      }, 100)
    } else {
      // Deduplicate: only add messages not already present
      olderPageMergeRef.current = true
      setAllLoadedMsgs(prev => {
        const existingIds = new Set(prev.map(m => String(m.id ?? m['@id'])))
        const newMsgs = activeMsgs.filter(m => !existingIds.has(String(m.id ?? m['@id'])))
        return newMsgs.length > 0 ? [...prev, ...newMsgs] : prev
      })
    }
    setLoadingMore(false)

    // Restore scroll position after loading older messages
    if (msgPage > 1 && container) {
      window.setTimeout(() => {
        requestAnimationFrame(() => {
          const newScrollHeight = container.scrollHeight
          container.scrollTop += newScrollHeight - prevScrollHeight
        })
      }, 0)
    }
  }, [msgData, msgPage, activeIdNum])

  // Scroll to bottom on new conversation
  useEffect(() => {
    if (activeId) {
      setTimeout(() => bottomRef.current?.scrollIntoView(), 50)
    }
  }, [activeId])

  // Auto-scroll when new messages arrive
  const prevMsgCountRef = useRef(0)
  useEffect(() => {
    const el = msgContainerRef.current
    if (!el) return
    const currentCount = allLoadedMsgs.length
    if (olderPageMergeRef.current) {
      olderPageMergeRef.current = false
      prevMsgCountRef.current = currentCount
      return
    }
    if (currentCount <= prevMsgCountRef.current) {
      prevMsgCountRef.current = currentCount
      return
    }
    prevMsgCountRef.current = currentCount
    
    // Smooth scroll to bottom whenever a new message arrives (since it's prepended/appended dynamically)
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }, [allLoadedMsgs.length])

  const handleMessagesScroll = () => {
    const container = msgContainerRef.current
    if (
      !container ||
      !initialPageReadyRef.current ||
      container.scrollTop > 80 ||
      !hasMoreRef.current ||
      loadingMoreRef.current ||
      msgLoadingRef.current
    ) return

    loadingMoreRef.current = true
    setLoadingMore(true)
    setMsgPage(page => page + 1)
  }

  const conversations = useMemo(
    () => Array.isArray(convData) ? convData : convData?.['hydra:member'] || [],
    [convData]
  )

  // Auto-fetch missing participant user info if API returns string IRIs or shallow objects
  useEffect(() => {
    if (!conversations.length) return
    const missingIris = new Set()
    for (const c of conversations) {
      c.participants?.forEach(p => {
        if (typeof p === 'string') {
          if (!allUsers.some(u => String(u.id) === String(idFromIri(p)))) missingIris.add(p)
        } else if (p && typeof p === 'object') {
          if (!p.nom && !p.prenom && p['@id']) {
            if (!allUsers.some(u => String(u.id) === String(p.id))) missingIris.add(p['@id'])
          }
        }
      })
    }
    if (missingIris.size > 0) {
      let dead = false
      Promise.allSettled(Array.from(missingIris).map(iriStr => api.get(iriStr).then(r => r.data)))
        .then(results => {
          if (dead) return
          const newUsers = results.filter(r => r.status === 'fulfilled' && r.value).map(r => r.value)
          if (newUsers.length > 0) {
            setAllUsers(prev => {
               const map = new Map(prev.map(u => [String(u.id), u]))
               newUsers.forEach(u => map.set(String(u.id), u))
               return Array.from(map.values())
            })
          }
        })
      return () => { dead = true }
    }
  }, [conversations, allUsers])

  // Subscribe to profile photo changes → update allUsers local state instantly
  useEffect(() => {
    return subscribeToProfileChanges((data: any) => {
      if (!data?.userId || !('photoProfil' in data)) return
      setAllUsers(prev => {
        const idx = prev.findIndex(u => String(u.id) === String(data.userId))
        if (idx === -1) return prev
        const updated = [...prev]
        updated[idx] = { ...updated[idx], photoProfil: data.photoProfil }
        return updated
      })
    })
  }, [subscribeToProfileChanges])

  const mediaCache = useMemo(() => new Map(), [])
  const [, bumpMediaCacheVersion] = useState(0)
  const [unreadCounts, setUnreadCounts] = useState(new Map())

  const activeMessagesRaw = allLoadedMsgs

  useEffect(() => {
    const iris = [...new Set(activeMessagesRaw.filter(m => m.media && typeof m.media === 'string' && /\/(media_objects|media)\//.test(m.media)).map(m => m.media))]
    const pending = iris.filter(i => !mediaCache.has(i))
    if (pending.length === 0) return
    let dead = false
    Promise.allSettled(pending.map(i => api.get(i).then(r => ({ i, d: r.data })))).then(rr => {
      if (dead) return
      let changed = false
      rr.forEach(r => {
        if (r.status === 'fulfilled') {
          mediaCache.set(r.value.i, r.value.d)
          changed = true
        }
      })
      if (changed) bumpMediaCacheVersion(n => n + 1)
    })
    return () => { dead = true }
  }, [activeMessagesRaw, mediaCache])

  useEffect(() => {
    if (convError || msgError) toast.error(t('medecin.messages.loadError'))
  }, [convError, msgError, toast, t])

  function sameMsg(a, b) {
    const idA = String(a.id ?? a['@id'] ?? '')
    const idB = String(b.id ?? b['@id'] ?? '')
    return idA !== '' && idB !== '' && idA === idB
  }

  // Notify Context of the active conversation to suppress bell notifications
  useEffect(() => {
    setActiveConversationId(activeId)
    return () => setActiveConversationId(null)
  }, [activeId, setActiveConversationId])

  // Central Event Bus message handler
  useEffect(() => {
    const unsubscribe = subscribeToMessages((msg: any) => {
      if (msg._type === 'message_read') {
        setAllLoadedMsgs(prev => prev.map(m => sameMsg(m, msg) ? { ...m, statut: 'LU' } : m))
        return
      }
      if (msg._type === 'message_delivered') {
        setAllLoadedMsgs(prev => prev.map(m => sameMsg(m, msg) ? { ...m, statut: 'LIVRE' } : m))
        return
      }

      const currentActiveId = activeIdRef.current
      if (String(idFromIri(msg.expediteur)) === String(user?.id)) return

      const convId = String(idFromIri(msg.conversation) || '')

      if (convId && convId !== currentActiveId) {
        setUnreadCounts(prev => {
          const next = new Map(prev)
          next.set(convId, (next.get(convId) || 0) + 1)
          return next
        })
        
        // Optimistic UI update for the left sidebar
        mutateConvs((current: any) => {
          if (!current) return current
          const arr = Array.isArray(current) ? current : (current['hydra:member'] || [])
          const newArr = arr.map((c: any) => String(c.id) === convId ? { ...c, dernierMessage: msg } : c)
          newArr.sort((a: any, b: any) => (b.dernierMessage ? new Date(b.dernierMessage.createdAt).getTime() : 0) - (a.dernierMessage ? new Date(a.dernierMessage.createdAt).getTime() : 0))
          return Array.isArray(current) ? newArr : { ...current, 'hydra:member': newArr }
        }, { revalidate: false })
        return
      }

      if (convId && convId === currentActiveId) {
        setAllLoadedMsgs(prev => {
          if (prev.some(m => sameMsg(m, msg))) return prev
          return [msg, ...prev]
        })
        
        // Injection directe via mutation locale sur le cache SWR dynamique de la discussion (Filtre anti-rechargement)
        const activeIdNum = Number(currentActiveId)
        const msgKey = `/api/messages?conversation=/api/conversations/${activeIdNum}&order[createdAt]=DESC&order[id]=DESC&itemsPerPage=${MSGS_PER_PAGE}&page=1`
        globalMutate(msgKey, (currentCache: any) => {
          const arr = Array.isArray(currentCache) ? currentCache : (currentCache?.['hydra:member'] || [])
          // Sécurité contre les doublons (Race Condition)
          if (arr.some((m: any) => String(m.id ?? m['@id']) === String(msg.id ?? msg['@id']))) {
            return currentCache
          }
          const newArr = [msg, ...arr]
          return Array.isArray(currentCache) ? newArr : { ...currentCache, 'hydra:member': newArr }
        }, { revalidate: false })

        api.patch(`/api/conversations/${convId}/read`)
          .then(() => globalMutate(UNREAD_MESSAGES_KEY))
          .catch(() => {})

        mutateConvs((current: any) => {
          if (!current) return current
          const arr = Array.isArray(current) ? current : (current['hydra:member'] || [])
          const newArr = arr.map((c: any) => String(c.id) === convId ? { ...c, dernierMessage: msg } : c)
          return Array.isArray(current) ? newArr : { ...current, 'hydra:member': newArr }
        }, { revalidate: false })
      }
    })
    return () => unsubscribe()
  }, [subscribeToMessages, mutateConvs, user?.id])

  useEffect(() => {
    if (activeId) {
      const t = setTimeout(() => {
        setUnreadCounts(prev => {
          const next = new Map(prev)
          next.set(activeId, 0)
          return next
        })
      }, 0)
      return () => clearTimeout(t)
    }
  }, [activeId])

  const resolvedMessages = activeMessagesRaw.map(m => {
    if (m.media && typeof m.media === 'string' && /\/(media_objects|media)\//.test(m.media)) {
      const cached = mediaCache.get(m.media)
      if (cached) return { ...m, media: cached }
    }
    return m
  })



  const convMap = useMemo(() => {
    const map = new Map()
    for (const c of conversations) {
      const other = c.participants?.find((p) => {
        const pId = typeof p === 'object' ? p.id : idFromIri(p)
        return String(pId) !== String(user?.id)
      })
      
      let info = null
      if (typeof other === 'object') {
        if (other.nom || other.prenom) {
          info = other
        } else {
          info = allUsers.find(u => String(u.id) === String(other.id)) || other
        }
      } else if (typeof other === 'string') {
        info = allUsers.find(u => String(u.id) === String(idFromIri(other))) || null
      }

      const lastMsg = c.dernierMessage || null
      const unread = unreadCounts.get(String(c.id)) || 0
      map.set(String(c.id), {
        id: String(c.id),
        info: info,
        messages: [],
        unread,
        dernierMessage: lastMsg,

      })
    }
    return map
  }, [conversations, user, unreadCounts, allUsers])

  const activeConv = convMap.get(activeId)

  const dedupedMessages = useMemo(() => {
    const msgs = [...resolvedMessages]
    msgs.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    const seen = new Set()
    return msgs.filter(m => {
      const key = m.id ?? m['@id']
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [resolvedMessages])


  useEffect(() => {
    if (!activeId || !dedupedMessages.some((msg) =>
      msg.statut !== 'LU' && idFromIri(msg.expediteur) !== user?.id
    )) return

    api.patch(`/api/conversations/${activeId}/read`)
      .then(() => {
        setAllLoadedMsgs((messages) => messages.map((msg) =>
          idFromIri(msg.expediteur) === user?.id ? msg : { ...msg, statut: 'LU' }
        ))
        globalMutate(UNREAD_MESSAGES_KEY)
      })
      .catch(() => globalMutate(UNREAD_MESSAGES_KEY))
  }, [activeId, dedupedMessages, user?.id])

  function convLastTime(c) {
    return c.dernierMessage?.createdAt ?? ''
  }
  const sortedConvs = useMemo(() => {
    const filtered = Array.from(convMap.values()).filter(c => {
      if (!convSearch.trim()) return true
      const q = convSearch.toLowerCase()
      const name = c.info ? `${c.info.prenom || ''} ${c.info.nom || ''}`.toLowerCase() : ''
      const lastMsg = lastMsgPreview(c.dernierMessage, t).toLowerCase()
      return name.includes(q) || lastMsg.includes(q)
    })
    return filtered.sort((a, b) => {
      const la = convLastTime(a)
      const lb = convLastTime(b)
      return String(lb).localeCompare(String(la))
    })
  }, [convMap, convSearch, t])

  const openNewConversation = () => {
    setShowNew(true)
    if (allUsers.length === 0 && !loadingUsers) {
      setLoadingUsers(true)
      api.get('/api/patients')
        .then((res) => {
          const raw = res.data?.member ?? res.data?.['hydra:member'] ?? (Array.isArray(res.data) ? res.data : [])
          const filtered = raw.filter(u => String(u.id) !== String(user?.id))
          setAllUsers(filtered)
          if (filtered.length === 0) {
            toast.info(t('medecin.messages.noPatientFound'))
          }
        })
        .catch((err) => {
          toast.error(t('medecin.messages.loadPatientsError'))
        })
        .finally(() => setLoadingUsers(false))
    }
  }

  const findOrCreateConv = async (targetId) => {
    const existing = conversations.find((c) =>
      c.participants?.some((p) => {
        const pId = typeof p === 'object' ? p.id : idFromIri(p)
        return String(pId) === String(targetId)
      })
    )
    if (existing) return String(existing.id)

    const { data: conv } = await api.post('/api/conversations', {
      participants: [iri('users', user?.id), iri('users', targetId)]
    }, { headers: { 'Content-Type': 'application/ld+json' } })

    // Inject targetUser so the UI immediately shows the name even if API returned IRIs
    const targetUser = allUsers.find(u => String(u.id) === String(targetId))
    if (targetUser) {
        conv.participants = [user, targetUser]
    }

    await mutateConvs((prev) => {
      const arr = Array.isArray(prev) ? prev : prev?.['hydra:member'] || []
      return [conv, ...arr]
    }, { revalidate: true })
    return String(conv.id)
  }

  const preselectStarted = useRef(false)
  useEffect(() => {
    if (!preselectPatient || convLoading || !user || preselectStarted.current) return
    preselectStarted.current = true
    const patientId = String(preselectPatient)
    if (!patientId) return
    ;(async () => {
      try {
        const existing = conversations.find((c) =>
          c.participants?.some((p) => {
            const pId = typeof p === 'object' ? String(p.id) : String(idFromIri(p))
            return pId === String(patientId)
          })
        )
        if (existing) {
          setActiveId(String(existing.id))
          return
        }
        const { data: conv } = await api.post('/api/conversations', {
          participants: [iri('users', user?.id), iri('users', patientId)]
        }, { headers: { 'Content-Type': 'application/ld+json' } })
        
        await mutateConvs((prev) => {
          const arr = Array.isArray(prev) ? prev : prev?.['hydra:member'] || []
          return [conv, ...arr]
        }, { revalidate: true })
        setActiveId(String(conv.id))
      } catch {
        toast.error(t('medecin.messages.loadConversationError'))
      }
    })()
  }, [preselectPatient, convLoading, conversations, user, toast, mutateConvs, t])

  function handleAttach(type) {
    setShowAttachMenu(false)
    if (type === 'camera') { cameraRef.current?.click(); return }
    if (type === 'gallery') { fileRef.current?.click(); return }
    if (type === 'doc') { docRef.current?.click(); return }
    if (type === 'voice') startRecording()
  }

  function handleFilePick(e, multi) {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    for (const f of files) {
      if (f.size > MAX_MESSAGE_MEDIA_SIZE) {
        toast.error(t('medecin.messages.sizeLimit', { name: f.name }))
        continue
      }
      const preview = (isImageMime(f.type) || isVideoMime(f.type) || isAudioMime(f.type)) ? URL.createObjectURL(f) : null
      setAttachments((prev) => [...prev, { id: crypto.randomUUID?.() || Date.now() + '-' + Math.random(), file: f, preview, name: f.name, size: f.size, mime: f.type }])
    }
  }

  function removeAttachment(id) {
    setAttachments((prev) => {
      const item = prev.find((a) => a.id === id)
      if (item?.preview) URL.revokeObjectURL(item.preview)
      return prev.filter((a) => a.id !== id)
    })
  }

  function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia) { toast.error(t('medecin.messages.voiceNotSupported')); return }
    setShowAttachMenu(false)
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      streamRef.current = stream
      const mr = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm' })
      const chunks = []
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
      mr.onstop = () => {
        const blob = new Blob(chunks, { type: mr.mimeType })
        setRecordingBlob(blob)
        setAttachments((prev) => [...prev, { id: crypto.randomUUID?.() || Date.now() + '-' + Math.random(), file: blob, preview: URL.createObjectURL(blob), name: 'Message vocal.webm', size: blob.size, mime: mr.mimeType }])
        stream.getTracks().forEach((t) => t.stop())
      }
      recorderRef.current = mr
      mr.start(250)
      setRecording(true)
      setRecordTimer(0)
      recordTimerRef.current = setInterval(() => setRecordTimer((t) => t + 1), 1000)
    }).catch(() => toast.error(t('medecin.messages.micError')))
  }

  function stopRecording() {
    clearInterval(recordTimerRef.current)
    setRecording(false)
    recorderRef.current?.stop()
  }

  async function uploadFile(file) {
    const formData = new FormData()
    formData.append('file', file)
    const { data } = await api.post('/api/messages/media/upload', formData, {
      headers: { 'Content-Type': undefined }
    })
    return data
  }

  const handleSend = async () => {
    if (!activeId) return
    const hasText = draft.trim().length > 0
    const hasFiles = attachments.length > 0
    if (!hasText && !hasFiles) return

    const convIri = `/api/conversations/${activeId}`
    const currentActiveId = activeId

    // Optimistic sidebar update: inject mock dernierMessage instantly
    const optimisticConvMutate = (content: string) => {
      mutateConvs((prev: any) => {
        const arr = Array.isArray(prev) ? prev : []
        return arr.map((c: any) => {
          if (String(c.id) === String(currentActiveId)) {
            return { ...c, dernierMessage: { contenu: content.slice(0, 80), createdAt: new Date().toISOString(), expediteur: { id: user?.id } } }
          }
          return c
        })
      }, { revalidate: false })
    }

    if (hasFiles) {
      setSending(true)
      setUploadingMedia(true)
      const caption = draft.trim()
      setDraft('')
      const pending = attachments.map((att) => ({
        ...att,
        tempId: 'temp-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      }))
      // Add optimistic messages to local state only (no WS publish yet)
      for (const att of pending) {
        const optimistic = {
          id: att.tempId, contenu: caption || '',
          expediteur: { id: user?.id },
          conversation: convIri, statut: 'ENVOYE',
          createdAt: new Date().toISOString(),
          typeMessage: msgTypeFromMime(att.mime),
          _sending: true, media: { contentUrl: att.preview || '', originalName: att.name, size: att.size, mimeType: att.mime },
        }
        setAllLoadedMsgs(prev => [optimistic, ...prev])
      }
      // Optimistic sidebar: show file preview instantly
      optimisticConvMutate(caption || t('medecin.messages.fileFallback'))
      setAttachments([])
      try {
        const uploads = await Promise.all(pending.map((att) => uploadFile(att.file)))
        const bodies = pending.map((att, i) => {
          const type = msgTypeFromMime(att.mime)
          const body = {
            contenu: i === 0 ? caption : '',
            conversation: convIri,
            typeMessage: type,
            media: uploads[i]['@id'],
          }
          if (type === 'VOIX') body.dureeVoix = Math.round(recordTimer)
          return api.post('/api/messages', body, { headers: { 'Content-Type': 'application/ld+json' } })
        })
        const results = await Promise.all(bodies)
        const created = results.map((r, i) => {
          const d = r.data
          return uploads[i] ? { ...d, media: uploads[i] } : d
        })
        // Replace optimistic entries with real ones
        setAllLoadedMsgs(prev => {
          let updated = [...prev]
          for (let i = 0; i < pending.length; i++) {
            const idx = updated.findIndex(m => m.id === pending[i].tempId)
            if (idx !== -1) updated[idx] = { ...created[i], _sending: false }
            else if (!updated.some(m => sameMsg(m, created[i]))) updated.unshift(created[i])
          }
          return updated
        })
        const msgKey = `/api/messages?conversation=/api/conversations/${Number(currentActiveId)}&order[createdAt]=DESC&order[id]=DESC&itemsPerPage=${MSGS_PER_PAGE}&page=1`
        globalMutate(msgKey, (currentCache: any) => {
          const arr = Array.isArray(currentCache) ? currentCache : (currentCache?.['hydra:member'] || [])
          const createdIds = new Set(created.map((m: any) => String(m.id ?? m['@id'])))
          const next = [...created, ...arr.filter((m: any) => !createdIds.has(String(m.id ?? m['@id'])))]
          if (!currentCache || Array.isArray(currentCache)) return next
          return { ...currentCache, 'hydra:member': next }
        }, { revalidate: false })
        mutateConvs()
      } catch (error) {
        toast.error(error?.response?.data?.error || error?.response?.data?.detail || t('medecin.messages.sendMediaError'))
        // Remove failed optimistic messages
        const tempIds = new Set(pending.map(a => a.tempId))
        setAllLoadedMsgs(prev => prev.filter(m => !tempIds.has(m.id)))
      } finally {
        setSending(false)
        setUploadingMedia(false)
        pending.forEach((a) => { if (a.preview) URL.revokeObjectURL(a.preview) })
      }
      return
    }

    // Text-only message
    const content = draft.trim()
    const tempId = 'temp-' + Date.now()
    const temp = {
      id: tempId, contenu: content,
      expediteur: { id: user?.id },
      conversation: convIri,
      statut: 'ENVOYE', createdAt: new Date().toISOString(),
      _sending: true,
    }
    // Add optimistic message to local state only (no WS publish yet)
    setAllLoadedMsgs(prev => [temp, ...prev])
    // Optimistic sidebar update: show message preview instantly
    optimisticConvMutate(content)
    setDraft('')
    setSending(true)
    try {
      const { data: created } = await api.post('/api/messages', { contenu: content, conversation: convIri }, { headers: { 'Content-Type': 'application/ld+json' } })
      // Replace optimistic entry with real one
      setAllLoadedMsgs(prev => {
        const idx = prev.findIndex(m => m.id === tempId)
        if (idx !== -1) {
          const updated = [...prev]
          updated[idx] = { ...created, _sending: false }
          return updated
        }
        return prev.some(m => sameMsg(m, created)) ? prev : [created, ...prev]
      })
      // Mirror the media path: inject the created message into the SWR cache so the
      // append effect (msgPage === 1) does not rebuild the list without it when a
      // WS message (patient reply) mutates the cache afterwards.
      const msgKey = `/api/messages?conversation=/api/conversations/${Number(currentActiveId)}&order[createdAt]=DESC&order[id]=DESC&itemsPerPage=${MSGS_PER_PAGE}&page=1`
      globalMutate(msgKey, (currentCache: any) => {
        const arr = Array.isArray(currentCache) ? currentCache : (currentCache?.['hydra:member'] || [])
        const createdId = String(created.id ?? created['@id'])
        if (arr.some((m: any) => String(m.id ?? m['@id']) === createdId)) {
          return currentCache
        }
        const newArr = [created, ...arr]
        return Array.isArray(currentCache) ? newArr : { ...currentCache, 'hydra:member': newArr }
      }, { revalidate: false })
      mutateConvs()
    } catch {
      // Remove failed optimistic message
      setAllLoadedMsgs(prev => prev.filter(m => m.id !== tempId))
      toast.error(t('medecin.messages.sendMessageError'))
    } finally {
      setSending(false)
    }
  }



  return (
    <div className="h-[calc(100vh-4rem)] bg-gradient-to-br from-blue-50 to-blue-100 dark:from-primary-900 dark:to-primary-800 flex p-0 lg:p-4">
      <div className="w-full h-full max-w-6xl mx-auto bg-white lg:rounded-[12px] shadow-none lg:shadow-xl flex overflow-hidden">
        {/* ── Sidebar ── */}
        <div className={`w-full lg:w-[360px] shrink-0 border-r border-gray-200 bg-white flex flex-col ${activeId ? 'hidden lg:flex' : 'flex'}`}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200">
            <h2 className="text-sm font-bold tracking-[0.15em] text-[#212121] uppercase">{t('medecin.messages.title')}</h2>
            <button onClick={openNewConversation} className="w-8 h-8 rounded-lg bg-[#2196F3] hover:bg-blue-600 text-white flex items-center justify-center transition-colors">
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Search */}
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                value={convSearch}
                onChange={(e) => setConvSearch(e.target.value)}
                placeholder={t('medecin.messages.searchConvPlaceholder')}
                className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#2196F3]/20 focus:border-[#2196F3] transition-all"
              />
            </div>

          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto">
            {sortedConvs.length === 0 ? (
              <EmptyState title={convSearch ? t('medecin.messages.noResults') : t('medecin.messages.noConversation')} description={convSearch ? t('medecin.messages.tryAnotherTerm') : t('medecin.messages.startConversation')} />
            ) : (
              sortedConvs.map((c) => {
                const isActive = activeId === c.id
                const name = c.info ? `${c.info.prenom || ''} ${c.info.nom || ''}`.trim() || t('medecin.messages.unknown') : t('medecin.messages.unknown')
                return (
                  <button
                    key={c.id}
                    onClick={() => setActiveId(c.id)}
                    className={`w-full flex items-center gap-3 px-4 py-4 text-left transition-colors duration-150 ${
                      isActive ? 'bg-[#2196F3]' : 'hover:bg-gray-50'
                    }`}
                  >
                    {/* Avatar with photo */}
                    <div className="relative shrink-0">
                      <UserAvatar user={c.info} size={48} />
                      {onlineUsers.has(String(c.info?.id)) && (
                        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#4CAF50] border-2 border-white dark:border-primary-700" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-sm font-semibold truncate ${isActive ? 'text-white' : 'text-[#212121]'}`}>
                          {name}
                        </span>
                        {c.dernierMessage?.createdAt && (
                          <span className={`text-[11px] shrink-0 ${isActive ? 'text-white/80' : 'text-gray-400'}`}>
                            {formatMsgTime(c.dernierMessage.createdAt, t, locale)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <span className={`text-xs truncate ${isActive ? 'text-white/80' : 'text-gray-500'}`}>
                          {lastMsgPreview(c.dernierMessage, t)}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {c.dernierMessage && idFromIri(c.dernierMessage.expediteur) === user?.id && (
                            <ReadStatus statut={c.dernierMessage.statut} sending={false} />
                          )}
                          {c.unread > 0 && !isActive && (
                            <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[#2196F3] text-white text-[10px] font-bold flex items-center justify-center">
                              {c.unread}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* ── Chat Panel ── */}
        <div className={`flex-1 flex flex-col bg-[#FAFAFA] ${activeId ? 'flex' : 'hidden lg:flex'}`}>
          {activeConv ? (
            <>
              {/* Chat Header */}
              <div className="flex items-center gap-3 px-4 lg:px-5 py-4 border-b border-gray-200 bg-white">
                <button className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 transition-colors" onClick={() => setActiveId(null)}>
                  <ArrowLeft className="w-5 h-5 text-gray-500" />
                </button>
                <div className="relative shrink-0">
                  <UserAvatar user={activeConv.info} size={40} />
                  {onlineUsers.has(String(activeConv.info?.id)) && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#4CAF50] border-2 border-white dark:border-primary-700" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#212121]">
                    {activeConv.info ? `${activeConv.info.prenom || ''} ${activeConv.info.nom || ''}`.trim() : t('medecin.messages.patient')}
                  </p>
                  <span className="text-[11px] text-gray-400">
                    {onlineUsers.has(String(activeConv.info?.id)) ? t('medecin.messages.online') : activeConv.info?.dernierePresence ? t('medecin.messages.seenAgo', { time: formatMsgTime(activeConv.info.dernierePresence, t, locale) }) : t('medecin.messages.patient')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Link href="/medecin/consultations" className="text-[11px] font-semibold text-[#2196F3] hover:text-blue-700 inline-flex items-center gap-1 shrink-0 transition-colors bg-blue-50 px-2 py-1 rounded-md">
                    {t('medecin.messages.consultationLink')} <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>

              {/* Messages Area */}
              <div ref={msgContainerRef} onScroll={handleMessagesScroll} className="flex-1 overflow-y-auto px-6 py-5">
                {/* Load more sentinel */}
                {loadingMore && (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                  </div>
                )}

                {dedupedMessages.length > 0 && (
                  <DateDivider label={
                    new Date(dedupedMessages[0].createdAt).toLocaleDateString(locale, { weekday: 'long' }).toUpperCase()
                  } />
                )}
                {dedupedMessages.map((m, idx) => {
                  const mine = idFromIri(m.expediteur) === user?.id
                  const mediaKind = msgMediaKind(m)
                  const prevSameSender = idx > 0 && idFromIri(dedupedMessages[idx - 1].expediteur) === idFromIri(m.expediteur)
                  const name = activeConv.info ? `${activeConv.info.prenom || ''} ${activeConv.info.nom || ''}`.trim() : t('medecin.messages.patient')
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'} mb-3`}>
                      {!mine && !prevSameSender && (
                        <div className="mr-2 self-end shrink-0">
                          <UserAvatar user={activeConv.info} size={36} />
                        </div>
                      )}
                      {!mine && prevSameSender && <div className="w-[44px] mr-2 shrink-0" />}
                      <div style={msgAnim} className={`max-w-[70%] ${mine ? 'order-1' : ''}`}>
                        {/* Image */}
                        {mediaKind === 'IMAGE' && msgMediaUrl(m) && (
                          <div className={`overflow-hidden mb-1 ${m.contenu ? 'rounded-t-[18px]' : 'rounded-[18px]'} shadow-sm bg-white`}>
                            <img src={msgMediaUrl(m)} alt="" className="w-full max-h-64 object-cover cursor-pointer hover:opacity-95 transition-opacity" onClick={(e) => { e.stopPropagation(); window.open(msgMediaUrl(m), '_blank') }} />
                          </div>
                        )}
                        {/* Video */}
                        {mediaKind === 'VIDEO' && msgMediaUrl(m) && (
                          <div className={`overflow-hidden mb-1 ${m.contenu ? 'rounded-t-[18px]' : 'rounded-[18px]'} bg-black shadow-sm`}>
                            <video controls playsInline preload="metadata" src={msgMediaUrl(m)} className="w-full max-h-72 bg-black" />
                          </div>
                        )}
                        {/* Voice */}
                        {mediaKind === 'VOIX' && msgMediaUrl(m) && (
                          <div className={`px-4 py-3 shadow-sm ${mine ? 'bg-[#2196F3]' : 'bg-[#EDEDED]'} ${m.contenu ? 'rounded-t-[18px]' : 'rounded-[18px]'} ${mine ? 'text-white rounded-br-[4px]' : 'rounded-bl-[4px]'}`}>
                            <audio controls src={msgMediaUrl(m)} className="w-full h-10" />
                            {m.dureeVoix > 0 && <p className={`text-[10px] mt-1 ${mine ? 'text-white/70' : 'text-gray-500'}`}>{formatDuration(m.dureeVoix)}</p>}
                          </div>
                        )}
                        {/* File */}
                        {mediaKind === 'FICHIER' && m.media && (
                          <a href={msgMediaUrl(m)} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-3 p-4 shadow-sm hover:opacity-80 transition-opacity ${mine ? 'bg-[#2196F3] text-white' : 'bg-white'} ${m.contenu ? 'rounded-t-[18px]' : 'rounded-[18px]'} ${mine ? 'rounded-br-[4px]' : 'rounded-bl-[4px]'}`}>
                            <div className={`p-2 rounded-lg ${mine ? 'bg-white/20' : 'bg-gray-100'}`}>
                              <FileText className={`w-5 h-5 ${mine ? 'text-white' : 'text-[#212121]'}`} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold truncate">{m.media.originalName || t('medecin.messages.fileFallback')}</p>
                              <p className={`text-[11px] ${mine ? 'text-white/70' : 'text-gray-500'}`}>{formatFileSize(m.media.size, t)}</p>
                            </div>
                          </a>
                        )}
                        {/* Text */}
                        {(m.contenu || m.typeMessage === 'TEXTE' || (!m.typeMessage && m.contenu)) && (
                          <div className={`px-4 py-2.5 shadow-sm ${
                            mine ? 'bg-[#2196F3] text-white rounded-[18px] rounded-br-[4px]' : 'bg-[#EDEDED] text-[#212121] rounded-[18px] rounded-bl-[4px]'
                          }`}>
                            <p className="text-sm leading-relaxed">{m.contenu}</p>
                            <div className={`flex items-center gap-1 mt-1 ${mine ? 'justify-end' : 'justify-start'}`}>
                              <span className={`text-[10px] ${mine ? 'text-white/60' : 'text-gray-400'}`}>
                                {formatMsgTime(m.createdAt, t, locale)}
                              </span>
                              {mine && <ReadStatus statut={m.statut} sending={m._sending} />}
                            </div>
                          </div>
                        )}
                      </div>
                      {mine && !prevSameSender && (
                        <div className="ml-2 self-end shrink-0">
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold text-[10px]"
                            style={{ backgroundColor: '#2196F3', fontSize: 10 }}
                          >
                            <UserAvatar user={user} size={36} />
                          </div>
                        </div>
                      )}
                      {mine && prevSameSender && <div className="w-[44px] ml-2 shrink-0" />}
                    </div>
                  )
                })}
                <div ref={bottomRef} />
              </div>

              {/* Input Bar */}
              <div className="border-t border-gray-200 bg-white">
                {attachments.length > 0 && (
                  <div className="flex gap-2 p-3 overflow-x-auto border-b border-gray-200">
                    {attachments.map((att) => (
                      <div key={att.id} className="relative shrink-0 w-16 h-16 rounded-xl overflow-hidden bg-gray-100 ring-1 ring-gray-200">
                        {att.preview && isImageMime(att.mime) ? (
                          <img src={att.preview} alt="" className="w-full h-full object-cover" />
                        ) : att.preview && isVideoMime(att.mime) ? (
                          <video src={att.preview} muted playsInline preload="metadata" className="w-full h-full object-cover bg-black" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            {isVideoMime(att.mime) ? <Video className="w-5 h-5 text-gray-400" /> :
                             isImageMime(att.mime) ? <ImageIcon className="w-5 h-5 text-gray-400" /> :
                             isAudioMime(att.mime) ? <Mic className="w-5 h-5 text-gray-400" /> :
                             <FileText className="w-5 h-5 text-gray-400" />}
                          </div>
                        )}
                        <button onClick={() => removeAttachment(att.id)} className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors">
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {recording && (
                  <div className="flex items-center gap-3 px-5 py-3 bg-red-50 border-b border-gray-200">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-sm font-semibold text-red-500">{formatDuration(recordTimer)}</span>
                    <button onClick={stopRecording} className="ml-auto p-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors">
                      <Square className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-3 px-5 py-4">
                  <div className="relative">
                    <button onClick={() => setShowAttachMenu((v) => !v)} disabled={sending || recording} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 transition-colors">
                      <svg className="w-5 h-5 text-gray-500 -rotate-45" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                    </button>
                    {showAttachMenu && (
                      <div className="absolute bottom-full left-0 mb-2 bg-white rounded-2xl shadow-lg border border-gray-200 p-2 flex gap-1 z-10">
                        <button onClick={() => handleAttach('camera')} className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl hover:bg-gray-50 text-[#212121] transition-colors">
                          <Camera className="w-5 h-5" /><span className="text-[10px] font-medium">{t('medecin.messages.attachCamera')}</span>
                        </button>
                        <button onClick={() => handleAttach('gallery')} className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl hover:bg-gray-50 text-[#212121] transition-colors">
                          <ImageIcon className="w-5 h-5" /><span className="text-[10px] font-medium">{t('medecin.messages.attachPhotos')}</span>
                        </button>
                        <button onClick={() => handleAttach('doc')} className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl hover:bg-gray-50 text-[#212121] transition-colors">
                          <FileText className="w-5 h-5" /><span className="text-[10px] font-medium">{t('medecin.messages.attachDocument')}</span>
                        </button>
                        <button onClick={() => handleAttach('voice')} className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl hover:bg-gray-50 text-[#212121] transition-colors">
                          <Mic className="w-5 h-5" /><span className="text-[10px] font-medium">{t('medecin.messages.attachVoice')}</span>
                        </button>
                      </div>
                    )}
                  </div>
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleSend()
                      }
                    }}
                    placeholder={recording ? t('medecin.messages.recordingPlaceholder') : uploadingMedia ? t('medecin.messages.uploadingPlaceholder') : t('medecin.messages.typeMessagePlaceholder')}
                    disabled={recording || uploadingMedia}
                    className="flex-1 text-sm text-[#212121] placeholder-gray-400 bg-transparent outline-none disabled:opacity-40"
                  />
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={sending || (!draft.trim() && attachments.length === 0) || recording}
                    className={`text-xs font-bold tracking-wider uppercase transition-colors ${
                      draft.trim() || attachments.length > 0 ? 'text-[#2196F3] hover:text-blue-700' : 'text-gray-300'
                    } disabled:opacity-50`}
                  >
                    {uploadingMedia ? <Loader2 className="w-4 h-4 animate-spin inline" /> : t('medecin.messages.send')}
                  </button>
                </div>
              </div>
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => handleFilePick(e, false)} />
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/ogg,video/quicktime" multiple hidden onChange={(e) => handleFilePick(e, true)} />
              <input ref={docRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z" multiple hidden onChange={(e) => handleFilePick(e, true)} />
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-[#2196F3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="font-semibold text-[#212121] text-lg mb-1">{t('medecin.messages.selectConversation')}</h3>
              <p className="text-sm text-gray-500 max-w-xs">{t('medecin.messages.selectConversationDesc')}</p>
            </div>
          )}
        </div>
      </div>

      {/* New Conversation Modal */}
      {showNew && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6" onClick={() => setShowNew(false)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-[#212121]">{t('medecin.messages.newConversation')}</h3>
              <button onClick={() => setShowNew(false)} className="p-1 rounded-lg hover:bg-gray-100 transition-colors"><X className="w-5 h-5 text-gray-400" /></button>
            </div>

            {/* Search users */}
            <div className="relative mb-4">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder={t('medecin.messages.searchUserPlaceholder')}
                className="w-full pl-9 pr-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#2196F3]/20 focus:border-[#2196F3] transition-all"
              />
            </div>

            <div className="space-y-1 max-h-72 overflow-y-auto">
              {loadingUsers ? (
                <LoadingSpinner size="sm" label={t('medecin.messages.loadingUsers')} />
              ) : allUsers.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">{t('medecin.messages.noUserFound')}</p>
              ) : (
                allUsers
                  .filter(u => {
                    if (!userSearch.trim()) return true
                    const q = userSearch.toLowerCase()
                    const name = `${u.prenom || ''} ${u.nom || ''}`.toLowerCase()
                    return name.includes(q) || (u.email || '').toLowerCase().includes(q)
                  })
                  .map((u) => {
                    const name = `${u.prenom || ''} ${u.nom || ''}`.trim()
                    return (
                      <button
                        key={u.id}
                        onClick={async () => {
                          setShowNew(false)
                          try {
                            const convId = await findOrCreateConv(u.id)
                            setActiveId(convId)
                          } catch {
                            toast.error(t('medecin.messages.createConversationError'))
                          }
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 text-left transition-colors"
                      >
                        <UserAvatar user={u} size={40} />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#212121] truncate">{name}</p>
                          <p className="text-xs text-gray-400 truncate">{u.email || ''}</p>
                        </div>
                      </button>
                    )
                  })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
