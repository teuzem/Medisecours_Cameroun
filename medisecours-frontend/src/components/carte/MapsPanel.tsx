'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Bookmark, CalendarDays, ChevronLeft, ChevronRight, Clock, ExternalLink, FolderPlus, History, Image as ImageIcon, Images, Info, MapPin, Navigation, Phone, Search, Send, Share2, ShieldCheck, Star, ThumbsUp, X } from 'lucide-react'
import useSWR, { mutate } from 'swr'
import { useTranslation } from 'react-i18next'
import api from '../../api/axios'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../ui/Toast'
import { FicheInfos, MediaGallery, type EtablissementDrawerProps } from './EtablissementDrawer'
import { formatDistanceKm, formatDuration, getEtablissementPhoto, haversineKm, toGoogleMapsUrl, toWazeUrl, WAYFINDING_MODES, type Avis, type FicheCentre } from '../../lib/carte'
import { imgUrl } from '../../lib/config'
import { trackInteraction } from '../../lib/track'

type View = 'explore' | 'saved' | 'recent'
type Collection = { id: string; name: string; places: number[]; note: string }
const COLLECTION_KEY = 'medisecours_map_named_collections'

function ResultPhoto({ centre }: { centre: FicheCentre | EtablissementDrawerProps['visibleCentres'][number] }) {
  const { t } = useTranslation()
  const photo = getEtablissementPhoto(centre)
  return <img className="maps-result-thumb" src={imgUrl(photo) ?? '/images/home-doctor-visit.jpg'} alt={photo ? centre.nom : t('visitor.carte.photoAlt')} loading="lazy" onError={event => {
    event.currentTarget.onerror = null
    event.currentTarget.src = '/images/home-doctor-visit.jpg'
    event.currentTarget.alt = t('visitor.carte.photoAlt')
  }} />
}

function Rating({ value }: { value: number }) {
  const { t } = useTranslation()
  return <span className="maps-stars" aria-label={t('visitor.carte.ratingAria', { value })}>{[1, 2, 3, 4, 5].map(star => <Star key={star} size={14} fill={star <= Math.round(value) ? 'currentColor' : 'none'} />)}</span>
}

function Action({ icon, children, onClick, active = false, tone = 'default', disabled = false }: { icon: ReactNode; children: ReactNode; onClick: () => void; active?: boolean; tone?: 'default' | 'danger'; disabled?: boolean }) {
  return <button type="button" className={`maps-action ${tone === 'danger' ? 'maps-action-danger' : ''}`} onClick={onClick} aria-pressed={active} disabled={disabled}><span className={active ? 'maps-action-icon is-active' : 'maps-action-icon'}>{icon}</span><span>{children}</span></button>
}

type GalleryFilter = 'images' | 'recent' | 'videos'

function orderedFacilityMedia(facility: FicheCentre): NonNullable<FicheCentre['images']> {
  const media = (facility.images ?? []).filter((item) => item.contentUrl)
  const coverKey = facility.imageUrl ? (imgUrl(facility.imageUrl) || facility.imageUrl).replace(/\/+$/, '').toLowerCase() : ''
  return [...media].sort((left, right) => {
    const leftKey = (imgUrl(left.contentUrl) || left.contentUrl).replace(/\/+$/, '').toLowerCase()
    const rightKey = (imgUrl(right.contentUrl) || right.contentUrl).replace(/\/+$/, '').toLowerCase()
    if (coverKey && leftKey === coverKey) return -1
    if (coverKey && rightKey === coverKey) return 1
    return new Date(right.createdAt ?? 0).getTime() - new Date(left.createdAt ?? 0).getTime()
  })
}

function formatMediaDate(value?: string, language = 'fr'): string {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString(language.toLowerCase().startsWith('en') ? 'en-CM' : 'fr-CM', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
  })
}

function mediaUploaderName(media: NonNullable<FicheCentre['images']>[number] | undefined, fallback: string): string {
  return media?.uploadedBy?.name || media?.uploadedByName || fallback
}

function mediaUploaderInitials(name: string): string {
  const initials = name
    .split(/\s+/)
    .map(part => part.trim().charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
  return initials || 'MC'
}

function FacilityMediaViewer({
  facility,
  filter,
  onFilterChange,
  activeIndex,
  onIndexChange,
  onClose,
  onShare,
}: {
  facility: FicheCentre
  filter: GalleryFilter
  onFilterChange: (filter: GalleryFilter) => void
  activeIndex: number
  onIndexChange: (index: number) => void
  onClose: () => void
  onShare: (media: NonNullable<FicheCentre['images']>[number]) => void
}) {
  const { t, i18n } = useTranslation()
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const media = orderedFacilityMedia(facility)
  const filtered = useMemo(() => {
    if (filter === 'videos') return media.filter((item) => item.kind === 'video' || item.mimeType?.startsWith('video/'))
    if (filter === 'images') return media.filter((item) => item.kind !== 'video' && !item.mimeType?.startsWith('video/'))
    return [...media].sort((left, right) => new Date(right.createdAt ?? 0).getTime() - new Date(left.createdAt ?? 0).getTime())
  }, [filter, media])
  const safeIndex = Math.min(Math.max(activeIndex, 0), Math.max(filtered.length - 1, 0))
  const current = filtered[safeIndex]

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const previousActive = document.activeElement as HTMLElement | null
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      previousActive?.focus?.()
    }
  }, [onClose])

  const sidebar = (empty = false) => (
    <aside className="maps-media-sidebar">
      <div className="maps-media-sidebar-top">
        <button ref={closeButtonRef} type="button" className="maps-media-sidebar-close" onClick={onClose} aria-label={t('visitor.carte.galleryClose')}><ChevronLeft size={21} /></button>
        {!empty && <div className="maps-media-sidebar-title">
          <span className="maps-media-viewer-kicker"><Images size={14} /> {t('visitor.carte.galleryTitle')}</span>
          <h2>{facility.nom}</h2>
        </div>}
      </div>
      {empty ? <div className="maps-media-sidebar-empty"><Images size={30} /><p>{t('visitor.carte.galleryEmpty')}</p></div> : <>
        <div className="maps-media-sidebar-current">
          <div className="maps-media-sidebar-current-copy">
            <span>{current?.kind === 'video' || current?.mimeType?.startsWith('video/') ? t('visitor.carte.galleryVideo') : t('visitor.carte.galleryPhoto')}</span>
            <strong>{current?.originalName || t('visitor.carte.galleryPhoto')}</strong>
          </div>
          <div className="maps-media-sidebar-uploader">
            <span className="maps-media-sidebar-avatar" aria-hidden="true">{mediaUploaderInitials(mediaUploaderName(current, t('visitor.carte.galleryMember')))}</span>
            <span className="maps-media-sidebar-uploader-copy">
              <strong>{mediaUploaderName(current, t('visitor.carte.galleryMember'))}</strong>
              <small>{current && formatMediaDate(current.createdAt, i18n.language)}</small>
            </span>
          </div>
        </div>
        <div className="maps-media-filters" role="tablist" aria-label={t('visitor.carte.galleryFilters')}>
          {([['images', t('visitor.carte.galleryImages')], ['recent', t('visitor.carte.galleryRecent')], ['videos', t('visitor.carte.galleryVideos')]] as const).map(([key, label]) => (
            <button type="button" key={key} role="tab" aria-selected={filter === key} onClick={() => { onFilterChange(key); onIndexChange(0) }}>{label}</button>
          ))}
        </div>
        <div className="maps-media-sidebar-list-heading">
          <span>{t('visitor.carte.galleryTitle')}</span>
          <strong>{filtered.length}</strong>
        </div>
        <div className="maps-media-sidebar-list" role="listbox" aria-label={t('visitor.carte.galleryTitle')}>
          {filtered.map((item, index) => {
            const itemIsVideo = item.kind === 'video' || item.mimeType?.startsWith('video/')
            const itemSource = imgUrl(item.contentUrl) || item.contentUrl
            const itemUploader = mediaUploaderName(item, t('visitor.carte.galleryMember'))
            return <button type="button" key={`${item.id}-${index}`} className="maps-media-sidebar-item" role="option" aria-selected={index === safeIndex} onClick={() => onIndexChange(index)}>
              {itemIsVideo ? <video src={itemSource} muted preload="metadata" aria-hidden="true" /> : <img src={itemSource} alt="" loading="lazy" />}
              <span className="maps-media-sidebar-item-copy">
                <strong>{item.originalName || (itemIsVideo ? t('visitor.carte.galleryVideo') : t('visitor.carte.galleryPhoto'))}</strong>
                <small>{itemUploader}</small>
                <em>{formatMediaDate(item.createdAt, i18n.language) || t('visitor.carte.galleryMember')}</em>
              </span>
            </button>
          })}
        </div>
      </>}
    </aside>
  )

  if (!current) {
    return <div className="maps-media-viewer" role="dialog" aria-modal="true" aria-label={t('visitor.carte.galleryTitle')}>{sidebar(true)}<main className="maps-media-main maps-media-main-empty" /></div>
  }

  const isVideo = current.kind === 'video' || current.mimeType?.startsWith('video/')
  const source = imgUrl(current.contentUrl) || current.contentUrl
  return (
    <div className="maps-media-viewer" role="dialog" aria-modal="true" aria-label={`${t('visitor.carte.galleryTitle')} - ${facility.nom}`}>
      {sidebar()}
      <main className="maps-media-main">
        <div className="maps-media-main-actions">
          <button type="button" onClick={() => onShare(current)} aria-label={t('visitor.carte.galleryShare')}><Share2 size={19} /></button>
          <button type="button" onClick={onClose} aria-label={t('visitor.carte.galleryClose')}><X size={22} /></button>
        </div>
        <div className="maps-media-viewer-stage">
          <button type="button" className="maps-media-nav maps-media-nav-prev" onClick={() => onIndexChange((safeIndex - 1 + filtered.length) % filtered.length)} aria-label={t('visitor.carte.galleryPrevious')}><ChevronLeft size={25} /></button>
          <div className="maps-media-canvas">{isVideo ? <video src={source} controls autoPlay playsInline className="maps-media-player" /> : <img src={source} alt={`${facility.nom} - ${current.originalName || t('visitor.carte.galleryPhoto')}`} className="maps-media-player" />}</div>
          <button type="button" className="maps-media-nav maps-media-nav-next" onClick={() => onIndexChange((safeIndex + 1) % filtered.length)} aria-label={t('visitor.carte.galleryNext')}><ChevronRight size={25} /></button>
        </div>
        <footer className="maps-media-main-footer">
          <span>{safeIndex + 1} / {filtered.length}</span>
          <span>{current.originalName || (isVideo ? t('visitor.carte.galleryVideo') : t('visitor.carte.galleryPhoto'))}</span>
        </footer>
      </main>
    </div>
  )
}

export default function MapsPanel(props: EtablissementDrawerProps & { initialView: View; onViewChange: (view: View) => void; railOpen?: boolean }) {
  const { t, i18n } = useTranslation()
  const { user, isAuthenticated, isMedecin } = useAuth()
  const toast = useToast()
  const [tab, setTab] = useState<'presentation' | 'reviews' | 'about' | 'directions'>('presentation')
  const [sort, setSort] = useState('recent')
  const [reviewSearch, setReviewSearch] = useState('')
  const [composer, setComposer] = useState(false)
  const [note, setNote] = useState(0)
  const [comment, setComment] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [filePreviews, setFilePreviews] = useState<string[]>([])
  const [dragActive, setDragActive] = useState(false)
  const [sending, setSending] = useState(false)
  const [likes, setLikes] = useState<number[]>([])
  const [joining, setJoining] = useState(false)
  const [joined, setJoined] = useState(false)
  const [collections, setCollections] = useState<Collection[]>([])
  const [collectionOpen, setCollectionOpen] = useState(false)
  const [collectionName, setCollectionName] = useState('')
  const [nearbyOnly, setNearbyOnly] = useState(false)
  const [noticeOpen, setNoticeOpen] = useState(false)
  const [suggestionOpen, setSuggestionOpen] = useState(false)
  const [suggestionField, setSuggestionField] = useState('adresse')
  const [suggestionValue, setSuggestionValue] = useState('')
  const [suggestionComment, setSuggestionComment] = useState('')
  const [suggestionSending, setSuggestionSending] = useState(false)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [galleryFilter, setGalleryFilter] = useState<GalleryFilter>('images')
  const [galleryIndex, setGalleryIndex] = useState(0)
  const selected = props.visibleCentres.find(centre => centre.id === props.selectedId)
  const { data: detail, error: detailError } = useSWR<FicheCentre>(selected ? `/api/centre_de_santes/${selected.id}/fiche` : null)
  const { data: reviewResponse, error: reviewError, isLoading, mutate: refreshReviews } = useSWR<unknown>(selected ? `/api/avis_etablissements?etablissement=${selected.id}` : null)
  const facility = detail ? { ...selected, ...detail } : selected
  const reviews = useMemo(() => {
    const raw = reviewResponse as { member?: Avis[]; 'hydra:member'?: Avis[] } | Avis[] | undefined
    const values = Array.isArray(raw) ? raw : raw?.member ?? raw?.['hydra:member'] ?? []
    return values.filter(review => review.statut === 'PUBLIE').filter(review => !reviewSearch || `${review.auteurNom} ${review.commentaire}`.toLocaleLowerCase().includes(reviewSearch.toLocaleLowerCase())).sort((a, b) => {
      if (sort === 'positive') return b.note - a.note
      if (sort === 'critical') return a.note - b.note
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }, [reviewResponse, reviewSearch, sort])

  useEffect(() => {
    // Reset the drawer workflow when a different establishment is selected.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTab('presentation'); setComposer(false); setNote(0); setComment(''); setFiles([]); setJoined(false); setGalleryOpen(false); setGalleryIndex(0); setGalleryFilter('images')
  }, [props.selectedId])
  useEffect(() => {
    // Review notice state is scoped to the selected establishment and tab.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNoticeOpen(false)
  }, [props.selectedId, tab])
  const selectedIdForTracking = selected?.id
  useEffect(() => {
    if (props.open && selectedIdForTracking != null) trackInteraction(selectedIdForTracking, 'fiche')
  }, [props.open, selectedIdForTracking])
  useEffect(() => {
    const urls = files.map(file => URL.createObjectURL(file))
    // Object URLs are derived from the current file selection.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFilePreviews(urls)
    return () => urls.forEach(url => URL.revokeObjectURL(url))
  }, [files])
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(COLLECTION_KEY) ?? '[]')
      if (Array.isArray(stored)) {
        // Local storage is an external source and is loaded once on mount.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCollections(stored.filter(item => typeof item?.id === 'string' && typeof item.name === 'string' && Array.isArray(item.places)))
      }
    } catch { /* Local storage may be disabled. */ }
    if (isAuthenticated) {
      void api.get('/api/carte/collections').then(response => {
        const items = Array.isArray(response.data?.items) ? response.data.items : []
        setCollections(items.map((item: any) => ({
          id: String(item.id), name: String(item.name), note: String(item.note ?? ''), places: Array.isArray(item.places) ? item.places.map(Number) : [],
        })))
      }).catch(() => undefined)
    }
  }, [isAuthenticated])
  useEffect(() => {
    if (!composer && !collectionOpen) return
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') { setComposer(false); setCollectionOpen(false) } }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [composer, collectionOpen])

  const saveCollections = (next: Collection[]) => {
    try { localStorage.setItem(COLLECTION_KEY, JSON.stringify(next)); setCollections(next) }
    catch { toast.error(t('visitor.carte.toastStorageUnavailable')) }
    if (isAuthenticated) {
      for (const collection of next) {
        const numericId = Number(collection.id)
        const request = Number.isInteger(numericId)
          ? api.patch(`/api/carte/collections/${numericId}`, { name: collection.name, note: collection.note, places: collection.places })
          : api.post('/api/carte/collections', { name: collection.name, note: collection.note, places: collection.places })
        void request.catch(() => toast.info(t('visitor.carte.toastCollectionLocalOnly')))
      }
    }
  }
  const placeUrl = () => {
    const url = new URL('/carte', window.location.origin)
    if (selected) url.searchParams.set('centre', String(selected.id))
    return url.toString()
  }
  const share = async (text?: string) => {
    try {
      if (navigator.share) await navigator.share({ title: facility?.nom, text: text ?? facility?.adresse, url: placeUrl() })
      else { await navigator.clipboard.writeText(`${text ?? facility?.nom ?? ''}\n${placeUrl()}`); toast.success(t('visitor.carte.toastLinkCopied')) }
    } catch (cause) { if ((cause as Error).name !== 'AbortError') toast.error(t('visitor.carte.toastShareUnavailable')) }
  }
  const shareMedia = async (media: NonNullable<FicheCentre['images']>[number]) => {
    const source = imgUrl(media.contentUrl) || media.contentUrl
    try {
      if (navigator.share) {
        await navigator.share({ title: facility?.nom, text: `${facility?.nom ?? ''} · ${media.originalName ?? t('visitor.carte.mediaFallbackName')}`, url: source })
      } else {
        await navigator.clipboard.writeText(source)
        toast.success(t('visitor.carte.toastMediaLinkCopied'))
      }
    } catch (cause) {
      if ((cause as Error).name !== 'AbortError') toast.error(t('visitor.carte.toastMediaShareUnavailable'))
    }
  }
  const submit = async () => {
    if (!selected || !note || sending) return
    setSending(true)
    try {
      if (files.length) {
        const form = new FormData()
        form.set('centre', String(selected.id)); form.set('note', String(note)); form.set('commentaire', comment.trim())
        files.forEach(file => form.append('images[]', file))
        await api.post('/api/avis_etablissements/avec-images', form)
      } else {
        await api.post('/api/avis_etablissements', { etablissement: `/api/centre_de_santes/${selected.id}`, note, commentaire: comment.trim() || null })
      }
      setComposer(false); setNote(0); setComment(''); setFiles([])
      await refreshReviews()
      void mutate(`/api/centre_de_santes/${selected.id}/fiche`)
      trackInteraction(selected.id, 'avis')
      toast.success(t('visitor.carte.toastReviewPublished'))
    } catch (cause: any) { toast.error(cause?.response?.data?.error ?? t('visitor.carte.toastReviewPublishFailed')) }
    finally { setSending(false) }
  }
  const submitSuggestion = async () => {
    if (!selected || !suggestionValue.trim() || suggestionSending) return
    setSuggestionSending(true)
    try {
      await api.post('/api/suggestion_etablissements', {
        etablissement: `/api/centre_de_santes/${selected.id}`,
        champ: suggestionField,
        valeurProposee: suggestionValue.trim(),
        commentaire: suggestionComment.trim() || null,
      })
      setSuggestionOpen(false)
      setSuggestionValue('')
      setSuggestionComment('')
      trackInteraction(selected.id, 'suggestion')
      toast.success(t('visitor.carte.toastSuggestionSent'))
    } catch (cause: any) {
      toast.error(cause?.response?.data?.detail ?? t('visitor.carte.toastSuggestionFailed'))
    } finally {
      setSuggestionSending(false)
    }
  }
  const acceptReviewFiles = (incoming: File[]) => {
    if (incoming.length > 5 || incoming.some(file => file.size > 2 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))) {
      toast.error(t('visitor.carte.toastUploadLimit'))
      return
    }
    setFiles(incoming)
  }
  const join = async () => {
    if (!selected) return
    setJoining(true)
    try { await api.post('/api/affiliation_medecins', { etablissement: `/api/centre_de_santes/${selected.id}`, teleconsultation: false }); setJoined(true); toast.success(t('visitor.carte.info.joinSent')) }
    catch (cause: any) { if (cause?.response?.status === 409) setJoined(true); else toast.error(t('visitor.carte.info.joinError')) }
    finally { setJoining(false) }
  }

  const baseList = props.initialView === 'saved' ? props.visibleCentres.filter(centre => props.favorites.includes(centre.id))
    : props.initialView === 'recent' ? props.recentIds.flatMap(id => props.visibleCentres.filter(centre => centre.id === id))
      : props.visibleCentres
  const list = nearbyOnly && props.position
    ? baseList.filter(centre => (haversineKm(props.position, centre) ?? Number.POSITIVE_INFINITY) <= 25)
    : baseList
  const mean = facility?.noteMoyenne ?? 0
  const total = facility?.totalAvis ?? 0
  const hasCoords = facility?.latitude != null && facility.longitude != null

  return <>
    <nav className={`maps-rail ${props.railOpen === false ? 'maps-rail-collapsed' : ''}`} aria-label={t('visitor.carte.railLabel')}>
      {([['explore', MapPin, t('visitor.carte.viewExplore')], ['saved', Bookmark, t('visitor.carte.viewSaved')], ['recent', History, t('visitor.carte.viewRecent')]] as const).map(([view, Icon, label]) => <button type="button" key={view} onClick={() => { props.onBackToList(); props.onViewChange(view) }} aria-pressed={props.initialView === view}><Icon size={22} /><span>{label}</span></button>)}
    </nav>
    {props.open && <aside className={`maps-panel ${facility ? 'maps-panel-detail' : 'maps-panel-list'}`} aria-label={facility?.nom ?? t('visitor.carte.listLabel')}>
      {facility ? <>
        <div className="maps-cover">
          <MediaGallery centre={facility} compact disableLightbox onOpen={() => { setGalleryFilter('images'); setGalleryIndex(0); setGalleryOpen(true) }} />
          <div className="maps-cover-overlay" aria-hidden="true" />
          <button type="button" className="maps-cover-back" onClick={props.onBackToList} aria-label={t('visitor.carte.ariaBackToResults')}><ChevronLeft size={22} /></button>
          <button type="button" className="maps-cover-close" onClick={props.onClose} aria-label={t('visitor.carte.ariaCloseFiche')}><X size={20} /></button>
          {(facility.images?.length ?? 0) > 1 && (
            <button
              type="button"
              className="maps-cover-gallery-trigger"
              onClick={() => { setGalleryFilter('images'); setGalleryIndex(0); setGalleryOpen(true) }}
            >
              <Images size={17} /> {t('visitor.carte.viewPhotos')}
            </button>
          )}
        </div>
        <header className="maps-place-heading"><h1>{facility.nom}</h1><div className="maps-rating-line"><span>{mean.toFixed(1)}</span><Rating value={mean} /><button type="button" onClick={() => setTab('reviews')}>{t('visitor.carte.reviews.count', { count: total })}</button></div><p>{facility.type.replaceAll('_', ' ')}{facility.verificationStatut === 'VERIFIE' && <ShieldCheck size={15} aria-label={t('visitor.carte.verified')} />}</p></header>
        <div className="maps-tabs" role="tablist" aria-label={t('visitor.carte.ariaFiche')}>{([['presentation', t('visitor.carte.tabPresentation')], ['reviews', t('visitor.carte.tabs.reviews')], ['about', t('visitor.carte.tabAbout')]] as const).map(([id, label]) => <button type="button" key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}</button>)}</div>
        {tab === 'presentation' && <div className="maps-actions">
          <Action icon={<Navigation size={20} />} onClick={() => { trackInteraction(facility.id, 'itineraire'); props.onRequestDirections(); setTab('directions') }}>{t('visitor.carte.actions.directions')}</Action>
          <Action icon={<Bookmark size={20} />} active={props.favorites.includes(facility.id)} onClick={() => { trackInteraction(facility.id, 'sauvegarde'); props.onToggleFavorite(facility.id) }}>{props.favorites.includes(facility.id) ? t('visitor.carte.markerSaved') : t('visitor.carte.markerSave')}</Action>
          <Action icon={<MapPin size={20} />} active={nearbyOnly} onClick={() => { trackInteraction(facility.id, 'proximite'); setNearbyOnly(true); props.onBackToList(); props.onViewChange('explore') }}>{t('visitor.carte.actionNearby')}</Action>
          <Action icon={<Send size={20} />} onClick={() => { trackInteraction(facility.id, 'partage', { channel: 'sms' }); window.location.href = `sms:?body=${encodeURIComponent(`${facility.nom}\n${placeUrl()}`)}` }}>{t('visitor.carte.info.phone')}</Action>
          <Action icon={<Share2 size={20} />} onClick={() => { trackInteraction(facility.id, 'partage'); void share() }}>{t('visitor.carte.actionShare')}</Action>
        </div>}
        {tab === 'presentation' && <div className="maps-actions">
          <Action icon={<MapPin size={20} />} onClick={() => setSuggestionOpen(true)}>{t('visitor.carte.actionSuggest')}</Action>
          <Action icon={<FolderPlus size={20} />} onClick={() => setCollectionOpen(true)}>{t('visitor.carte.actionCollection')}</Action>
          <Action icon={<Phone size={20} />} onClick={() => { if (facility.telephone) { trackInteraction(facility.id, 'telephone'); window.location.href = `tel:${facility.telephone}` } }} disabled={!facility.telephone}>{t('visitor.carte.actions.call')}</Action>
          <Action icon={<Phone size={20} />} tone="danger" onClick={() => { trackInteraction(facility.id, 'sos'); props.onSosClick() }}>SOS</Action>
          <Action icon={<ExternalLink size={20} />} onClick={() => { if (facility.siteWeb) { trackInteraction(facility.id, 'site_web'); window.open(facility.siteWeb, '_blank', 'noopener,noreferrer') } }} disabled={!facility.siteWeb}>{t('visitor.carte.actionWebsite')}</Action>
        </div>}
        {detailError && <p role="status" className="maps-inline-status">{t('visitor.carte.detailUnavailable')}</p>}
        <section className="maps-panel-content" role="tabpanel">
          {(tab === 'presentation' || tab === 'about') && <><FicheInfos fiche={facility as FicheCentre} isMedecin={isMedecin} medecinJoined={joined || Boolean(detail?.medecins?.some(medecin => String(medecin.medecinId) === String(user?.id)))} onJoin={() => void join()} joining={joining} onServiceSelect={(label) => trackInteraction(facility.id, 'service', { service: label })} />{tab === 'presentation' && (facility.images?.length ?? 0) > 1 && <section className="maps-gallery-section"><div className="maps-gallery-section-heading"><h2>{t('visitor.carte.galleryTitle')}</h2><button type="button" onClick={() => { setGalleryFilter('images'); setGalleryIndex(0); setGalleryOpen(true) }}><Images size={16} /> {t('visitor.carte.viewPhotos')}</button></div><MediaGallery centre={facility} disableLightbox onOpen={() => { setGalleryFilter('images'); setGalleryIndex(0); setGalleryOpen(true) }} /></section>}</>}
          {tab === 'directions' && <div className="maps-directions">
            <h2>{t('visitor.carte.tabs.directions')}</h2>
            {!hasCoords && <p role="status">{t('visitor.carte.directionsNoCoords')}</p>}
            <div className="maps-mode-selector">{WAYFINDING_MODES.map(mode => <button type="button" key={mode} aria-pressed={props.mode === mode} onClick={() => props.onModeChange(mode)}>{mode === 'driving' ? t('visitor.carte.directions.driving') : mode === 'walking' ? t('visitor.carte.directions.walking') : t('visitor.carte.directions.bicycling')}</button>)}</div>
            <button type="button" className="maps-outline-command" disabled={!hasCoords} onClick={() => { trackInteraction(facility.id, 'itineraire', { via: 'panel' }); props.onRequestDirections() }}><Navigation size={18} />{props.position ? t('visitor.carte.directionsCompute') : t('visitor.carte.directionsAllowLocation')}</button>
            {props.routeLoading ? <p role="status">{t('visitor.carte.directions.calculating')}</p> : <div><p>{formatDistanceKm(props.distance != null ? props.distance / 1000 : null)} · {formatDuration(props.duration)}</p>{props.isFallback && <p role="status">{t('visitor.carte.directionsApproxWarning')}</p>}{props.routeError && <p role="alert">{props.routeError}</p>}</div>}
            <ol>{props.steps.map((step, index) => <li key={index}><span>{index + 1}.</span> {step.instruction} <small>{Math.round(step.distance)} m</small></li>)}</ol>
            <div className="maps-external-links"><a href={toGoogleMapsUrl(facility)} target="_blank" rel="noopener noreferrer" onClick={() => trackInteraction(facility.id, 'itineraire', { via: 'google' })}>Google Maps</a><a href={toWazeUrl(facility)} target="_blank" rel="noopener noreferrer" onClick={() => trackInteraction(facility.id, 'itineraire', { via: 'waze' })}>Waze</a>{props.routeActive && <button type="button" onClick={props.onClearRoute}>{t('visitor.carte.routeCard.clear')}</button>}</div>
          </div>}
          {tab === 'reviews' && <div className="maps-reviews">
            <div className="maps-review-summary"><div>{[5, 4, 3, 2, 1].map(star => <div className="maps-rating-bar" key={star}><span>{star}</span><progress max={Math.max(1, reviews.length)} value={reviews.filter(review => review.note === star).length} /></div>)}</div><div><strong>{mean.toFixed(1)}</strong><Rating value={mean} /><p>{t('visitor.carte.reviews.count', { count: total })}</p></div><div className="maps-review-notice"><button type="button" aria-expanded={noticeOpen} aria-controls="maps-review-notice-text" aria-label={t('visitor.carte.ariaAboutReviews')} onClick={() => setNoticeOpen(current => !current)}><Info size={16} /></button>{noticeOpen && <p id="maps-review-notice-text" role="tooltip">{t('visitor.carte.reviewsNotice')}</p>}</div></div>
            <button type="button" className="maps-outline-command" onClick={() => isAuthenticated ? setComposer(true) : window.location.assign('/login')}><Star size={18} />{t('visitor.carte.writeReview')}</button>
            <div className="maps-review-tools"><label><Search size={17} /><input value={reviewSearch} onChange={event => setReviewSearch(event.target.value)} placeholder={t('visitor.carte.reviewsSearchPlaceholder')} aria-label={t('visitor.carte.reviewsSearchPlaceholder')} /></label><select aria-label={t('visitor.carte.reviewsSortLabel')} value={sort} onChange={event => setSort(event.target.value)}><option value="recent">{t('visitor.carte.sortRecent')}</option><option value="positive">{t('visitor.carte.sortPositive')}</option><option value="critical">{t('visitor.carte.sortCritical')}</option></select></div>
            {isLoading && <p role="status">{t('visitor.carte.reviewsLoading')}</p>}
            {reviewError && <p role="alert">{t('visitor.carte.reviewsLoadError')}</p>}
            {!isLoading && !reviewError && !reviews.length && <p>{t('visitor.carte.reviewsEmpty')}</p>}
            {reviews.map(review => <article className="maps-review" key={review.id}><div className="maps-review-author"><span className="maps-avatar">{(review.auteurNom || 'U')[0]}</span><div><strong>{review.auteurNom || t('visitor.carte.userFallback')}</strong><div><Rating value={review.note} /><small>{formatMediaDate(review.createdAt, i18n.language)}</small></div></div></div><p>{review.commentaire}</p>{review.images?.length ? <div className="maps-review-images">{review.images.map(image => <a key={image.id} href={imgUrl(image.contentUrl) ?? image.contentUrl} target="_blank" rel="noopener noreferrer"><img src={imgUrl(image.contentUrl) ?? image.contentUrl} alt={t('visitor.carte.reviewPhotoAlt')} loading="lazy" /></a>)}</div> : null}<div className="maps-review-actions"><button type="button" aria-pressed={likes.includes(review.id)} onClick={() => setLikes(current => current.includes(review.id) ? current.filter(id => id !== review.id) : [...current, review.id])}><ThumbsUp size={17} fill={likes.includes(review.id) ? 'currentColor' : 'none'} />{t('visitor.carte.likeButton')}</button><button type="button" onClick={() => void share(review.commentaire)}><Share2 size={17} />{t('visitor.carte.actionShare')}</button></div></article>)}
          </div>}
        </section>
      </> : <>
        <header className="maps-results-heading"><h1>{props.initialView === 'saved' ? t('visitor.carte.viewSaved') : props.initialView === 'recent' ? t('visitor.carte.viewRecent') : t('visitor.carte.resultsTitle')}</h1><button type="button" onClick={props.onClose} aria-label={t('visitor.carte.ariaCloseResults')}><X size={20} /></button></header>
        <div className="maps-result-meta"><span>{t('visitor.carte.establishmentCount', { count: list.length })}</span><label><input type="checkbox" checked={props.onlyUrgence} onChange={event => props.onUrgenceChange(event.target.checked)} />{t('visitor.carte.info.urgences24h')}</label></div>
        {props.loading ? <p className="maps-inline-status">{t('visitor.carte.searching')}</p> : !list.length ? <p className="maps-inline-status">{t('visitor.carte.noEstablishment')}</p> : list.map(centre => <button type="button" className="maps-result" key={centre.id} onClick={() => props.onSelect(centre.id)}><div><h2>{centre.nom}</h2><div className="maps-rating-line"><span>{(centre.noteMoyenne ?? 0).toFixed(1)}</span><Rating value={centre.noteMoyenne ?? 0} /><small>({centre.totalAvis ?? 0})</small></div><p>{centre.type.replaceAll('_', ' ')}</p><p>{centre.adresse}</p>{props.position && <small>{formatDistanceKm(haversineKm(props.position, centre))}</small>}</div><ResultPhoto centre={centre} /></button>)}
      </>}
    </aside>}
    {galleryOpen && facility && (
      <FacilityMediaViewer
        facility={facility as FicheCentre}
        filter={galleryFilter}
        onFilterChange={setGalleryFilter}
        activeIndex={galleryIndex}
        onIndexChange={setGalleryIndex}
        onClose={() => setGalleryOpen(false)}
        onShare={(media) => void shareMedia(media)}
      />
    )}
    {composer && facility && <div className="maps-modal-backdrop" onClick={() => !sending && setComposer(false)}><form className="maps-dialog maps-review-dialog" role="dialog" aria-modal="true" aria-label={t('visitor.carte.writeReview')} onClick={event => event.stopPropagation()} onSubmit={event => { event.preventDefault(); void submit() }}><header className="maps-dialog-header"><div className="maps-dialog-title"><span className="maps-dialog-kicker">{t('visitor.carte.yourReview')}</span><h2>{facility.nom}</h2></div><button type="button" disabled={sending} onClick={() => setComposer(false)} aria-label={t('common.close')}><X size={20} /></button></header><div className="maps-reviewer"><span className="maps-reviewer-avatar">{String(user?.prenom ?? user?.nom ?? user?.email ?? 'U').slice(0, 1).toUpperCase()}</span><div><strong>{user?.prenom || user?.nom ? `${user?.prenom ?? ''} ${user?.nom ?? ''}`.trim() : t('visitor.carte.yourProfile')}</strong><small>{user?.email ?? t('visitor.carte.connectedProfile')}</small></div></div><div className="maps-review-stars" role="group" aria-label={t('visitor.carte.noteAria')}>{[1, 2, 3, 4, 5].map(star => <button type="button" key={star} aria-label={t('visitor.medecinDetail.starAria', { count: star, value: star })} aria-pressed={note === star} onClick={() => setNote(star)}><Star size={32} fill={star <= note ? 'currentColor' : 'none'} /></button>)}</div><textarea autoFocus value={comment} minLength={5} maxLength={2000} onChange={event => setComment(event.target.value)} placeholder={t('visitor.carte.reviewPlaceholder')} aria-label={t('visitor.carte.yourReview')} /><label className={`maps-upload maps-dropzone ${dragActive ? 'is-dragging' : ''}`} onDragEnter={event => { event.preventDefault(); setDragActive(true) }} onDragOver={event => event.preventDefault()} onDragLeave={() => setDragActive(false)} onDrop={event => { event.preventDefault(); setDragActive(false); acceptReviewFiles(Array.from(event.dataTransfer.files)) }}><span className="maps-dropzone-icon"><ImageIcon size={25} /></span><strong>{dragActive ? t('visitor.carte.dropImages') : t('visitor.carte.addPhotos')}</strong><small>{t('visitor.carte.dropHint')}</small><input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={event => { acceptReviewFiles(Array.from(event.target.files ?? [])); event.target.value = '' }} /></label>{files.length > 0 && <div className="maps-upload-grid">{files.map((file, index) => <figure key={`${file.name}-${index}`}><img src={filePreviews[index]} alt={t('visitor.carte.previewAlt', { name: file.name })} /><button type="button" onClick={() => setFiles(current => current.filter((_, item) => item !== index))} aria-label={t('visitor.carte.removeFile', { name: file.name })}><X size={16} /></button></figure>)}</div>}<ul className="maps-selected-files">{files.map((file, index) => <li key={`${file.name}-${index}`}><span>{file.name}</span></li>)}</ul><footer><button type="button" disabled={sending} onClick={() => setComposer(false)}>{t('common.cancel')}</button><button type="submit" disabled={!note || sending}>{sending ? t('visitor.carte.publishing') : t('visitor.carte.publish')}</button></footer></form></div>}
    {suggestionOpen && facility && <div className="maps-modal-backdrop" onClick={() => !suggestionSending && setSuggestionOpen(false)}><form className="maps-dialog maps-suggestion-dialog" role="dialog" aria-modal="true" aria-label={t('visitor.carte.suggestTitle')} onClick={event => event.stopPropagation()} onSubmit={event => { event.preventDefault(); void submitSuggestion() }}><header><div><h2>{t('visitor.carte.suggestTitle')}</h2><p className="maps-dialog-subtitle">{facility.nom}</p></div><button type="button" disabled={suggestionSending} onClick={() => setSuggestionOpen(false)} aria-label={t('common.close')}><X size={22} /></button></header><label className="maps-field-label">{t('visitor.carte.suggestFieldLabel')}<select value={suggestionField} onChange={event => setSuggestionField(event.target.value)}><option value="adresse">{t('visitor.carte.suggestFieldAdresse')}</option><option value="ville">{t('visitor.carte.suggestFieldVille')}</option><option value="region">{t('visitor.carte.suggestFieldRegion')}</option><option value="telephone">{t('visitor.carte.suggestFieldTelephone')}</option><option value="horaires">{t('visitor.carte.suggestFieldHoraires')}</option><option value="services">{t('visitor.carte.suggestFieldServices')}</option><option value="description">{t('visitor.carte.suggestFieldDescription')}</option><option value="siteWeb">{t('visitor.carte.suggestFieldSiteWeb')}</option><option value="autre">{t('visitor.carte.suggestFieldAutre')}</option></select></label><label className="maps-field-label">{t('visitor.carte.suggestValueLabel')}<textarea required minLength={2} maxLength={2000} value={suggestionValue} onChange={event => setSuggestionValue(event.target.value)} placeholder={t('visitor.carte.suggestValuePlaceholder')} /></label><label className="maps-field-label">{t('visitor.carte.suggestCommentLabel')}<textarea maxLength={1200} value={suggestionComment} onChange={event => setSuggestionComment(event.target.value)} placeholder={t('visitor.carte.suggestCommentPlaceholder')} /></label><p className="maps-suggestion-note">{t('visitor.carte.suggestNote')}</p><footer><button type="button" disabled={suggestionSending} onClick={() => setSuggestionOpen(false)}>{t('common.cancel')}</button><button type="submit" disabled={suggestionSending || suggestionValue.trim().length < 2}>{suggestionSending ? t('visitor.carte.sending') : t('visitor.carte.sendSuggestion')}</button></footer></form></div>}
    {collectionOpen && facility && <div className="maps-modal-backdrop"><section className="maps-dialog" role="dialog" aria-modal="true" aria-label={t('visitor.carte.collectionsAria')}><header><h2>{t('visitor.carte.saveToCollection')}</h2><button type="button" onClick={() => setCollectionOpen(false)} aria-label={t('common.close')}><X size={20} /></button></header>{collections.map(collection => <div className="maps-collection" key={collection.id}><label><input type="checkbox" checked={collection.places.includes(facility.id)} onChange={event => saveCollections(collections.map(item => item.id !== collection.id ? item : { ...item, places: event.target.checked ? [...item.places, facility.id] : item.places.filter(id => id !== facility.id) }))} />{collection.name}</label><input value={collection.note} placeholder={t('visitor.carte.privateNote')} aria-label={t('visitor.carte.noteFor', { name: collection.name })} maxLength={600} onChange={event => saveCollections(collections.map(item => item.id !== collection.id ? item : { ...item, note: event.target.value }))} /><button type="button" onClick={() => saveCollections(collections.filter(item => item.id !== collection.id))}>{t('common.delete')}</button></div>)}<form onSubmit={event => { event.preventDefault(); if (!collectionName.trim()) return; saveCollections([...collections, { id: crypto.randomUUID(), name: collectionName.trim(), places: [facility.id], note: '' }]); setCollectionName('') }}><input required maxLength={80} value={collectionName} onChange={event => setCollectionName(event.target.value)} placeholder={t('visitor.carte.collectionNamePlaceholder')} aria-label={t('visitor.carte.collectionNamePlaceholder')} /><button type="submit">{t('visitor.carte.create')}</button></form></section></div>}
  </>
}
