// @ts-nocheck
'use client'

import { useEffect, useCallback, useMemo, useRef, useState } from 'react'
import { API_BASE } from '../../lib/config'

const msgAnim = { animation: 'msgIn .25s ease-out both' }
if (typeof document !== 'undefined') {
  const style = document.createElement('style')
  style.textContent = '@keyframes msgIn{from{opacity:0;transform:translateY(8px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}'
  document.head.appendChild(style)
}
import { ArrowLeft, Send, Stethoscope, CheckCheck, Check, Plus, X, Loader2, Paperclip, Mic, Square, FileText, ImageIcon, Video, Camera } from 'lucide-react'
import api from '../../api/axios'
import { useAuth } from '../../hooks/useAuth'
import { useNotification } from '../../contexts/NotificationContext'
import useSWR, { mutate as globalMutate } from 'swr'
import { fetcher } from '../../lib/fetcher'
import { useWsStatus } from '../../hooks/useWebSocket'
import { UNREAD_MESSAGES_KEY } from '../../lib/keys'
import { useSearchParams, useRouter } from 'next/navigation'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import EmptyState from '../../components/ui/EmptyState'
import { useToast } from '../../components/ui/Toast'
import { useTranslation } from 'react-i18next'

function iri(prefix, id) { return `/api/${prefix}/${id}` }

function idFromIri(value) {
  if (!value) return null
  if (typeof value === 'object') return value.id ?? null
  return String(value).split('/').pop() || null
}

function extractArray(res) {
  const raw = res.data?.['hydra:member'] ?? res.data?.member ?? res.data
  return Array.isArray(raw) ? raw : []
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
  if (bytes < 1024) return t('visitor.messages.sizeBytes', { size: bytes })
  if (bytes < 1048576) return t('visitor.messages.sizeKB', { size: (bytes / 1024).toFixed(1) })
  return t('visitor.messages.sizeMB', { size: (bytes / 1048576).toFixed(1) })
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

export default function MessagesPage() {
  const { t } = useTranslation()
  const { user, mounted } = useAuth()
  const {
    setActiveConversationId,
    subscribeToMessages,
    subscribeToProfileChanges,
  } = useNotification()
  const toast = useToast()
  const router = useRouter()

  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const [conversationsLocal, setConversationsLocal] = useState([])
  const [activeId, setActiveId] = useState(searchParams?.get('conversation') || null)
  const [unreadCounts, setUnreadCounts] = useState(new Map())
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [medecins, setMedecins] = useState([])
  const [attachments, setAttachments] = useState([])
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recordTimer, setRecordTimer] = useState(0)
  const [recordingBlob, setRecordingBlob] = useState(null)
  const [uploadingMedia, setUploadingMedia] = useState(false)
  const mediaCache = useRef(new Map())
  const [, bump] = useState(0)
  const bottomRef = useRef(null)
  const fileRef = useRef(null)
  const docRef = useRef(null)
  const cameraRef = useRef(null)
  const recorderRef = useRef(null)
  const recordTimerRef = useRef(null)
  const streamRef = useRef(null)
  const msgContainerRef = useRef(null)

  const [msgPage, setMsgPage] = useState(1)
  const [allLoadedMsgs, setAllLoadedMsgs] = useState([])
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)

  const activeIdRef = useRef(activeId)
  const loadingMoreRef = useRef(false)
  const hasMoreRef = useRef(true)
  const msgLoadingRef = useRef(false)
  const initialPageReadyRef = useRef(false)

  const wsOnline = useWsStatus()

  const { data: convData, isLoading: convLoading, error: convError, mutate: mutateConvs } = useSWR('/api/conversations', fetcher, { revalidateOnFocus: false, refreshInterval: wsOnline ? 0 : 12000 })

  const preselectConsultation = searchParams?.get('consultation')
  const preselectMedecin = searchParams?.get('medecin')
  const preselectStarted = useRef(false)
  const preselectMedecinStarted = useRef(false)
  useEffect(() => {
    if (!preselectConsultation || convLoading || !user || preselectStarted.current) return
    preselectStarted.current = true
    const consultationId = Number(preselectConsultation)
    if (!consultationId) return
    ;(async () => {
      try {
        const { data: consultation } = await api.get(`/api/consultations/${consultationId}`)
        const medecinId = consultation.medecin?.id
        if (!medecinId) {
          toast.error(t('visitor.messages.errorNoDoctorAssigned'))
          return
        }
        const convs = Array.isArray(convData) ? convData : convData?.['hydra:member'] || []
        const existing = convs.find((c) =>
          c.participants?.some((p) => {
            const pId = typeof p === 'object' ? String(p.id) : String(idFromIri(p))
            return pId === String(medecinId)
          })
        )
        if (existing) {
          setActiveId(String(existing.id))
          return
        }
        const { data: conv } = await api.post('/api/conversations', {
          participants: [iri('users', user?.id), iri('users', medecinId)]
        }, { headers: { 'Content-Type': 'application/ld+json' } })

        await mutateConvs((prev) => {
          const arr = Array.isArray(prev) ? prev : prev?.['hydra:member'] || []
          return [conv, ...arr]
        }, { revalidate: true })
        setActiveId(String(conv.id))
      } catch {
        toast.error(t('visitor.messages.errorLoadConversation'))
      }
    })()
  }, [preselectConsultation, convLoading, convData, user, toast, mutateConvs, t])

  useEffect(() => {
    if (!preselectMedecin || convLoading || !user || preselectMedecinStarted.current) return
    preselectMedecinStarted.current = true

    ;(async () => {
      try {
        const convs = Array.isArray(convData) ? convData : convData?.['hydra:member'] || []
        const existing = convs.find((conversation) =>
          conversation.participants?.some((participant) => {
            const participantId = typeof participant === 'object'
              ? String(participant.id)
              : String(idFromIri(participant))
            return participantId === String(preselectMedecin)
          })
        )

        if (existing) {
          setActiveId(String(existing.id))
          return
        }

        const { data: conversation } = await api.post('/api/conversations', {
          participants: [iri('users', user.id), iri('users', preselectMedecin)],
        }, { headers: { 'Content-Type': 'application/ld+json' } })

        await mutateConvs((current) => {
          const list = Array.isArray(current) ? current : current?.['hydra:member'] || []
          return [conversation, ...list]
        }, { revalidate: true })
        setActiveId(String(conversation.id))
      } catch {
        preselectMedecinStarted.current = false
        toast.error(t('visitor.messages.errorOpenWithDoctor'))
      }
    })()
  }, [preselectMedecin, convLoading, convData, user, toast, mutateConvs, t])

  const activeIdNum = activeId ? Number(activeId) : null
  const MSGS_PER_PAGE = 30
  const { data: msgData, isLoading: msgLoading, error: msgError, mutate: mutateMsgs } = useSWR(
    activeIdNum ? `/api/messages?conversation=/api/conversations/${activeIdNum}&order[createdAt]=DESC&order[id]=DESC&itemsPerPage=${MSGS_PER_PAGE}&page=${msgPage}` : null,
    fetcher,
    { revalidateOnFocus: false, refreshInterval: wsOnline ? 0 : 12000 }
  )

  useEffect(() => { activeIdRef.current = activeId }, [activeId])
  useEffect(() => { loadingMoreRef.current = loadingMore }, [loadingMore])
  useEffect(() => { hasMoreRef.current = hasMore }, [hasMore])
  useEffect(() => { msgLoadingRef.current = msgLoading }, [msgLoading])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setMsgPage(1)
      setAllLoadedMsgs([])
      setHasMore(true)
      setLoadingMore(false)
      initialPageReadyRef.current = false
      scrollToBottomPendingRef.current = true
    }, 0)
    return () => window.clearTimeout(timer)
  }, [activeId])

  useEffect(() => {
    if (activeId) {
      document.body.classList.add('chat-open')
    } else {
      document.body.classList.remove('chat-open')
    }
    return () => document.body.classList.remove('chat-open')
  }, [activeId])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (activeId) {
      params.set('conversation', String(activeId))
      params.delete('medecin')
    } else {
      params.delete('conversation')
    }
    const qs = params.toString()
    router.replace(qs ? `/messages?${qs}` : '/messages', { scroll: false })
  }, [activeId, router])

  useEffect(() => {
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search)
      setActiveId(params.get('conversation') || null)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

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
        requestAnimationFrame(() => {
          bottomRef.current?.scrollIntoView({ behavior: 'auto' })
          initialPageReadyRef.current = true
        })
      } else {
        setAllLoadedMsgs(prev => {
          const existingIds = new Set(prev.map(m => String(m.id ?? m['@id'])))
          const newMsgs = activeMsgs.filter(m => !existingIds.has(String(m.id ?? m['@id'])))
          return newMsgs.length > 0 ? [...prev, ...newMsgs] : prev
        })
      }
      setLoadingMore(false)
    }, 0)

    if (msgPage > 1 && container) {
      requestAnimationFrame(() => {
        const newScrollHeight = container.scrollHeight
        container.scrollTop += newScrollHeight - prevScrollHeight
      })
    }
  }, [msgData, msgPage, activeIdNum])

  function sameMsg(a, b) {
    const idA = String(a.id ?? a['@id'] ?? '')
    const idB = String(b.id ?? b['@id'] ?? '')
    return idA !== '' && idB !== '' && idA === idB
  }
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
        mutateConvs((current) => {
          if (!current) return current
          const arr = Array.isArray(current) ? current : (current['hydra:member'] || [])
          const next = arr.map((c) => String(c.id) === convId ? { ...c, dernierMessage: msg } : c)
          next.sort((a, b) => String(b.dernierMessage?.createdAt || '').localeCompare(String(a.dernierMessage?.createdAt || '')))
          return Array.isArray(current) ? next : { ...current, 'hydra:member': next }
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
        const MSGS_PER_PAGE = 30
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

        mutateConvs((current) => {
          if (!current) return current
          const arr = Array.isArray(current) ? current : (current['hydra:member'] || [])
          const next = arr.map((c) => String(c.id) === convId ? { ...c, dernierMessage: msg } : c)
          return Array.isArray(current) ? next : { ...current, 'hydra:member': next }
        }, { revalidate: false })
      }
    })

    const unsubscribeProfiles = subscribeToProfileChanges((data) => {
      if (!data?.userId || !('photoProfil' in data)) return
      mutateConvs(undefined, { revalidate: true })
      setMedecins(prev => {
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
  }, [subscribeToMessages, subscribeToProfileChanges, mutateConvs, user?.id])

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

  const prevMsgCountRef = useRef(0)
  const scrollToBottomPendingRef = useRef(false)
  useEffect(() => {
    const el = msgContainerRef.current
    if (!el) return
    const currentCount = allLoadedMsgs.length
    if (scrollToBottomPendingRef.current && currentCount > 0) {
      window.setTimeout(() => {
        scrollToBottomPendingRef.current = false
        prevMsgCountRef.current = currentCount
        requestAnimationFrame(() => { el.scrollTop = el.scrollHeight })
      }, 0)
      return
    }
    if (currentCount <= prevMsgCountRef.current) {
      prevMsgCountRef.current = currentCount
      return
    }
    prevMsgCountRef.current = currentCount
    const threshold = 150
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold
    if (nearBottom) {
      requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }))
    }
  }, [allLoadedMsgs.length])

  useEffect(() => {
    if (activeId) {
      requestAnimationFrame(() => bottomRef.current?.scrollIntoView())
    }
  }, [activeId])

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

  useEffect(() => {
    const iris = [...new Set(allLoadedMsgs.filter(m => m.media && typeof m.media === 'string' && /\/(media_objects|media)\//.test(m.media)).map(m => m.media))]
    const pending = iris.filter(i => !mediaCache.current.has(i))
    if (pending.length === 0) return
    let dead = false
    Promise.allSettled(pending.map(i => api.get(i).then(r => ({ i, d: r.data })))).then(rr => {
      if (dead) return
      let changed = false
      rr.forEach(r => { if (r.status === 'fulfilled') { mediaCache.current.set(r.value.i, r.value.d); changed = true } })
      if (changed) setAllLoadedMsgs(prev => prev.map(m => typeof m.media === 'string' && mediaCache.current.has(m.media) ? { ...m, media: mediaCache.current.get(m.media) } : m))
    })
    return () => { dead = true }
  }, [allLoadedMsgs])

  const conversations = useMemo(
    () => Array.isArray(convData) ? convData : convData?.['hydra:member'] || [],
    [convData]
  )

  function matchConv(msg, convId) {
    const conv = msg.conversation
    const iri = `/api/conversations/${convId}`
    if (!conv) return false
    if (typeof conv === 'string') return conv === iri
    return conv['@id'] === iri || conv.id == convId
  }

  // Auto-fetch missing participant user info if API returns string IRIs or shallow objects
  useEffect(() => {
    if (!conversations.length) return
    const missingIris = new Set()
    for (const c of conversations) {
      c.participants?.forEach(p => {
        if (typeof p === 'string') {
          if (!medecins.some(u => String(u.id) === String(idFromIri(p)))) missingIris.add(p)
        } else if (p && typeof p === 'object') {
          if (!p.nom && !p.prenom && p['@id']) {
            if (!medecins.some(u => String(u.id) === String(p.id))) missingIris.add(p['@id'])
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
            setMedecins(prev => {
               const map = new Map(prev.map(u => [String(u.id), u]))
               newUsers.forEach(u => map.set(String(u.id), u))
               return Array.from(map.values())
            })
          }
        })
      return () => { dead = true }
    }
  }, [conversations, medecins])

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
          info = medecins.find(u => String(u.id) === String(other.id)) || other
        }
      } else if (typeof other === 'string') {
        info = medecins.find(u => String(u.id) === String(idFromIri(other))) || null
      }

      const lastMsg = c.dernierMessage || null
      const unread = unreadCounts.get(String(c.id)) || 0
      map.set(String(c.id), { id: String(c.id), info: info, messages: [], unread, dernierMessage: lastMsg })
    }
    return map
  }, [conversations, user, unreadCounts, medecins])

  const sortedConvs = useMemo(() =>
    Array.from(convMap.values()).sort((a, b) => {
      const la = a.dernierMessage?.createdAt ?? ''
      const lb = b.dernierMessage?.createdAt ?? ''
      return String(lb).localeCompare(String(la))
    }), [convMap])

  const active = convMap.get(activeId)

  const dedupedMessages = useMemo(() => {
    const msgs = [...allLoadedMsgs]
    msgs.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    const seen = new Set()
    return msgs.filter(m => {
      const key = m.id ?? m['@id']
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [allLoadedMsgs])



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

  const findOrCreateConv = async (medecinId) => {
    const existing = conversations.find((c) =>
      c.participants?.some((p) => {
        const pId = typeof p === 'object' ? p.id : idFromIri(p)
        return String(pId) === String(medecinId)
      })
    )
    if (existing) return String(existing.id)

    const { data: conv } = await api.post('/api/conversations', {
      participants: [iri('users', user?.id), iri('users', medecinId)]
    }, { headers: { 'Content-Type': 'application/ld+json' } })
    await mutateConvs((prev) => {
      const arr = Array.isArray(prev) ? prev : prev?.['hydra:member'] || []
      return [conv, ...arr]
    }, { revalidate: true })
    return String(conv.id)
  }

  const openNewConversation = () => {
    setShowNew(true)
    if (medecins.length === 0) {
      api.get('/api/medecins-publics')
        .then((res) => setMedecins(extractArray(res)))
        .catch(() => toast.error(t('visitor.messages.errorLoadDoctors')))
    }
  }

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
        toast.error(t('visitor.messages.fileSizeTooBig', { name: f.name }))
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
    if (!navigator.mediaDevices?.getUserMedia) { toast.error(t('visitor.messages.voiceNotSupported')); return }
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
    }).catch(() => toast.error(t('visitor.messages.micNotAccessible')))
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
        setAllLoadedMsgs(prev => [...prev, optimistic])
      }
      // Optimistic sidebar: show file preview instantly
      optimisticConvMutate(caption || t('visitor.messages.previewFile'))
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
            else if (!updated.some(m => sameMsg(m, created[i]))) updated.push(created[i])
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
        toast.error(error?.response?.data?.error || error?.response?.data?.detail || t('visitor.messages.errorSendMedia'))
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
    // Add optimistic message to local state (no WS publish yet)
    setAllLoadedMsgs(prev => [...prev, temp])
    // Optimistic sidebar update: show message preview instantly
    optimisticConvMutate(content)
    setDraft('')
    setSending(true)
    try {
      const { data } = await api.post('/api/messages', { contenu: content, conversation: convIri }, { headers: { 'Content-Type': 'application/ld+json' } })
      // Replace optimistic with real
      setAllLoadedMsgs(prev => {
        const idx = prev.findIndex(m => m.id === tempId)
        if (idx !== -1) {
          const updated = [...prev]
          updated[idx] = { ...data, _sending: false }
          return updated
        }
        return prev.some(m => sameMsg(m, data)) ? prev : [...prev, data]
      })
      // Mirror the media path: inject the created message into the SWR cache so the
      // append effect (msgPage === 1) does not rebuild the list without it when a
      // WS message (patient reply) mutates the cache afterwards.
      const msgKey = `/api/messages?conversation=/api/conversations/${Number(currentActiveId)}&order[createdAt]=DESC&order[id]=DESC&itemsPerPage=${MSGS_PER_PAGE}&page=1`
      globalMutate(msgKey, (currentCache: any) => {
        const arr = Array.isArray(currentCache) ? currentCache : (currentCache?.['hydra:member'] || [])
        const createdId = String(data.id ?? data['@id'])
        if (arr.some((m: any) => String(m.id ?? m['@id']) === createdId)) {
          return currentCache
        }
        const newArr = [data, ...arr]
        return Array.isArray(currentCache) ? newArr : { ...currentCache, 'hydra:member': newArr }
      }, { revalidate: false })
      mutateConvs()
    } catch {
      setAllLoadedMsgs(prev => prev.filter(m => m.id !== tempId))
      toast.error(t('visitor.messages.errorSendMessage'))
    } finally {
      setSending(false)
    }
  }

  if (!mounted) return <LoadingSpinner label={t('visitor.messages.loadingPage')} />
  if (convLoading) return <LoadingSpinner label={t('visitor.messages.loadingMessaging')} />

  return (
    <div className={`max-w-6xl mx-auto w-full p-0 lg:px-6 lg:py-10 flex flex-col overflow-hidden relative ${activeId ? 'h-[100dvh] xl:h-[calc(100dvh_-_96px)]' : 'flex-1 min-h-0'}`}>
      <div className="grid grid-cols-1 lg:grid-cols-3 flex-1 min-h-0 lg:rounded-2xl overflow-hidden border border-primary-100 dark:border-white/10 shadow-xl">

        <div className={`lg:col-span-1 min-h-0 border-r border-primary-100 dark:border-white/10 bg-white/70 dark:bg-primary-700/40 flex flex-col ${activeId ? 'hidden lg:flex' : 'flex'}`}>
          <div className="flex items-center justify-between p-4 border-b border-primary-100 dark:border-white/10">
            <h2 className="font-display font-bold text-primary-900 dark:text-sable">{t('visitor.messages.title')}</h2>
            <button onClick={openNewConversation} className="p-2 rounded-xl bg-mint-500 text-white"><Plus className="w-4 h-4" /></button>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
            {sortedConvs.length === 0 ? (
              <EmptyState title={t('visitor.messages.emptyTitle')} description={t('visitor.messages.emptyDesc')} />
            ) : sortedConvs.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-primary-100/50 dark:hover:bg-primary-900/40 transition ${activeId === c.id ? 'bg-primary-100/70 dark:bg-primary-900/60' : ''}`}
              >
                <div className="w-10 h-10 rounded-full bg-primary-500 text-white flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden">
                  {c.info?.photoProfil ? <img src={mediaUrl(c.info.photoProfil)} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }} /> : null}
                  <span style={c.info?.photoProfil ? { display: 'none' } : undefined} className="flex items-center justify-center w-full h-full">{(c.info?.prenom?.[0] || '') + (c.info?.nom?.[0] || '')}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-primary-900 dark:text-sable truncate">{c.info?.prenom} {c.info?.nom}</p>
                  <p className="text-xs text-primary-300 truncate">
                    {c.dernierMessage?.typeMessage === 'IMAGE' && <>📷 {t('visitor.messages.previewImage')}</>}
                    {c.dernierMessage?.typeMessage === 'VIDEO' && <>🎥 {t('visitor.messages.previewVideo')}</>}
                    {c.dernierMessage?.typeMessage === 'VOIX' && <>🎤 {t('visitor.messages.previewVoice')}</>}
                    {c.dernierMessage?.typeMessage === 'FICHIER' && <>📎 {c.dernierMessage?.media?.originalName || t('visitor.messages.previewFile')}</>}
                    {(!c.dernierMessage?.typeMessage || c.dernierMessage?.typeMessage === 'TEXTE') && (c.dernierMessage?.contenu || '')}
                  </p>
                </div>
                {c.unread > 0 && <span className="w-5 h-5 rounded-full bg-urgence-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">{c.unread}</span>}
              </button>
            ))}
          </div>
        </div>

        <div className={`lg:col-span-2 h-full min-h-0 flex flex-col overflow-hidden relative bg-sable dark:bg-primary-900 ${activeId ? 'flex' : 'hidden lg:flex'}`}>
          {active ? (
            <>
              <div className="sticky top-0 z-30 flex-none h-16 flex items-center gap-3 p-4 border-b border-primary-100 dark:border-white/10 bg-white/70 dark:bg-primary-700/40">
                <button className="lg:hidden" onClick={() => setActiveId(null)} aria-label={t('visitor.messages.back')}><ArrowLeft className="w-5 h-5 text-primary-500" /></button>
                <div className="w-9 h-9 rounded-full bg-primary-500 text-white flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                  {active.info?.photoProfil ? <img src={mediaUrl(active.info.photoProfil)} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }} /> : null}
                  <span style={active.info?.photoProfil ? { display: 'none' } : undefined} className="flex items-center justify-center w-full h-full">{(active.info?.prenom?.[0] || '') + (active.info?.nom?.[0] || '')}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-primary-900 dark:text-sable truncate">{active.info?.prenom} {active.info?.nom}</p>
                </div>
              </div>

              <div ref={msgContainerRef} onScroll={handleMessagesScroll} className="flex-1 overflow-y-auto p-4 space-y-2 min-h-0 pb-24">
                {loadingMore && (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-primary-300" />
                  </div>
                )}
                {dedupedMessages.map((m) => {
                  const mine = idFromIri(m.expediteur) === user?.id
                  const mediaKind = msgMediaKind(m)
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div style={msgAnim} className={`max-w-[75%] rounded-2xl text-sm overflow-hidden ${
                        mine
                          ? 'bg-mint-500 text-white rounded-br-sm'
                          : 'bg-white dark:bg-primary-700 text-primary-900 dark:text-sable rounded-bl-sm'
                      } ${m._sending ? 'opacity-60' : ''}`}>
                        {mediaKind === 'IMAGE' && msgMediaUrl(m) && (
                          <img src={msgMediaUrl(m)} alt="" className="w-full max-h-64 object-cover cursor-pointer" onClick={(e) => { e.stopPropagation(); window.open(msgMediaUrl(m), '_blank') }} />
                        )}
                        {mediaKind === 'VIDEO' && msgMediaUrl(m) && (
                          <video controls playsInline preload="metadata" src={msgMediaUrl(m)} className="w-full max-h-72 bg-black" />
                        )}
                        {mediaKind === 'VOIX' && msgMediaUrl(m) && (
                          <div className="px-3 pt-3 pb-1">
                            <audio controls src={msgMediaUrl(m)} className="w-full h-10" />
                            {m.dureeVoix > 0 && <p className="text-[10px] opacity-60 mt-0.5">{formatDuration(m.dureeVoix)}</p>}
                          </div>
                        )}
                        {mediaKind === 'FICHIER' && m.media && (
                          <a href={msgMediaUrl(m)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 hover:opacity-80">
                            <FileText className="w-6 h-6 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{m.media.originalName || t('visitor.messages.previewFile')}</p>
                              <p className="text-[10px] opacity-60">{formatFileSize(m.media.size, t)}</p>
                            </div>
                          </a>
                        )}
                        {m.contenu && (
                          <div className={mediaKind !== 'TEXTE' ? 'px-3 pb-2' : 'px-4 py-2.5'}>
                            <p>{m.contenu}</p>
                          </div>
                        )}
                        {!m.contenu && m.typeMessage === 'TEXTE' && (
                          <div className="px-4 py-2.5"><p>{m.contenu}</p></div>
                        )}
                        {mine ? (
                          <div className={`flex justify-end items-center gap-1.5 ${mediaKind !== 'TEXTE' || m.contenu ? 'pb-2 px-3' : 'pb-2.5 px-4'}`}>
                            <p className="text-[10px] opacity-70">{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                            {m._sending ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin opacity-60" />
                            ) : m.statut === 'LU' ? (
                              <CheckCheck className="w-3.5 h-3.5 text-[#4dd0e1]" />
                            ) : (
                              <CheckCheck className="w-3.5 h-3.5 opacity-60" />
                            )}
                          </div>
                        ) : (
                          <div className={`flex justify-start ${m.typeMessage !== 'TEXTE' || m.contenu ? 'pb-2 px-3' : 'pb-2.5 px-4'}`}>
                            <p className="text-[10px] opacity-50">{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
                <div ref={bottomRef} />
              </div>

              <div className="absolute bottom-0 left-0 right-0 z-30 border-t border-primary-100 dark:border-white/10 bg-white/70 dark:bg-primary-700/40 pb-[env(safe-area-inset-bottom,0px)] md:pb-0">
                {attachments.length > 0 && (
                  <div className="flex gap-2 p-2 overflow-x-auto border-b border-primary-100/50 dark:border-white/5">
                    {attachments.map((att) => (
                      <div key={att.id} className="relative shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-primary-100 dark:bg-primary-900/60">
                        {att.preview && isImageMime(att.mime) ? (
                          <img src={att.preview} alt="" className="w-full h-full object-cover" />
                        ) : att.preview && isVideoMime(att.mime) ? (
                          <video src={att.preview} muted playsInline preload="metadata" className="w-full h-full object-cover bg-black" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            {isVideoMime(att.mime) ? <Video className="w-5 h-5 text-primary-300" /> :
                             isImageMime(att.mime) ? <ImageIcon className="w-5 h-5 text-primary-300" /> :
                             isAudioMime(att.mime) ? <Mic className="w-5 h-5 text-primary-300" /> :
                             <FileText className="w-5 h-5 text-primary-300" />}
                          </div>
                        )}
                        <button onClick={() => removeAttachment(att.id)} className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/50 text-white flex items-center justify-center">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {recording && (
                  <div className="flex items-center gap-3 px-4 py-2.5 bg-urgence-500/10">
                    <div className="w-3 h-3 rounded-full bg-urgence-500 animate-pulse" />
                    <span className="text-sm font-semibold text-urgence-500">{formatDuration(recordTimer)}</span>
                    <button onClick={stopRecording} className="ml-auto p-1.5 rounded-full bg-urgence-500 text-white">
                      <Square className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-2 p-3">
                  <div className="relative">
                    <button onClick={() => setShowAttachMenu((v) => !v)} disabled={sending || recording} className="p-2 rounded-full hover:bg-primary-100 dark:hover:bg-primary-900/40 disabled:opacity-40">
                      <Paperclip className="w-5 h-5 text-primary-500 rotate-45" />
                    </button>
                    {showAttachMenu && (
                      <div className="absolute bottom-full left-0 mb-2 bg-white dark:bg-primary-800 rounded-2xl shadow-glass border border-primary-100 dark:border-white/5 p-2 flex gap-1 z-10">
                        <button onClick={() => handleAttach('camera')} className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl hover:bg-primary-50 dark:hover:bg-primary-900/40 text-primary-500">
                          <Camera className="w-5 h-5" /><span className="text-[10px]">{t('visitor.messages.attachCamera')}</span>
                        </button>
                        <button onClick={() => handleAttach('gallery')} className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl hover:bg-primary-50 dark:hover:bg-primary-900/40 text-primary-500">
                          <ImageIcon className="w-5 h-5" /><span className="text-[10px]">{t('visitor.messages.attachPhotos')}</span>
                        </button>
                        <button onClick={() => handleAttach('doc')} className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl hover:bg-primary-50 dark:hover:bg-primary-900/40 text-primary-500">
                          <FileText className="w-5 h-5" /><span className="text-[10px]">{t('visitor.messages.attachDocument')}</span>
                        </button>
                        <button onClick={() => handleAttach('voice')} className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl hover:bg-primary-50 dark:hover:bg-primary-900/40 text-primary-500">
                          <Mic className="w-5 h-5" /><span className="text-[10px]">{t('visitor.messages.attachVoice')}</span>
                        </button>
                      </div>
                    )}
                  </div>
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                    placeholder={recording ? t('visitor.messages.recordingPlaceholder') : uploadingMedia ? t('visitor.messages.uploadingPlaceholder') : t('visitor.messages.inputPlaceholder')}
                    disabled={recording || uploadingMedia}
                    aria-label={t('visitor.messages.inputAria')}
                    className="flex-1 px-4 py-2.5 rounded-2xl border border-primary-100 dark:border-white/10 bg-white dark:bg-primary-900/60 focus:outline-none focus:ring-2 focus:ring-mint-500 disabled:opacity-40"
                  />
                  <button type="button" onClick={handleSend} disabled={sending || (!draft.trim() && attachments.length === 0) || recording} aria-label={t('visitor.messages.send')} className="p-3 rounded-2xl bg-mint-500 hover:bg-mint-700 text-white disabled:opacity-50 transition">
                    {uploadingMedia ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => handleFilePick(e, false)} />
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/ogg,video/quicktime" multiple hidden onChange={(e) => handleFilePick(e, true)} />
              <input ref={docRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z" multiple hidden onChange={(e) => handleFilePick(e, true)} />
            </>
          ) : (
            <EmptyState
              icon={Stethoscope}
              title={t('visitor.messages.noActiveTitle')}
              description={t('visitor.messages.noActiveDesc')}
            />
          )}
        </div>
      </div>

      {showNew && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6"
          onClick={() => setShowNew(false)}
          role="dialog"
          aria-modal="true"
        >
          <div onClick={(e) => e.stopPropagation()} className="bg-white dark:bg-primary-700 rounded-2xl shadow-glass w-full max-w-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-primary-900 dark:text-sable">{t('visitor.messages.newConversation')}</h3>
              <button onClick={() => setShowNew(false)} aria-label={t('visitor.messages.close')}>
                <X className="w-5 h-5 text-primary-300" />
              </button>
            </div>
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {medecins.length === 0 ? (
                <LoadingSpinner size="sm" label={t('visitor.messages.loadingDoctors')} />
              ) : medecins.map((med) => (
                <button
                  key={med.id}
                  onClick={async () => {
                    setShowNew(false)
                    try {
                      const convId = await findOrCreateConv(med.id)
                      setActiveId(convId)
                    } catch {
                      toast.error(t('visitor.messages.errorCreateConversation'))
                    }
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-primary-100 dark:hover:bg-primary-900/40 text-left transition"
                >
                  <div className="w-9 h-9 rounded-full bg-primary-500 text-white flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                    {med.photoProfil ? <img src={mediaUrl(med.photoProfil)} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }} /> : null}
                    <span style={med.photoProfil ? { display: 'none' } : undefined} className="flex items-center justify-center w-full h-full">{(med.prenom?.[0] ?? '') + (med.nom?.[0] ?? '')}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-primary-900 dark:text-sable truncate">
                      Dr {med.prenom} {med.nom}
                    </p>
                    <p className="text-xs text-primary-300 truncate">{med.specialite}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
