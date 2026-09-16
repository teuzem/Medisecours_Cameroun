// @ts-nocheck
'use client'

import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '../../../i18n'
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
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Send, CheckCheck, Check, Plus, X, ExternalLink, Loader2, Paperclip, Mic, Square, FileText, ImageIcon, Video, Camera, Search, ChevronDown } from 'lucide-react'
import useSWR, { mutate as globalMutate } from 'swr'
import api from '../../../api/axios'
import { fetcher } from '../../../lib/fetcher'
import { UNREAD_MESSAGES_KEY } from '../../../lib/keys'
import { useAuth } from '../../../hooks/useAuth'
import { useNotification } from '../../../contexts/NotificationContext'

import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import EmptyState from '../../../components/ui/EmptyState'
import { useToast } from '../../../components/ui/Toast'
import UserAvatar from '../../../components/messages/UserAvatar'
import DateDivider from '../../../components/messages/DateDivider'
import ReadStatus from '../../../components/messages/ReadStatus'

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
  if (bytes < 1024) return t('patient.messages.fileSizeB', { size: bytes })
  if (bytes < 1048576) return t('patient.messages.fileSizeKB', { size: (bytes / 1024).toFixed(1) })
  return t('patient.messages.fileSizeMB', { size: (bytes / 1048576).toFixed(1) })
}

function formatMsgTime(dateStr, t) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = new Date()
  const diff = (now - d) / 1000
  const locale = i18n.language === 'en' ? 'en-GB' : 'fr-FR'
  if (diff < 60) return t('patient.messages.timeJustNow')
  if (diff < 3600) return t('patient.messages.timeMinutes', { count: Math.floor(diff / 60) })
  if (diff < 86400) return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  if (diff < 172800) return t('patient.messages.timeYesterday', { time: d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) })
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

function lastMsgPreview(m, t) {
  if (!m) return ''
  const kind = msgMediaKind(m)
  if (kind === 'IMAGE') return '📷 ' + t('patient.messages.previewImage')
  if (kind === 'VOIX') return '🎤 ' + t('patient.messages.previewVoice')
  if (kind === 'VIDEO') return '🎥 ' + t('patient.messages.previewVideo')
  if (kind === 'FICHIER') return '📎 ' + (m.media?.originalName || t('patient.messages.file'))
  return m.contenu || ''
}

function sameMsg(a, b) {
  const idA = String(a.id ?? a['@id'] ?? '')
  const idB = String(b.id ?? b['@id'] ?? '')
  return idA !== '' && idB !== '' && idA === idB
}

export default function PatientMessagesPage() {
  const { t } = useTranslation()
  return (
    <Suspense fallback={<LoadingSpinner label={t('common.loading')} />}>
      <PatientMessagesContent />
    </Suspense>
  )
}

function PatientMessagesContent() {
  const { user } = useAuth()
  const {
    setActiveConversationId,
    subscribeToMessages,
    subscribeToProfileChanges,
    onlineUsers,
  } = useNotification()
  const toast = useToast()
  const { t } = useTranslation()
  const searchParams = useSearchParams()
  const preselectConv = searchParams.get('conversation')

  const [activeId, setActiveId] = useState(preselectConv || null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
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
  const [unreadCounts, setUnreadCounts] = useState(new Map())
  const bottomRef = useRef(null)
  const fileRef = useRef(null)
  const docRef = useRef(null)
  const cameraRef = useRef(null)
  const inputRef = useRef(null)
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
  const scrollTimersRef = useRef([])

  const scrollToLatestMessage = useCallback((behavior = 'smooth') => {
    scrollTimersRef.current.forEach(timer => window.clearTimeout(timer))
    scrollTimersRef.current = [0, 120, 400, 1000].map((delay) =>
      window.setTimeout(() => {
        const container = msgContainerRef.current
        if (!container) return
        container.scrollTo({
          top: container.scrollHeight,
          behavior: delay === 0 ? behavior : 'auto',
        })
      }, delay)
    )
  }, [])

  useEffect(() => () => {
    scrollTimersRef.current.forEach(timer => window.clearTimeout(timer))
  }, [])

  const { data: convData, isLoading: convLoading, error: convError, mutate: mutateConvs } = useSWR('/api/conversations', fetcher, { revalidateOnFocus: false, keepPreviousData: true })

  const activeIdNum = activeId ? Number(activeId) : null
  const { data: msgData, isLoading: msgLoading, error: msgError, mutate: mutateMsgs } = useSWR(
    activeIdNum ? `/api/messages?conversation=/api/conversations/${activeIdNum}&order[createdAt]=DESC&order[id]=DESC&itemsPerPage=${MSGS_PER_PAGE}&page=${msgPage}` : null,
    fetcher,
    { revalidateOnFocus: false }
  )

  // Keep refs in sync
  useEffect(() => {
    activeIdRef.current = activeId
    loadingMoreRef.current = loadingMore
    hasMoreRef.current = hasMore
    msgLoadingRef.current = msgLoading
  })

  // Detect mobile vs desktop for the panel slide animation
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  // Focus the input when a conversation is selected
  useEffect(() => {
    if (activeId) {
      const t = setTimeout(() => inputRef.current?.focus(), 120)
      return () => clearTimeout(t)
    }
  }, [activeId])

  // Reset pagination when switching conversations
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setMsgPage(1)
      setAllLoadedMsgs([])
      setHasMore(true)
      setLoadingMore(false)
      initialPageReadyRef.current = false
    }, 0)
    return () => window.clearTimeout(timer)
  }, [activeId])

  // Append newly fetched page to allLoadedMsgs
  useEffect(() => {
    if (!msgData) return
    const arr = Array.isArray(msgData) ? msgData : msgData['hydra:member'] || []
    // Keep only messages belonging to the active conversation (protect against keepPreviousData)
    const activeMsgs = arr.filter((m) => {
      const convIri = typeof m.conversation === 'object' ? (m.conversation['@id'] || m.conversation.id) : m.conversation
      const convId = idFromIri(convIri)
      return !convId || String(convId) === String(activeIdNum)
    })
    if (activeMsgs.length < MSGS_PER_PAGE) {
      window.setTimeout(() => setHasMore(false), 0)
    }

    const container = msgContainerRef.current
    const prevScrollHeight = container ? container.scrollHeight : 0

    window.setTimeout(() => {
      if (msgPage === 1) {
        setAllLoadedMsgs(activeMsgs)
        setTimeout(() => {
          scrollToLatestMessage('auto')
          initialPageReadyRef.current = true
        }, 100)
      } else {
        olderPageMergeRef.current = true
        setAllLoadedMsgs(prev => {
          const existingIds = new Set(prev.map(m => String(m.id ?? m['@id'])))
          const newMsgs = activeMsgs.filter(m => !existingIds.has(String(m.id ?? m['@id'])))
          return newMsgs.length > 0 ? [...prev, ...newMsgs] : prev
        })
      }
      setLoadingMore(false)
    }, 0)

    if (msgPage > 1 && container) {
      window.setTimeout(() => {
        requestAnimationFrame(() => {
          const newScrollHeight = container.scrollHeight
          container.scrollTop += newScrollHeight - prevScrollHeight
        })
      }, 0)
    }
  }, [msgData, msgPage, activeIdNum, scrollToLatestMessage])

  // Scroll to bottom on new conversation
  useEffect(() => {
    if (activeId) {
      setTimeout(() => scrollToLatestMessage('auto'), 50)
    }
  }, [activeId, scrollToLatestMessage])

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
    scrollToLatestMessage('smooth')
  }, [allLoadedMsgs.length, scrollToLatestMessage])

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

  // Auto-fetch missing participant user info
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

  const mediaCache = useMemo(() => new Map(), [])
  const [, bumpMediaCacheVersion] = useState(0)

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
    if (convError || msgError) toast.error(t('patient.messages.loadError'))
  }, [convError, msgError, toast, t])

  useEffect(() => {
    const unsubscribeMessages = subscribeToMessages((msg) => {
      if (msg._type === 'message_read') {
        setAllLoadedMsgs((prev) => prev.map((m) => sameMsg(m, msg) ? { ...m, statut: 'LU' } : m))
        return
      }
      if (msg._type === 'message_delivered') {
        setAllLoadedMsgs((prev) => prev.map((m) => sameMsg(m, msg) ? { ...m, statut: 'LIVRE' } : m))
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
        // Optimistic update without network revalidation
        mutateConvs((current) => {
          if (!current) return current
          const arr = Array.isArray(current) ? current : current['hydra:member'] || []
          const newArr = arr.map(c => String(c.id) === convId ? { ...c, dernierMessage: msg } : c)
          newArr.sort((a, b) => (b.dernierMessage ? new Date(b.dernierMessage.createdAt).getTime() : 0) - (a.dernierMessage ? new Date(a.dernierMessage.createdAt).getTime() : 0))
          return Array.isArray(current) ? newArr : { ...current, 'hydra:member': newArr }
        }, { revalidate: false })
        return
      }
      if (convId && convId === currentActiveId) {
        setAllLoadedMsgs(prev => {
          if (prev.some(m => sameMsg(m, msg))) return prev
          return [msg, ...prev]
        })
        scrollToLatestMessage('smooth')

        const activeIdNum = Number(currentActiveId)
        const msgKey = `/api/messages?conversation=/api/conversations/${activeIdNum}&order[createdAt]=DESC&order[id]=DESC&itemsPerPage=${MSGS_PER_PAGE}&page=1`
        globalMutate(msgKey, (currentCache) => {
          const arr = Array.isArray(currentCache) ? currentCache : (currentCache?.['hydra:member'] || [])
          if (arr.some(m => String(m.id ?? m['@id']) === String(msg.id ?? msg['@id']))) return currentCache
          const newArr = [msg, ...arr]
          return Array.isArray(currentCache) ? newArr : { ...currentCache, 'hydra:member': newArr }
        }, { revalidate: false })

        api.patch(`/api/conversations/${convId}/read`)
          .then(() => globalMutate(UNREAD_MESSAGES_KEY))
          .catch(() => {})

        // Optimistic update without network revalidation
        mutateConvs((current) => {
          if (!current) return current
          const arr = Array.isArray(current) ? current : current['hydra:member'] || []
          const newArr = arr.map(c => String(c.id) === convId ? { ...c, dernierMessage: msg } : c)
          return Array.isArray(current) ? newArr : { ...current, 'hydra:member': newArr }
        }, { revalidate: false })
      }
    })

    const unsubscribeProfiles = subscribeToProfileChanges((data) => {
      if (!data?.userId || !('photoProfil' in data)) return
      setAllUsers(prev => {
        const idx = prev.findIndex(u => String(u.id) === String(data.userId))
        if (idx === -1) return prev
        const updated = [...prev]
        updated[idx] = { ...updated[idx], photoProfil: data.photoProfil }
        return updated
      })
    })

    return () => {
      unsubscribeMessages()
      unsubscribeProfiles()
    }
  }, [subscribeToMessages, subscribeToProfileChanges, mutateConvs, scrollToLatestMessage, user?.id])

  useEffect(() => {
    setActiveConversationId(activeId)
    if (!activeId) return

    const t = setTimeout(() => {
      setUnreadCounts(prev => {
        const next = new Map(prev)
        next.set(activeId, 0)
        return next
      })
    }, 0)

    return () => {
      clearTimeout(t)
      setActiveConversationId(null)
    }
  }, [activeId, setActiveConversationId])

  const resolvedMessages = activeMessagesRaw.map(m => {
    if (m.media && typeof m.media === 'string' && /\/(media_objects|media)\//.test(m.media)) {
      const cached = mediaCache.get(m.media)
      if (cached) return { ...m, media: cached }
    }
    return m
  })


  const userInfoMap = useMemo(() => {
    const map = new Map()
    for (const u of allUsers) map.set(String(u.id), u)
    return map
  }, [allUsers])

  const getUserInfo = useCallback((participant) => {
    if (!participant) return null
    if (typeof participant === 'object') {
      if (participant.nom || participant.prenom) return participant
      return userInfoMap.get(String(participant.id)) || participant
    }
    return userInfoMap.get(String(idFromIri(participant))) || null
  }, [userInfoMap])

  const convMap = useMemo(() => {
    const map = new Map()
    for (const c of conversations) {
      const other = c.participants?.find((p) => {
        const pId = typeof p === 'object' ? p.id : idFromIri(p)
        return String(pId) !== String(user?.id)
      })

      const lastMsg = c.dernierMessage || null
      const unread = unreadCounts.get(String(c.id)) || 0
      map.set(String(c.id), {
        id: String(c.id),
        other: other,
        messages: [],
        unread,
        dernierMessage: lastMsg,
      })
    }
    return map
  }, [conversations, user, unreadCounts])

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
      const info = getUserInfo(c.other)
      const name = info ? `${info.prenom || ''} ${info.nom || ''}`.toLowerCase() : ''
      const lastMsg = lastMsgPreview(c.dernierMessage, t).toLowerCase()
      return name.includes(q) || lastMsg.includes(q)
    })
    return filtered.sort((a, b) => {
      const la = convLastTime(a)
      const lb = convLastTime(b)
      return String(lb).localeCompare(String(la))
    })
  }, [convMap, convSearch, getUserInfo, t])

  const openNewConversation = () => {
    setShowNew(true)
    if (allUsers.length === 0 && !loadingUsers) {
      setLoadingUsers(true)
      api.get('/api/medecins-publics')
        .then((res) => {
          const raw = res.data?.member ?? res.data?.['hydra:member'] ?? (Array.isArray(res.data) ? res.data : [])
          const filtered = raw.filter(u => String(u.id) !== String(user?.id))
          setAllUsers(filtered)
          if (filtered.length === 0) {
            toast.info(t('patient.messages.noDoctorFound'))
          }
        })
        .catch(() => toast.error(t('patient.messages.doctorsLoadError')))
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
    if (!preselectConv || convLoading || !user || preselectStarted.current) return
    preselectStarted.current = true
    const convId = Number(preselectConv)
    if (!convId) return
    const timer = window.setTimeout(() => setActiveId(String(convId)), 0)
    return () => window.clearTimeout(timer)
  }, [preselectConv, convLoading, user])

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
        toast.error(t('patient.messages.fileTooLarge', { name: f.name }))
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
    if (!navigator.mediaDevices?.getUserMedia) { toast.error(t('patient.messages.voiceNotSupported')); return }
    setShowAttachMenu(false)
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      streamRef.current = stream
      const mr = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm' })
      const chunks = []
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
      mr.onstop = () => {
        const blob = new Blob(chunks, { type: mr.mimeType })
        setRecordingBlob(blob)
        setAttachments((prev) => [...prev, { id: crypto.randomUUID?.() || Date.now() + '-' + Math.random(), file: blob, preview: URL.createObjectURL(blob), name: t('patient.messages.voiceFileName'), size: blob.size, mime: mr.mimeType }])
        stream.getTracks().forEach((t) => t.stop())
      }
      recorderRef.current = mr
      mr.start(250)
      setRecording(true)
      setRecordTimer(0)
      recordTimerRef.current = setInterval(() => setRecordTimer((t) => t + 1), 1000)
    }).catch(() => toast.error(t('patient.messages.micUnavailable')))
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

    const optimisticConvMutate = (content: string) => {
      mutateConvs((prev: any) => {
        if (!prev) return prev
        const arr = Array.isArray(prev) ? prev : prev?.['hydra:member'] || []
        const next = arr.map((c: any) => {
          if (String(c.id) === String(currentActiveId)) {
            return { ...c, dernierMessage: { contenu: content.slice(0, 80), createdAt: new Date().toISOString(), expediteur: { id: user?.id } } }
          }
          return c
        })
        return Array.isArray(prev) ? next : { ...prev, 'hydra:member': next }
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
      optimisticConvMutate(caption || '📎 ' + t('patient.messages.file'))
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
        globalMutate(msgKey, (currentCache) => {
          const arr = Array.isArray(currentCache) ? currentCache : (currentCache?.['hydra:member'] || [])
          const createdIds = new Set(created.map(m => String(m.id ?? m['@id'])))
          const next = [...created, ...arr.filter(m => !createdIds.has(String(m.id ?? m['@id'])))]
          if (!currentCache || Array.isArray(currentCache)) return next
          return { ...currentCache, 'hydra:member': next }
        }, { revalidate: false })
      } catch (error) {
        toast.error(error?.response?.data?.error || error?.response?.data?.detail || t('patient.messages.mediaSendError'))
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
    setAllLoadedMsgs(prev => [temp, ...prev])
    optimisticConvMutate(content)
    setDraft('')
    setSending(true)
    try {
      const { data: created } = await api.post('/api/messages', { contenu: content, conversation: convIri }, { headers: { 'Content-Type': 'application/ld+json' } })
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
    } catch {
      setAllLoadedMsgs(prev => prev.filter(m => m.id !== tempId))
      toast.error(t('patient.messages.messageSendError'))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="h-[calc(100dvh_-_140px_-_env(safe-area-inset-bottom,0px))] xl:h-[calc(100dvh_-_96px)] w-full bg-gradient-to-br from-blue-50 to-blue-100 overflow-hidden lg:p-4">
      <div className="h-full max-w-7xl mx-auto bg-white lg:rounded-[12px] lg:shadow-xl overflow-hidden relative flex flex-col">
        {/* ── Panels container ── */}
        <div className="relative flex flex-1 min-h-0">
        {/* ── Sidebar ── */}
        <motion.div
          className="absolute inset-y-0 left-0 z-20 w-full md:static md:z-auto md:w-80 md:min-w-[320px] md:flex-shrink-0 border-r border-gray-200 bg-white flex flex-col min-h-0 overflow-hidden"
          initial={false}
          animate={{ x: isMobile ? (activeId ? '-100%' : '0%') : 0 }}
          transition={{ type: 'tween', duration: 0.25, ease: 'easeInOut' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200">
            <h2 className="text-sm font-bold tracking-[0.15em] text-[#212121] uppercase">{t('layout.messages')}</h2>
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
                placeholder={t('patient.messages.searchConversation')}
                className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#2196F3]/20 focus:border-[#2196F3] transition-all"
              />
            </div>
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {sortedConvs.length === 0 ? (
              <EmptyState title={convSearch ? t('patient.messages.noResultTitle') : t('patient.messages.noConversationTitle')} description={convSearch ? t('patient.messages.noResultDesc') : t('patient.messages.noConversationDesc')} />
            ) : (
              sortedConvs.map((c) => {
                const isActive = activeId === c.id
                const info = getUserInfo(c.other)
                const name = info ? `${info.prenom || ''} ${info.nom || ''}`.trim() || t('patient.doctor') : t('patient.doctor')
                return (
                  <button
                    key={c.id}
                    onClick={() => setActiveId(c.id)}
                    className={`w-full flex items-center gap-3 px-4 py-4 text-left transition-colors duration-150 ${
                      isActive ? 'bg-[#2196F3]' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="relative shrink-0">
                      <UserAvatar user={info} size={48} />
                      {onlineUsers.has(String(info?.id)) && (
                        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#4CAF50] border-2 border-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-sm font-semibold truncate ${isActive ? 'text-white' : 'text-[#212121]'}`}>
                          {t('patient.doctorTitle', { name })}
                        </span>
                        {c.dernierMessage?.createdAt && (
                          <span className={`text-[11px] shrink-0 ${isActive ? 'text-white/80' : 'text-gray-400'}`}>
                            {formatMsgTime(c.dernierMessage.createdAt, t)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <span className={`text-xs truncate ${isActive ? 'text-white/80' : 'text-gray-500'}`}>
                          {lastMsgPreview(c.dernierMessage, t)}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {c.dernierMessage && idFromIri(c.dernierMessage.expediteur) === user?.id && (
                            <span className={isActive ? 'text-white' : 'text-gray-400'}>
                              <CheckCheck className="w-3.5 h-3.5" />
                            </span>
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
        </motion.div>

        {/* ── Chat Panel ── */}
        <motion.div
          className="absolute inset-y-0 right-0 z-10 w-full md:static md:z-auto md:flex-1 flex flex-col min-h-0 overflow-hidden bg-[#FAFAFA]"
          initial={false}
          animate={{ x: isMobile ? (activeId ? '0%' : '100%') : 0 }}
          transition={{ type: 'tween', duration: 0.25, ease: 'easeInOut' }}
        >
          {activeConv ? (
            <>
              {/* Chat Header */}
              <div className="shrink-0 flex items-center gap-3 px-4 lg:px-5 py-3 lg:py-4 border-b border-gray-200 bg-white">
                <button className="md:hidden p-1.5 rounded-lg hover:bg-gray-100 transition-colors" onClick={() => setActiveId(null)}>
                  <ArrowLeft className="w-5 h-5 text-gray-500" />
                </button>
                <div className="relative shrink-0">
                  <UserAvatar user={getUserInfo(activeConv.other)} size={40} />
                  {onlineUsers.has(String(getUserInfo(activeConv.other)?.id)) && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#4CAF50] border-2 border-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#212121]">
                    {t('patient.doctorTitle', {
                      name: getUserInfo(activeConv.other)
                        ? `${getUserInfo(activeConv.other).prenom || ''} ${getUserInfo(activeConv.other).nom || ''}`.trim()
                        : t('patient.doctor'),
                    })}
                  </p>
                  <span className="text-[11px] text-gray-400">
                    {onlineUsers.has(String(getUserInfo(activeConv.other)?.id)) ? t('patient.messages.online') : getUserInfo(activeConv.other)?.dernierePresence ? t('patient.messages.lastSeen', { time: formatMsgTime(getUserInfo(activeConv.other).dernierePresence, t) }) : t('patient.doctor')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Link href="/patient/consultations" className="text-[11px] font-semibold text-[#2196F3] hover:text-blue-700 inline-flex items-center gap-1 shrink-0 transition-colors bg-blue-50 px-2 py-1 rounded-md">
                    {t('consultations.title')} <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>

              {/* Messages Area */}
              <div ref={msgContainerRef} onScroll={handleMessagesScroll} className="flex-1 overflow-y-auto min-h-0 px-6 py-5">
                {loadingMore && (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                  </div>
                )}

                {dedupedMessages.length > 0 && (
                  <DateDivider label={
                    new Date(dedupedMessages[0].createdAt).toLocaleDateString(i18n.language === 'en' ? 'en-GB' : 'fr-FR', { weekday: 'long' }).toUpperCase()
                  } />
                )}
                {dedupedMessages.map((m, idx) => {
                  const mine = idFromIri(m.expediteur) === user?.id
                  const mediaKind = msgMediaKind(m)
                  const isLatest = idx === dedupedMessages.length - 1
                  const prevSameSender = idx > 0 && idFromIri(dedupedMessages[idx - 1].expediteur) === idFromIri(m.expediteur)
                  const convInfo = getUserInfo(activeConv.other)
                  const name = convInfo ? `${convInfo.prenom || ''} ${convInfo.nom || ''}`.trim() : t('patient.doctor')
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'} mb-3`}>
                      {!mine && !prevSameSender && (
                        <div className="mr-2 self-end shrink-0">
                          <UserAvatar user={convInfo} size={36} />
                        </div>
                      )}
                      {!mine && prevSameSender && <div className="w-[44px] mr-2 shrink-0" />}
                      <div style={msgAnim} className={`max-w-[70%] ${mine ? 'order-1' : ''}`}>
                        {/* Image */}
                        {mediaKind === 'IMAGE' && msgMediaUrl(m) && (
                          <div className={`overflow-hidden mb-1 ${m.contenu ? 'rounded-t-[18px]' : 'rounded-[18px]'} shadow-sm bg-white`}>
                            <img src={msgMediaUrl(m)} alt="" className="w-full max-h-64 object-cover cursor-pointer hover:opacity-95 transition-opacity" onLoad={isLatest ? () => scrollToLatestMessage('auto') : undefined} onClick={(e) => { e.stopPropagation(); window.open(msgMediaUrl(m), '_blank') }} />
                          </div>
                        )}
                        {/* Video */}
                        {mediaKind === 'VIDEO' && msgMediaUrl(m) && (
                          <div className={`overflow-hidden mb-1 ${m.contenu ? 'rounded-t-[18px]' : 'rounded-[18px]'} bg-black shadow-sm`}>
                            <video controls playsInline preload="metadata" src={msgMediaUrl(m)} onLoadedMetadata={isLatest ? () => scrollToLatestMessage('auto') : undefined} className="w-full max-h-72 bg-black" />
                          </div>
                        )}
                        {/* Voice */}
                        {mediaKind === 'VOIX' && msgMediaUrl(m) && (
                          <div className={`px-4 py-3 shadow-sm ${mine ? 'bg-[#2196F3]' : 'bg-[#EDEDED]'} ${m.contenu ? 'rounded-t-[18px]' : 'rounded-[18px]'} ${mine ? 'text-white rounded-br-[4px]' : 'rounded-bl-[4px]'}`}>
                            <audio controls src={msgMediaUrl(m)} onLoadedMetadata={isLatest ? () => scrollToLatestMessage('auto') : undefined} className="w-full h-10" />
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
                              <p className="text-sm font-semibold truncate">{m.media.originalName || t('patient.messages.file')}</p>
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
                                {formatMsgTime(m.createdAt, t)}
                              </span>
                              {mine && <ReadStatus statut={m.statut} sending={m._sending} />}
                            </div>
                          </div>
                        )}
                      </div>
                      {mine && !prevSameSender && (
                        <div className="ml-2 self-end shrink-0">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold text-[10px]" style={{ backgroundColor: '#2196F3', fontSize: 10 }}>
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
              <div className="shrink-0 border-t border-gray-200 bg-white">
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
                          <Camera className="w-5 h-5" /><span className="text-[10px] font-medium">{t('patient.messages.attachCamera')}</span>
                        </button>
                        <button onClick={() => handleAttach('gallery')} className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl hover:bg-gray-50 text-[#212121] transition-colors">
                          <ImageIcon className="w-5 h-5" /><span className="text-[10px] font-medium">{t('patient.messages.attachPhotos')}</span>
                        </button>
                        <button onClick={() => handleAttach('doc')} className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl hover:bg-gray-50 text-[#212121] transition-colors">
                          <FileText className="w-5 h-5" /><span className="text-[10px] font-medium">{t('patient.messages.attachDocument')}</span>
                        </button>
                        <button onClick={() => handleAttach('voice')} className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl hover:bg-gray-50 text-[#212121] transition-colors">
                          <Mic className="w-5 h-5" /><span className="text-[10px] font-medium">{t('patient.messages.attachVoice')}</span>
                        </button>
                      </div>
                    )}
                  </div>
                  <input
                    ref={inputRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleSend()
                      }
                    }}
                    placeholder={recording ? t('patient.messages.recordingPlaceholder') : uploadingMedia ? t('patient.messages.uploadingPlaceholder') : t('patient.messages.inputPlaceholder')}
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
                    {uploadingMedia ? <Loader2 className="w-4 h-4 animate-spin inline" /> : t('patient.messages.send')}
                  </button>
                </div>
              </div>
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => handleFilePick(e, false)} />
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/ogg,video/quicktime" multiple hidden onChange={(e) => handleFilePick(e, true)} />
              <input ref={docRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z" multiple hidden onChange={(e) => handleFilePick(e, true)} />
            </>
          ) : (
            <div className="hidden md:flex flex-col items-center justify-center h-full text-center px-6">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-[#2196F3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="font-semibold text-[#212121] text-lg mb-1">{t('patient.messages.selectConversationTitle')}</h3>
              <p className="text-sm text-gray-500 max-w-xs">{t('patient.messages.selectConversationDesc')}</p>
            </div>
          )}
        </motion.div>
        </div>
      </div>

      {/* New Conversation Modal — bottom sheet on mobile, centered on desktop */}
      <AnimatePresence>
        {showNew && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 md:flex md:items-center md:justify-center md:p-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setShowNew(false)}
            >
              {/* Sheet / Modal */}
              <motion.div
                initial={{ y: '100%', opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: '100%', opacity: 0 }}
                transition={{ type: 'spring', damping: 28, stiffness: 350 }}
                onClick={(e) => e.stopPropagation()}
                className="fixed bottom-0 left-0 right-0 z-50 md:static md:w-full md:max-w-md bg-white rounded-t-2xl md:rounded-2xl shadow-xl flex flex-col max-h-[80vh] md:max-h-[520px]"
              >
                {/* Handle (mobile only) */}
                <div className="md:hidden flex justify-center pt-3 pb-1">
                  <div className="w-10 h-1 rounded-full bg-gray-200" />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
                  <h3 className="font-display font-bold text-base text-[#212121]">{t('patient.messages.newConversation')}</h3>
                  <button onClick={() => setShowNew(false)} className="p-1.5 rounded-full text-gray-400 hover:bg-gray-100 transition-colors" aria-label={t('common.close')}>
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Search */}
                <div className="px-4 py-3 border-b border-gray-100">
                  <div className="relative">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder={t('patient.messages.searchDoctor')}
                      className="w-full pl-9 pr-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#2196F3]/20 focus:border-[#2196F3] transition-all"
                    />
                  </div>
                </div>

                {/* Doctor list */}
                <div className="flex-1 overflow-y-auto py-1">
                  {loadingUsers ? (
                    <LoadingSpinner size="sm" label={t('patient.messages.doctorsLoading')} />
                  ) : allUsers.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-8">{t('patient.messages.noDoctorFound')}</p>
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
                                toast.error(t('patient.messages.createConversationError'))
                              }
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                          >
                            <UserAvatar user={u} size={40} />
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-[#212121] truncate">{t('patient.doctorTitle', { name })}</p>
                              <p className="text-xs text-gray-400 truncate">{u.email || ''}</p>
                            </div>
                          </button>
                        )
                      })
                  )}
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
