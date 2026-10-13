'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type 
ReactNode } from 'react'
import { Bookmark, CalendarDays, ChevronLeft, ChevronRight, Clapperboard, Clock, ExternalLink, Flag, FolderPlus, Globe, History, Image as ImageIcon, Images, Info, Link2, Loader2, MapPin, MoreVertical, Navigation, Phone, Play, Plus, Printer, Search, Send, Share2, ShieldCheck, Star, ThumbsUp, Video, X } from 'lucide-react'
import useSWR, { mutate } from 'swr'
import { useTranslation } from 'react-i18next'
import api from '../../api/axios'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../ui/Toast'
import { FicheInfos, MediaGallery, type EtablissementDrawerProps } from './EtablissementDrawer'
import { formatDistanceKm, formatDuration, getEtablissementPhoto, haversineKm, toGoogleMapsUrl, toWazeUrl, WAYFINDING_MODES, type Avis, type EtablissementMedia, type FicheCentre } from '../../lib/carte'
import { getMediaEmbedUrl, getMediaProviderLabel, getMediaThumbnailUrl, isExternalVideoMedia, parseExternalVideoUrl, EXTERNAL_VIDEO_PROVIDER_LABELS } from '../../lib/externalVideo'
import { imgUrl } from '../../lib/config'
import { trackInteraction } from '../../lib/track'

type View = 'explore' | 'saved' | 'recent'
type Collection = { id: string; name: string; places: number[]; note: string }
const COLLECTION_KEY = 'medisecours_map_named_collections'
const LIKES_KEY = 'medisecours_carte_avis_likes'

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

/** Date relative façon Google (« il y a 7 mois »), avec repli absolu. */
function formatRelativeDate(value?: string, language = 'fr'): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const locale = language.toLowerCase().startsWith('en') ? 'en' : 'fr'
  const secondes = Math.round((date.getTime() - Date.now()) / 1000)
  const unites: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536000],
    ['month', 2592000],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
    ['second', 1],
  ]
  for (const [unite, duree] of unites) {
    if (Math.abs(secondes) >= duree || unite === 'second') {
      try {
        return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(Math.round(secondes / duree), unite)
      } catch {
        return formatMediaDate(value, language)
      }
    }
  }
  return formatMediaDate(value, language)
}

/** Teinte d'avatar déterministe par auteur (pastille couleur distinctive). */
function teinteAvatar(nom?: string | null): number {
  const base = nom ?? 'U'
  let hash = 0
  for (let i = 0; i < base.length; i++) hash = (hash * 31 + base.charCodeAt(i)) % 360
  return hash
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

type FacilityMediaItem = NonNullable<FicheCentre['images']>[number]

/** Vrai pour les vidéos : fichier téléversé OU lien externe intégré. */
function isVideoItem(item: Pick<EtablissementMedia, 'kind' | 'mimeType' | 'provider' | 'externalUrl' | 'embedUrl'>): boolean {
  return item.kind === 'video' || item.mimeType?.startsWith('video/') || isExternalVideoMedia(item)
}

/** Vignette à afficher : miniature externe, fichier résolu, ou null (badge provider). */
function mediaThumbSrc(item: FacilityMediaItem): string | null {
  return getMediaThumbnailUrl(item) ?? imgUrl(item.contentUrl) ?? item.contentUrl ?? null
}

/** Source du fichier local (jamais un lien externe). */
function mediaFileSrc(item: FacilityMediaItem): string {
  return imgUrl(item.contentUrl) || item.contentUrl
}

/**
 * Visionneuse immersive façon Google Maps : à gauche, le panneau de listing
 * des médias remplace la fiche établissement ; à droite, la scène noire
 * présente le média courant (photo, vidéo téléversée ou vidéo externe
 * intégrée en iframe). Entièrement clavier (Échap, flèches) et tactile.
 */
function FacilityMediaViewer({
  facility,
  filter,
  onFilterChange,
  activeIndex,
  onIndexChange,
  onClose,
  onShare,
  onAdd,
  onReport,
}: {
  facility: FicheCentre
  filter: GalleryFilter
  onFilterChange: (filter: GalleryFilter) => void
  activeIndex: number
  onIndexChange: (index: number) => void
  onClose: () => void
  onShare: (media: NonNullable<FicheCentre['images']>[number]) => void
  onAdd?: () => void
  onReport?: (media: NonNullable<FicheCentre['images']>[number]) => void
}) {
  const { t, i18n } = useTranslation()
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const media = orderedFacilityMedia(facility)
  const filtered = useMemo(() => {
    if (filter === 'videos') return media.filter(isVideoItem)
    if (filter === 'images') return media.filter((item) => !isVideoItem(item))
    return [...media].sort((left, right) => new Date(right.createdAt ?? 0).getTime() - new Date(left.createdAt ?? 0).getTime())
  }, [filter, media])
  const safeIndex = Math.min(Math.max(activeIndex, 0), Math.max(filtered.length - 1, 0))
  const current = filtered[safeIndex]
  const currentIsVideo = current ? isVideoItem(current) : false
  const currentIsExternal = current ? isExternalVideoMedia(current) : false
  const currentEmbed = current ? getMediaEmbedUrl(current) : null
  const currentProviderLabel = current ? getMediaProviderLabel(current) : null
  const currentWatchUrl = current ? (current.externalUrl ?? mediaFileSrc(current)) : ''
  const goPrev = useCallback(() => {
    if (filtered.length > 0) onIndexChange((safeIndex - 1 + filtered.length) % filtered.length)
  }, [filtered.length, onIndexChange, safeIndex])
  const goNext = useCallback(() => {
    if (filtered.length > 0) onIndexChange((safeIndex + 1) % filtered.length)
  }, [filtered.length, onIndexChange, safeIndex])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const previousActive = document.activeElement as HTMLElement | null
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (menuOpen) setMenuOpen(false)
        else onClose()
      }
      else if (event.key === 'ArrowLeft') goPrev()
      else if (event.key === 'ArrowRight') goNext()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      previousActive?.focus?.()
    }
  }, [goNext, goPrev, onClose, menuOpen])

  useEffect(() => {
    if (!menuOpen) return
    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [menuOpen])

  useEffect(() => {
    // Ferme le menu à chaque changement de média.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMenuOpen(false)
  }, [safeIndex, filter])

  useEffect(() => {
    const active = listRef.current?.querySelector('[data-active="true"]')
    active?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [safeIndex, filter])

  const uploaderLabel = mediaUploaderName(current, t('visitor.carte.galleryMember'))
  const dateLabel = current ? (formatMediaDate(current.createdAt, i18n.language) || formatRelativeDate(current.createdAt, i18n.language)) : ''
  const imageMonthYear = (() => {
    if (!current?.createdAt) return ''
    const date = new Date(current.createdAt)
    if (Number.isNaN(date.getTime())) return ''
    try {
      return date.toLocaleDateString(i18n.language.toLowerCase().startsWith('en') ? 'en-CM' : 'fr-CM', { month: 'short', year: 'numeric' })
    } catch {
      return ''
    }
  })()

  const handlePrint = () => {
    setMenuOpen(false)
    window.print()
  }
  const handleReport = () => {
    setMenuOpen(false)
    if (current && onReport) onReport(current)
  }
  const handleShareFromMenu = () => {
    setMenuOpen(false)
    if (current) onShare(current)
  }
  const kindLabel = !current
    ? ''
    : currentIsExternal && currentProviderLabel
      ? `${t('visitor.carte.galleryVideo')} ${currentProviderLabel}`
      : currentIsVideo
        ? t('visitor.carte.galleryVideo')
        : t('visitor.carte.galleryPhoto')

  return (
    <div className="maps-media-viewer maps-media-viewer-gmaps" role="dialog" aria-modal="true" aria-label={`${t('visitor.carte.galleryTitle')} - ${facility.nom}`}>
      {/* ── Panneau listing : remplace la fiche établissement ── */}
      <aside className="maps-media-listing" aria-label={t('visitor.carte.galleryTitle')}>
        <div className="maps-media-listing-search">
          <button ref={closeButtonRef} type="button" className="maps-media-listing-back" onClick={onClose} aria-label={t('visitor.carte.galleryClose')}>
            <ChevronLeft size={22} />
          </button>
          <span className="maps-media-listing-query" title={facility.nom}>{facility.nom}</span>
          <span className="maps-media-listing-search-icon" aria-hidden="true"><Search size={18} /></span>
          <button type="button" className="maps-media-listing-clear" onClick={onClose} aria-label={t('visitor.carte.galleryClose')}>
            <X size={18} />
          </button>
        </div>
        <div className="maps-media-filters maps-media-filters-gmaps" role="tablist" aria-label={t('visitor.carte.galleryFilters')}>
          {([['images', t('visitor.carte.galleryImages')], ['recent', t('visitor.carte.galleryRecent')], ['videos', t('visitor.carte.galleryVideos')]] as const).map(([key, label]) => (
            <button type="button" key={key} role="tab" aria-selected={filter === key} onClick={() => { onFilterChange(key); onIndexChange(0) }}>
              {label}
            </button>
          ))}
        </div>
        <div ref={listRef} className="maps-media-grid" role="listbox" aria-label={t('visitor.carte.galleryTitle')}>
          {filtered.length === 0 && (
            <div className="maps-media-grid-empty">
              <Images size={28} aria-hidden="true" />
              <p>{t('visitor.carte.galleryEmpty')}</p>
            </div>
          )}
          {filtered.map((item, index) => {
            const itemIsVideo = isVideoItem(item)
            const itemIsExternal = isExternalVideoMedia(item)
            const thumb = mediaThumbSrc(item)
            const providerLabel = getMediaProviderLabel(item)
            const itemUploader = mediaUploaderName(item, t('visitor.carte.galleryMember'))
            return (
              <button
                type="button"
                key={`${item.id}-${index}`}
                data-active={index === safeIndex}
                className="maps-media-grid-card"
                role="option"
                aria-selected={index === safeIndex}
                aria-label={`${itemIsVideo ? t('visitor.carte.galleryVideo') : t('visitor.carte.galleryPhoto')} ${index + 1} / ${filtered.length}`}
                onClick={() => onIndexChange(index)}
              >
                {thumb ? (
                  itemIsVideo && itemIsExternal ? (
                    // eslint-disable-next-line @next/next/no-img-element -- vignette distante du fournisseur
                    <img src={thumb} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.display = 'none' }} />
                  ) : itemIsVideo ? (
                    <video src={mediaFileSrc(item)} muted preload="metadata" playsInline aria-hidden="true" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element -- vignette établissement
                    <img src={thumb} alt="" loading="lazy" />
                  )
                ) : (
                  <span className="maps-media-grid-provider" aria-hidden="true">
                    <Clapperboard size={26} />
                    <strong>{providerLabel ?? t('visitor.carte.galleryVideo')}</strong>
                  </span>
                )}
                <span className="maps-media-grid-shade" aria-hidden="true" />
                {itemIsVideo && (
                  <span className="maps-media-grid-play" aria-hidden="true"><Play size={18} fill="currentColor" /></span>
                )}
                {providerLabel && (
                  <span className="maps-media-grid-provider-badge">{providerLabel}</span>
                )}
                <span className="maps-media-grid-meta">
                  <strong>{itemUploader}</strong>
                  <small>{formatRelativeDate(item.createdAt, i18n.language)}</small>
                </span>
              </button>
            )
          })}
        </div>
        <div className="maps-media-listing-foot">
          <span className="maps-media-listing-count" aria-live="polite">
            {filtered.length > 0 ? `${safeIndex + 1} / ${filtered.length}` : t('visitor.carte.galleryEmpty')}
          </span>
          {onAdd && (
            <button type="button" className="maps-media-listing-add" onClick={onAdd}>
              <Plus size={16} aria-hidden="true" /> {t('visitor.carte.ajouterMedia')}
            </button>
          )}
        </div>
      </aside>

      {/* ── Scène principale façon Google Maps ── */}
      <main className="maps-media-stage-gmaps">
        <header className="maps-media-stage-top">
          <div className="maps-media-stage-identity">
            <div className="maps-media-stage-title-row">
              <h2 title={facility.nom}>{facility.nom}</h2>
              <div className="maps-media-stage-menu-wrap" ref={menuRef}>
                <button
                  type="button"
                  className="maps-media-stage-overflow"
                  aria-label={t('visitor.carte.reviewMenuLabel')}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  onClick={() => setMenuOpen((open) => !open)}
                >
                  <MoreVertical size={18} />
                </button>
                {menuOpen && (
                  <div className="maps-media-stage-menu" role="menu">
                    <button type="button" role="menuitem" onClick={handlePrint}>
                      <Printer size={15} aria-hidden="true" /> {t('visitor.carte.mediaPrint')}
                    </button>
                    <button type="button" role="menuitem" onClick={handleReport}>
                      <Flag size={15} aria-hidden="true" /> {t('visitor.carte.mediaReport')}
                    </button>
                    <button type="button" role="menuitem" onClick={handleShareFromMenu}>
                      <Share2 size={15} aria-hidden="true" /> {t('visitor.carte.actionShare')}
                    </button>
                  </div>
                )}
              </div>
            </div>
            <p>
              <span className="maps-media-stage-avatar" aria-hidden="true">
                {mediaUploaderInitials(uploaderLabel)}
              </span>
              <strong>{uploaderLabel}</strong>
            </p>
            {current && (
              <small className="maps-media-stage-date">
                {kindLabel}{dateLabel ? ` – ${dateLabel}` : ''}
              </small>
            )}
          </div>
          <div className="maps-media-stage-top-actions">
            <button type="button" className="maps-media-stage-share" onClick={() => current && onShare(current)}>
              <Share2 size={15} aria-hidden="true" /> {t('visitor.carte.actionShare')}
            </button>
            <button type="button" className="maps-media-stage-close" onClick={onClose} aria-label={t('visitor.carte.galleryClose')}>
              <X size={20} />
            </button>
          </div>
        </header>

        <div className="maps-media-stage-canvas-wrap">
          {!current ? (
            <div className="maps-media-stage-empty">
              <Images size={32} aria-hidden="true" />
              <p>{t('visitor.carte.galleryEmpty')}</p>
            </div>
          ) : currentIsExternal && currentEmbed ? (
            <div className="maps-media-stage-embed">
              <iframe
                key={currentEmbed}
                src={currentEmbed}
                title={`${facility.nom} — ${kindLabel}`}
                className="maps-media-player maps-media-iframe"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
              <a href={currentWatchUrl} target="_blank" rel="noopener noreferrer" className="maps-media-external-open">
                {t('visitor.carte.videoOuvrirPlateforme', 'Ouvrir sur {{plateforme}}').replace('{{plateforme}}', currentProviderLabel ?? t('visitor.carte.galleryVideo'))}
                <ExternalLink size={14} aria-hidden="true" />
              </a>
            </div>
          ) : currentIsVideo ? (
            <video key={mediaFileSrc(current)} src={mediaFileSrc(current)} controls autoPlay playsInline className="maps-media-player" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- média établissement plein écran
            <img key={mediaFileSrc(current)} src={mediaFileSrc(current)} alt={`${facility.nom} - ${current.originalName || t('visitor.carte.galleryPhoto')}`} className="maps-media-player" />
          )}
        </div>

        <div className="maps-media-stage-nav" role="group" aria-label={t('visitor.carte.galleryTitle')}>
          <button type="button" onClick={goPrev} aria-label={t('visitor.carte.galleryPrevious')} disabled={filtered.length < 2}>
            <ChevronLeft size={22} />
          </button>
          <span className="maps-media-stage-counter" aria-live="polite">
            {filtered.length > 0 ? `${safeIndex + 1} / ${filtered.length}` : '0 / 0'}
          </span>
          <button type="button" onClick={goNext} aria-label={t('visitor.carte.galleryNext')} disabled={filtered.length < 2}>
            <ChevronRight size={22} />
          </button>
        </div>

        <div className="maps-media-stage-locate">
          <a
            href={toGoogleMapsUrl(facility)}
            target="_blank"
            rel="noopener noreferrer"
            className="maps-media-stage-minimap"
            aria-label={facility.nom}
            title={facility.nom}
          >
            <svg viewBox="0 0 120 120" aria-hidden="true">
              <rect width="120" height="120" fill="#e9edf0" />
              <path d="M-4 34 H124 M-4 72 H124 M28 -4 V124 M64 -4 V124 M96 -4 V124" stroke="#ffffff" strokeWidth="7" />
              <path d="M-4 118 L124 26" stroke="#ffffff" strokeWidth="5" />
              <path d="M70 78 h54 v46 H70 z" fill="#cfe8cf" />
              <circle cx="18" cy="16" r="7" fill="#9aa0a6" />
              <circle cx="18" cy="16" r="3.4" fill="#e9edf0" />
              <g>
                <circle cx="60" cy="56" r="17" fill="#ea4335" stroke="#ffffff" strokeWidth="3" />
                <circle cx="60" cy="50" r="4.6" fill="#ffd54f" />
                <path d="M51.5 66 c0-6.5 3.8-10.5 8.5-10.5 s8.5 4 8.5 10.5 z" fill="#ffd54f" />
              </g>
            </svg>
            <span className="maps-media-stage-minimap-open" aria-hidden="true">
              <ExternalLink size={12} />
            </span>
          </a>
          <small className="maps-media-stage-locate-caption">
            {imageMonthYear
              ? t('visitor.carte.galleryImageDate', "Date de l'image : {{date}}").replace('{{date}}', imageMonthYear)
              : ([facility.ville].filter(Boolean).join('') || facility.adresse)}
          </small>
        </div>
        <span className="maps-media-stage-brand" aria-hidden="true">MediSecours Maps</span>
      </main>
    </div>
  )
}

function SimilaireCard({ centre, onSelect }: {
  centre: EtablissementDrawerProps['visibleCentres'][number]
  onSelect: () => void
}) {
  const { t } = useTranslation()
  const photo = getEtablissementPhoto(centre)
  const note = centre.noteMoyenne ?? 0
  const total = centre.totalAvis ?? 0
  return (
    <button type="button" className="maps-similar-card" onClick={onSelect} aria-label={centre.nom}>
      {/* eslint-disable-next-line @next/next/no-img-element -- vignette établissement externe */}
      <img
        src={imgUrl(photo) ?? '/images/home-doctor-visit.jpg'}
        alt=""
        loading="lazy"
        onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = '/images/home-doctor-visit.jpg' }}
      />
      <span className="maps-similar-name">{centre.nom}</span>
      <span className="maps-similar-meta">
        <span className="maps-similar-rating">{note.toFixed(1).replace('.', ',')}</span>
        <Star size={12} fill="currentColor" aria-hidden="true" />
        <span className="maps-similar-count">({total})</span>
        <span className="maps-similar-dot" aria-hidden="true">·</span>
        <span className="maps-similar-type">{t(`visitor.carte.type.${centre.type}` as never) || String(centre.type).replaceAll('_', ' ')}</span>
      </span>
    </button>
  )
}

function SourceWebCarte({ centreId, siteWeb, nom }: { centreId: number; siteWeb: string; nom: string }) {
  const { t } = useTranslation()
  const { data, isLoading } = useSWR<{ url: string | null; titre: string | null; description: string | null; image: string | null }>(
    `/api/carte/etablissements/${centreId}/source-web`,
    { revalidateOnFocus: false },
  )
  if (isLoading) {
    return (
      <div className="maps-web-card maps-web-skeleton" aria-hidden="true">
        <span className="maps-web-skel-line maps-web-skel-url" />
        <span className="maps-web-skel-line maps-web-skel-title" />
        <span className="maps-web-skel-line" />
        <span className="maps-web-skel-line maps-web-skel-short" />
      </div>
    )
  }
  if (!data?.url) return null
  let hote = ''
  try {
    hote = new URL(data.url).hostname
  } catch { /* URL invalide : favicon ignoré */ }
  return (
    <a href={data.url} target="_blank" rel="noopener noreferrer" className="maps-web-card">
      <span className="maps-web-url">
        {hote !== '' && (
          // eslint-disable-next-line @next/next/no-img-element -- favicon distant
          <img
            src={`https://www.google.com/s2/favicons?domain=${hote}&sz=64`}
            alt=""
            loading="lazy"
            onError={(event) => { event.currentTarget.style.display = 'none' }}
          />
        )}
        {data.url.replace(/^https?:\/\//, '')}
      </span>
      <strong>{data.titre ?? nom}</strong>
      {data.image ? (
        // eslint-disable-next-line @next/next/no-img-element -- image OpenGraph distante
        <img src={data.image} alt="" loading="lazy" className="maps-web-image" onError={(event) => { event.currentTarget.style.display = 'none' }} />
      ) : null}
      {data.description != null && data.description !== '' && <p>{data.description}</p>}
      {!data.description && <p className="maps-web-fallback">{siteWeb}</p>}
      <span className="maps-web-open">{t('visitor.carte.webOuvrir')} <ExternalLink size={14} /></span>
      <span className="maps-web-source">{t('visitor.carte.webSource', 'Source : site officiel de l’établissement')}</span>
    </a>
  )
}

export default function MapsPanel(props: EtablissementDrawerProps & { initialView: View; onViewChange: (view: View) => void; railOpen?: boolean }) {
  const { t, i18n } = useTranslation()
  const { user, isAuthenticated, isMedecin, isEtablissement, isPersonnel, isAdmin } = useAuth() as {
    user: { id?: string | number; prenom?: string; nom?: string; email?: string } | null
    isAuthenticated: boolean
    isMedecin: boolean
    isEtablissement: boolean
    isPersonnel: boolean
    isAdmin: boolean
  }
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
  const [menuReviewId, setMenuReviewId] = useState<number | null>(null)

  const toggleLike = useCallback((reviewId: number) => {
    setLikes((current) => {
      const next = current.includes(reviewId) ? current.filter((id) => id !== reviewId) : [...current, reviewId]
      try {
        const stored = JSON.parse(localStorage.getItem(LIKES_KEY) ?? '{}')
        const table = typeof stored === 'object' && stored !== null ? stored : {}
        table[String(props.selectedId ?? 0)] = next
        localStorage.setItem(LIKES_KEY, JSON.stringify(table))
      } catch { /* stockage indisponible : le like reste en mémoire */ }
      return next
    })
  }, [props.selectedId])
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
  // Galerie « Photos et vidéos » : filtre des tuiles, pagination du carrousel,
  // popup d'import réservé au personnel de l'établissement.
  const [mediaFilter, setMediaFilter] = useState<'tout' | 'recent' | 'videos'>('tout')
  const [carouselIndex, setCarouselIndex] = useState(0)
  const carouselRef = useRef<HTMLDivElement | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadFiles, setUploadFiles] = useState<File[]>([])
  const [uploadPreviews, setUploadPreviews] = useState<string[]>([])
  const [uploadDragOver, setUploadDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const selected = props.visibleCentres.find(centre => centre.id === props.selectedId)
  const { data: detail, error: detailError } = useSWR<FicheCentre>(selected ? `/api/centre_de_santes/${selected.id}/fiche` : null)
  const { data: reviewResponse, error: reviewError, isLoading, mutate: refreshReviews } = useSWR<unknown>(selected ? `/api/avis_etablissements?etablissement=${selected.id}` : null)
  const facility = useMemo(
    () => (detail ? { ...selected, ...detail } : selected),
    [detail, selected],
  )
  const reviews = useMemo(() => {
    const raw = reviewResponse as { member?: Avis[]; 'hydra:member'?: Avis[] } | Avis[] | undefined
    const values = Array.isArray(raw) ? raw : raw?.member ?? raw?.['hydra:member'] ?? []
    return values.filter(review => review.statut === 'PUBLIE').filter(review => !reviewSearch || `${review.auteurNom ?? ''} ${review.commentaire ?? ''}`.toLocaleLowerCase().includes(reviewSearch.toLocaleLowerCase())).sort((a, b) => {
      if (sort === 'positive') return b.note - a.note
      if (sort === 'critical') return a.note - b.note
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }, [reviewResponse, reviewSearch, sort])

  // Statistiques par auteur calculées sur les avis chargés (« N avis · M photos »).
  const statsAuteur = useMemo(() => {
    const table: Record<string, { avis: number; photos: number }> = {}
    for (const review of reviews) {
      const key = review.auteurNom ?? ''
      const entry = table[key] ?? { avis: 0, photos: 0 }
      entry.avis += 1
      entry.photos += review.images?.length ?? 0
      table[key] = entry
    }
    return table
  }, [reviews])

  // ── Galerie « Photos et vidéos » : données dérivées ──────────────────────
  const mediasEtablissement = useMemo(
    () => (facility ? orderedFacilityMedia(facility) : []),
    [facility],
  )
  const videosEtablissement = useMemo(
    () => mediasEtablissement.filter(isVideoItem),
    [mediasEtablissement],
  )
  const mediasRecents = useMemo(
    () => [...mediasEtablissement].sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()),
    [mediasEtablissement],
  )
  const mediasAffiches = mediaFilter === 'videos' ? videosEtablissement : mediaFilter === 'recent' ? mediasRecents : mediasEtablissement
  const pagesCarousel = Math.max(mediasAffiches.length, 1)

  // Import réservé aux responsables/personnels de CET établissement connecté uniquement.
  // Responsable = manager via /api/carte/mon-etablissement, personnel validé via /api/personnel/moi,
  // compte établissement (ROLE_ETABLISSEMENT) ou admin rattaché à cette fiche.
  const { data: monEtab } = useSWR<{ centre?: { id?: number } }>(isAuthenticated ? '/api/carte/mon-etablissement' : null)
  const { data: profilPersonnel } = useSWR<{ etablissement?: { id?: number } }>(
    isAuthenticated && (isPersonnel || isEtablissement) ? '/api/personnel/moi' : null,
  )
  const peutDeposerMedia = facility != null && isAuthenticated && (
    (monEtab?.centre?.id ?? null) === facility.id
    || ((profilPersonnel as { etablissement?: { id?: number } } | null)?.etablissement?.id ?? null) === facility.id
    || (isAdmin && (monEtab?.centre?.id ?? null) === facility.id)
  )

  // Établissements similaires : même type d'abord, puis même ville pour équilibrer
  // la découverte — les mieux notés d'un côté, les moins visités de l'autre.
  const similaires = useMemo(() => {
    if (!facility) return { mieuxNotes: [], moinsVus: [] }
    const autres = props.visibleCentres.filter((centre) => centre.id !== facility.id)
    const memeType = autres.filter((centre) => centre.type === facility.type)
    const base = memeType.length >= 2 ? memeType : [
      ...memeType,
      ...autres.filter((c) => c.type !== facility.type && (c.ville ?? '') === (facility.ville ?? '') && (facility.ville ?? '') !== ''),
    ]
    const pool = base.length >= 2 ? base : autres
    const mieuxNotes = [...pool]
      .sort((a, b) => {
        const diff = (b.noteMoyenne ?? 0) - (a.noteMoyenne ?? 0)
        if (diff !== 0) return diff
        return (b.totalAvis ?? 0) - (a.totalAvis ?? 0)
      })
      .slice(0, 6)
    const idsTop = new Set(mieuxNotes.map((c) => c.id))
    const moinsVus = [...pool]
      .filter((c) => !idsTop.has(c.id))
      .sort((a, b) => (a.totalAvis ?? 0) - (b.totalAvis ?? 0))
      .slice(0, 6)
    // Si tout le pool est déjà dans mieux notés (peu de résultats), compléter
    // les moins vus avec les moins avisées du pool pour garder l'équilibre.
    if (moinsVus.length === 0 && pool.length > 1) {
      moinsVus.push(...[...pool].sort((a, b) => (a.totalAvis ?? 0) - (b.totalAvis ?? 0)).slice(0, 4))
    }
    return { mieuxNotes, moinsVus }
  }, [props.visibleCentres, facility])

  // Source web officielle (scraping léger côté API).
  const { data: sourceWeb } = useSWR<{ url: string | null; titre: string | null; description: string | null; image: string | null }>(
    facility?.siteWeb ? `/api/carte/etablissements/${facility.id}/source-web` : null,
    { revalidateOnFocus: false },
  )

  const surDefilementCarrousel = () => {
    const piste = carouselRef.current
    if (!piste) return
    const gauche = piste.scrollLeft + 8
    const enfants = Array.from(piste.children) as HTMLElement[]
    const index = enfants.findIndex((enfant) => enfant.offsetLeft + enfant.clientWidth > gauche)
    if (index >= 0) setCarouselIndex(index)
  }
  const defilerVersMedia = (index: number) => {
    const piste = carouselRef.current
    const cible = piste ? (Array.from(piste.children)[index] as HTMLElement | undefined) : undefined
    cible?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' })
  }
  const accepterFichiersMedia = (entrants: File[]) => {
    const valides: File[] = []
    for (const fichier of entrants) {
      const estImage = fichier.type.startsWith('image/')
      const estVideo = fichier.type.startsWith('video/')
      const extensionOk = /\.(jpe?g|png|webp|gif|mp4|webm|mov)$/i.test(fichier.name)
      if ((!estImage && !estVideo && !extensionOk) || fichier.size > 10 * 1024 * 1024) {
        toast.error(t('visitor.carte.uploadTropLourd', { nom: fichier.name }))
        continue
      }
      valides.push(fichier)
    }
    if (valides.length === 0) return
    setUploadFiles((current) => [...current, ...valides].slice(0, 10))
  }

  const envoyerMedias = async () => {
    if (!facility || uploadFiles.length === 0 || uploading) return
    setUploading(true)
    try {
      for (const fichier of uploadFiles) {
        const form = new FormData()
        form.set('file', fichier)
        form.set('centre', String(facility.id))
        await api.post('/api/carte/medias', form)
      }
      setUploadFiles([])
      setUploadOpen(false)
      toast.success(t('visitor.carte.uploadSucces'))
      await mutate(`/api/centre_de_santes/${facility.id}/fiche`)
    } catch {
      toast.error(t('visitor.carte.uploadErreur'))
    } finally {
      setUploading(false)
    }
  }

  // ── Onglet « Lien vidéo » : aperçu instantané puis dépôt ────────────────
  const [uploadTab, setUploadTab] = useState<'fichiers' | 'lien'>('fichiers')
  const [videoLink, setVideoLink] = useState('')
  const parsedVideoLink = useMemo(() => {
    const trimmed = videoLink.trim()
    if (!trimmed) return null
    return parseExternalVideoUrl(trimmed)
  }, [videoLink])

  const envoyerLienVideo = async () => {
    if (!facility || !parsedVideoLink || uploading) return
    setUploading(true)
    try {
      await api.post('/api/carte/medias', {
        centre: facility.id,
        videoUrl: parsedVideoLink.watchUrl,
      })
      setVideoLink('')
      setUploadTab('fichiers')
      setUploadOpen(false)
      toast.success(t('visitor.carte.uploadSucces'))
      await mutate(`/api/centre_de_santes/${facility.id}/fiche`)
    } catch (requestError: any) {
      toast.error(requestError?.response?.data?.detail ?? requestError?.response?.data?.error ?? t('visitor.carte.uploadErreur'))
    } finally {
      setUploading(false)
    }
  }

  useEffect(() => {
    // Reset the drawer workflow when a different establishment is selected.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTab('presentation'); setComposer(false); setNote(0); setComment(''); setFiles([]); setJoined(false); setGalleryOpen(false); setGalleryIndex(0); setGalleryFilter('images'); setMenuReviewId(null); setMediaFilter('tout'); setCarouselIndex(0); setUploadOpen(false); setUploadFiles([]); setUploadPreviews([]); setUploadDragOver(false); setUploadTab('fichiers'); setVideoLink('')
    try {
      const stored = JSON.parse(localStorage.getItem(LIKES_KEY) ?? '{}')
      const saved = typeof stored === 'object' && stored !== null ? stored[String(props.selectedId ?? 0)] : null
      setLikes(Array.isArray(saved) ? saved.filter((id) => typeof id === 'number') : [])
    } catch {
      setLikes([])
    }
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
  const signalerReview = async (id: number) => {
    if (!isAuthenticated) {
      window.location.assign('/login')
      return
    }
    try {
      await api.post(`/api/avis_etablissements/${id}/signaler`, {})
      toast.success(t('visitor.carte.reviewSignaleOk'))
    } catch {
      toast.error(t('visitor.carte.reviewSignalerErreur'))
    }
  }
  const shareMedia = async (media: NonNullable<FicheCentre['images']>[number]) => {
    const source = media.externalUrl ?? imgUrl(media.contentUrl) ?? media.contentUrl
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
  // « Signaler un problème » sur un média : réutilise le workflow de
  // suggestions/modération existant (champ « autre »), jamais d'endpoint ad hoc.
  const reportMedia = async (media: NonNullable<FicheCentre['images']>[number]) => {
    if (!facility) return
    if (!isAuthenticated) {
      window.location.assign('/login')
      return
    }
    try {
      await api.post('/api/suggestion_etablissements', {
        etablissement: `/api/centre_de_santes/${facility.id}`,
        champ: 'autre',
        valeurProposee: t('visitor.carte.mediaReportValue', {
          nom: media.originalName ?? t('visitor.carte.mediaFallbackName'),
          id: media.id,
        }),
        commentaire: null,
      })
      trackInteraction(facility.id, 'suggestion')
      toast.success(t('visitor.carte.mediaReportOk'))
    } catch (cause: any) {
      toast.error(cause?.response?.data?.detail ?? t('visitor.carte.mediaReportError'))
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

  useEffect(() => {
    const urls = uploadFiles.map((file) => {
      try {
        return URL.createObjectURL(file)
      } catch {
        return ''
      }
    })
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUploadPreviews(urls)
    return () => urls.forEach((url) => { if (url) URL.revokeObjectURL(url) })
  }, [uploadFiles])

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
          <Action icon={<span aria-hidden="true" className="maps-sos-chip">SOS</span>} tone="danger" onClick={() => { trackInteraction(facility.id, 'sos'); props.onSosClick() }}>SOS</Action>
          <Action icon={<ExternalLink size={20} />} onClick={() => { if (facility.siteWeb) { trackInteraction(facility.id, 'site_web'); window.open(facility.siteWeb, '_blank', 'noopener,noreferrer') } }} disabled={!facility.siteWeb}>{t('visitor.carte.actionWebsite')}</Action>
        </div>}
        {detailError && <p role="status" className="maps-inline-status">{t('visitor.carte.detailUnavailable')}</p>}
        <section className="maps-panel-content" role="tabpanel">
          {(tab === 'presentation' || tab === 'about') && <><FicheInfos fiche={facility as FicheCentre} isMedecin={isMedecin} medecinJoined={joined || Boolean(detail?.medecins?.some(medecin => String(medecin.medecinId) === String(user?.id)))} onJoin={() => void join()} joining={joining} onServiceSelect={(label) => trackInteraction(facility.id, 'service', { service: label })} />{tab === 'presentation' && <section className="maps-gallery-section maps-photos-videos" aria-label={t('visitor.carte.photosVideosTitle')}>
          <div className="maps-gallery-section-heading maps-photos-heading">
            <h2>{t('visitor.carte.photosVideosTitle')}</h2>
            {mediasEtablissement.length > 0 && (
              <span className="maps-photos-count" aria-label={`${mediasEtablissement.length} médias`}>
                {mediasEtablissement.length}
              </span>
            )}
            <button
              type="button"
              className="maps-photos-more"
              onClick={() => { setGalleryFilter(mediaFilter === 'videos' ? 'videos' : 'images'); setGalleryIndex(0); setGalleryOpen(true) }}
            >
              {t('visitor.carte.voirPlus')} <ChevronRight size={13} aria-hidden="true" />
            </button>
          </div>

          {/* Tuiles verticales façon Google : Tout / Les plus récentes / Vidéos — cliquables vers le viewer */}
          <div className="maps-media-tiles-wrap">
            <div className="maps-media-tiles maps-media-tiles-shorts" role="tablist" aria-label={t('visitor.carte.photosVideosTitle')}>
              {([
                ['tout', mediasEtablissement[0], t('visitor.carte.mediaFiltreTout'), mediasEtablissement.length > 0 ? `${mediasEtablissement.length} médias` : ''],
                ['recent', mediasRecents[0], t('visitor.carte.mediaFiltreRecentes'), mediasRecents[0]?.createdAt ? formatRelativeDate(mediasRecents[0]?.createdAt, i18n.language) : ''],
                ['videos', videosEtablissement[0], t('visitor.carte.mediaFiltreVideos'), videosEtablissement.length > 0 ? `${videosEtablissement.length} vidéo${videosEtablissement.length > 1 ? 's' : ''}` : ''],
              ] as const).map(([mode, premier, label, sousLabel]) => {
                const estVideo = premier != null && isVideoItem(premier)
                const estExterne = premier != null && isExternalVideoMedia(premier)
                const thumb = premier ? mediaThumbSrc(premier) : null
                const srcFichier = premier && !estExterne ? mediaFileSrc(premier) : null
                const providerLabel = premier ? getMediaProviderLabel(premier) : null
                const filtreViewer: GalleryFilter = mode === 'videos' ? 'videos' : mode === 'recent' ? 'recent' : 'images'
                return (
                  <button
                    key={mode}
                    type="button"
                    role="tab"
                    aria-selected={mediaFilter === mode}
                    aria-label={`${label}${sousLabel ? ` — ${sousLabel}` : ''}`}
                    onClick={() => {
                      setMediaFilter(mode)
                      setCarouselIndex(0)
                      setGalleryFilter(filtreViewer)
                      setGalleryIndex(0)
                      setGalleryOpen(true)
                    }}
                    className={`maps-media-tile maps-media-tile-luxe maps-media-tile-short${mediaFilter === mode ? ' is-active' : ''}`}
                  >
                    {thumb || srcFichier ? (
                      estVideo ? (
                        <span className="maps-media-tile-visual">
                          {estExterne && thumb ? (
                            // eslint-disable-next-line @next/next/no-img-element -- vignette distante du fournisseur
                            <img src={thumb} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.display = 'none' }} />
                          ) : estExterne ? (
                            <span className="maps-media-tile-provider" aria-hidden="true">
                              <Clapperboard size={26} />
                              <strong>{providerLabel}</strong>
                            </span>
                          ) : (
                            srcFichier && <video src={srcFichier} muted playsInline preload="metadata" aria-hidden="true" />
                          )}
                          <span className="maps-media-tile-shade" aria-hidden="true" />
                          <span className="maps-media-tile-play" aria-hidden="true"><Play size={22} fill="currentColor" /></span>
                          {providerLabel && <span className="maps-media-tile-provider-badge">{providerLabel}</span>}
                        </span>
                      ) : (
                        <span className="maps-media-tile-visual">
                          {/* eslint-disable-next-line @next/next/no-img-element -- vignette tuile média externe */}
                          <img src={(thumb ?? srcFichier) || ''} alt="" loading="lazy" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = '/images/home-doctor-visit.jpg' }} />
                          <span className="maps-media-tile-shade" aria-hidden="true" />
                        </span>
                      )
                    ) : (
                      <span className="maps-media-tile-visual maps-media-tile-empty"><Images size={26} aria-hidden="true" /><span className="maps-media-tile-shade" aria-hidden="true" /></span>
                    )}
                    <span className="maps-media-tile-copy">
                      <strong>{label}</strong>
                      {sousLabel ? <small>{sousLabel}</small> : null}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Carrousel moderne paginé — filtre courant */}
          {mediasAffiches.length > 0 && (
            <div className="maps-media-carousel maps-carousel-luxe">
              <div ref={carouselRef} onScroll={surDefilementCarrousel} className="maps-media-strip" role="tablist" aria-label={t('visitor.carte.photosVideosTitle')}>
                {mediasAffiches.map((item, index) => {
                  const estVideo = isVideoItem(item)
                  const estExterne = isExternalVideoMedia(item)
                  const thumb = mediaThumbSrc(item)
                  const srcFichier = !estExterne ? mediaFileSrc(item) : null
                  const providerLabel = getMediaProviderLabel(item)
                  return (
                    <button
                      key={item.id ?? `${item.contentUrl}-${index}`}
                      type="button"
                      role="tab"
                      aria-selected={carouselIndex === index}
                      className={`maps-media-slide maps-slide-luxe${carouselIndex === index ? ' is-current' : ''}`}
                      aria-label={estVideo ? t('visitor.carte.videoLire') : `${facility.nom} — photo ${index + 1}`}
                      onClick={() => {
                        const filtre: GalleryFilter = mediaFilter === 'videos' ? 'videos' : 'recent'
                        const liste = filtre === 'videos' ? videosEtablissement : mediasRecents
                        const position = liste.findIndex((m) => m === item)
                        setGalleryFilter(filtre)
                        setGalleryIndex(position >= 0 ? position : 0)
                        setGalleryOpen(true)
                      }}
                    >
                      {estVideo ? (
                        <span className="maps-media-slide-video">
                          {estExterne && thumb ? (
                            // eslint-disable-next-line @next/next/no-img-element -- vignette distante du fournisseur
                            <img src={thumb} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.display = 'none' }} />
                          ) : estExterne ? (
                            <span className="maps-media-tile-provider" aria-hidden="true">
                              <Clapperboard size={24} />
                              <strong>{providerLabel}</strong>
                            </span>
                          ) : (
                            srcFichier && <video src={srcFichier} muted playsInline preload="metadata" aria-hidden="true" />
                          )}
                          <span className="maps-media-play maps-play-luxe"><Play size={20} fill="currentColor" /></span>
                          <span className="maps-slide-duration" aria-hidden="true"><Video size={12} /> {providerLabel ?? 'vidéo'}</span>
                        </span>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element -- vignette carrousel externe
                        <img src={(thumb ?? srcFichier) || ''} alt="" loading="lazy" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = '/images/home-doctor-visit.jpg' }} />
                      )}
                    </button>
                  )
                })}
              </div>
              {mediasAffiches.length > 1 && (
                <div className="maps-media-pagination maps-pagination-luxe">
                  <button type="button" className="maps-page-btn" aria-label={t('visitor.carte.galleryPrevious')} onClick={() => defilerVersMedia(Math.max(0, carouselIndex - 1))}><ChevronLeft size={18} /></button>
                  <div className="maps-media-dots" role="tablist" aria-label="Pagination">
                    {mediasAffiches.slice(0, 12).map((_, index) => (
                      <button key={index} type="button" role="tab" aria-selected={carouselIndex === index} aria-label={`${index + 1} / ${mediasAffiches.length}`} onClick={() => defilerVersMedia(index)} className={carouselIndex === index ? 'is-active' : ''} />
                    ))}
                  </div>
                  <span className="maps-media-counter">{carouselIndex + 1} / {mediasAffiches.length}</span>
                  <button type="button" className="maps-page-btn" aria-label={t('visitor.carte.galleryNext')} onClick={() => defilerVersMedia(Math.min(mediasAffiches.length - 1, carouselIndex + 1))}><ChevronRight size={18} /></button>
                </div>
              )}
            </div>
          )}

          {mediasEtablissement.length === 0 && (
            <p className="maps-media-empty">{t('visitor.carte.galleryEmpty')}</p>
          )}

          {peutDeposerMedia ? (
            <div className="maps-media-actions maps-media-actions-luxe">
              <button type="button" className="maps-media-add maps-btn-ajouter-sobre" onClick={() => setUploadOpen(true)}>
                <Plus size={16} aria-hidden="true" /> {t('visitor.carte.ajouterMedia')}
              </button>
            </div>
          ) : null}
        </section>}

        {/* ── Établissements similaires : mieux notés + moins visités (équilibré) ── */}
        {(similaires.mieuxNotes.length > 0 || similaires.moinsVus.length > 0) && (
          <section className="maps-similar maps-similar-luxe" aria-label={t('visitor.carte.similairesTitre')}>
            <h2>{t('visitor.carte.similairesTitre')}</h2>
            <p className="maps-similar-hint">{t('visitor.carte.similairesHint', 'Des lieux proches à découvrir, entre valeurs sûres et pépites moins connues.')}</p>
            {similaires.mieuxNotes.length > 0 && (
              <div className="maps-similar-group">
                <p><Star size={13} aria-hidden="true" /> {t('visitor.carte.mieuxNotes')}</p>
                <div className="maps-similar-row">
                  {similaires.mieuxNotes.map((centre) => (
                    <SimilaireCard key={centre.id} centre={centre} onSelect={() => props.onSelect(centre.id)} />
                  ))}
                </div>
              </div>
            )}
            {similaires.moinsVus.length > 0 && (
              <div className="maps-similar-group">
                <p><MapPin size={13} aria-hidden="true" /> {t('visitor.carte.moinsVisites')}</p>
                <div className="maps-similar-row">
                  {similaires.moinsVus.map((centre) => (
                    <SimilaireCard key={centre.id} centre={centre} onSelect={() => props.onSelect(centre.id)} />
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── Résultats Web : recherches réelles en ligne (scraping + parsing source officielle) ── */}
        {facility.siteWeb && (
          <section className="maps-web maps-web-luxe" aria-label={t('visitor.carte.webTitre')}>
            <h2>{t('visitor.carte.webTitre')}</h2>
            <p className="maps-web-hint">
              <Globe size={13} aria-hidden="true" /> {t('visitor.carte.webHint', 'Présence web réelle de cet établissement, pour la crédibilité.')}
            </p>
            <SourceWebCarte centreId={facility.id} siteWeb={facility.siteWeb} nom={facility.nom} />
          </section>
        )}

        {/* ── Popup moderne d'ajout de médias (responsables & personnels connectés uniquement) ── */}
        {uploadOpen && facility && (
          <div className="maps-modal-backdrop maps-upload-backdrop" onClick={() => !uploading && setUploadOpen(false)}>
            <div className="maps-dialog maps-upload-dialog maps-upload-luxe" role="dialog" aria-modal="true" aria-label={t('visitor.carte.uploadTitre')} onClick={(event) => event.stopPropagation()}>
              <header className="maps-upload-head">
                <div className="maps-upload-title">
                  <span className="maps-upload-badge"><ImageIcon size={18} aria-hidden="true" /></span>
                  <div>
                    <h2>{t('visitor.carte.uploadTitre')}</h2>
                    <p className="maps-dialog-subtitle">{t('visitor.carte.uploadDesc')}</p>
                    <p className="maps-upload-staff">{t('visitor.carte.uploadStaffOnly', 'Réservé aux responsables et personnels de cet établissement, connectés.')}</p>
                  </div>
                </div>
                <button type="button" className="maps-dialog-close" disabled={uploading} onClick={() => setUploadOpen(false)} aria-label={t('common.close')}><X size={20} /></button>
              </header>
              <div className="maps-upload-tabs" role="tablist" aria-label={t('visitor.carte.uploadTitre')}>
                <button type="button" role="tab" aria-selected={uploadTab === 'fichiers'} onClick={() => setUploadTab('fichiers')}>
                  <ImageIcon size={15} aria-hidden="true" /> {t('visitor.carte.uploadOngletFichiers', 'Fichiers')}
                </button>
                <button type="button" role="tab" aria-selected={uploadTab === 'lien'} onClick={() => setUploadTab('lien')}>
                  <Link2 size={15} aria-hidden="true" /> {t('visitor.carte.uploadOngletLien', 'Lien vidéo')}
                </button>
              </div>
              {uploadTab === 'fichiers' ? (
                <>
                  <label
                    className={`maps-upload maps-dropzone maps-dropzone-luxe${uploadDragOver ? ' is-dragging' : ''}`}
                    onDragEnter={(event) => { event.preventDefault(); setUploadDragOver(true) }}
                    onDragOver={(event) => { event.preventDefault(); setUploadDragOver(true) }}
                    onDragLeave={() => setUploadDragOver(false)}
                    onDrop={(event) => {
                      event.preventDefault()
                      setUploadDragOver(false)
                      accepterFichiersMedia(Array.from(event.dataTransfer.files ?? []))
                    }}
                  >
                    <span className="maps-dropzone-icon maps-dropzone-icon-luxe"><ImageIcon size={24} aria-hidden="true" /></span>
                    <strong>{t('visitor.carte.uploadChoisir')}</strong>
                    <small>{t('visitor.carte.uploadLimite')}</small>
                    <small className="maps-upload-formats">JPEG · PNG · WebP · GIF · MP4 · WebM · MOV — 10 Mo max / fichier, 10 fichiers max</small>
                    <span className="maps-dropzone-cta">{t('visitor.carte.uploadParcourir', 'Parcourir ou glisser-déposer ici')}</span>
                    <input
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
                      disabled={uploading}
                      onChange={(event) => { accepterFichiersMedia(Array.from(event.target.files ?? [])); event.target.value = '' }}
                    />
                  </label>
                  {uploadFiles.length > 0 && (
                    <div className="maps-upload-preview-wrap">
                      <p className="maps-upload-preview-title">{uploadFiles.length} fichier{uploadFiles.length > 1 ? 's' : ''} sélectionné{uploadFiles.length > 1 ? 's' : ''}</p>
                      <ul className="maps-upload-grid maps-upload-grid-luxe">
                        {uploadFiles.map((fichier, index) => {
                          const estVideo = fichier.type.startsWith('video/') || /\.(mp4|webm|mov)$/i.test(fichier.name)
                          const previewUrl = uploadPreviews[index] ?? ''
                          return (
                            <li key={`${fichier.name}-${fichier.size}-${index}`} className="maps-upload-card">
                              <span className="maps-upload-thumb">
                                {!estVideo && previewUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element -- aperçu local
                                  <img src={previewUrl} alt="" aria-hidden="true" />
                                ) : (
                                  <span className="maps-upload-video"><Video size={20} aria-hidden="true" /></span>
                                )}
                              </span>
                              <span className="maps-upload-meta">
                                <strong title={fichier.name}>{fichier.name}</strong>
                                <small>{(fichier.size / 1048576).toFixed(1)} {t('visitor.carte.uploadUniteMo')} · {estVideo ? 'vidéo' : 'photo'}</small>
                              </span>
                              <button type="button" className="maps-upload-remove" onClick={() => setUploadFiles((current) => current.filter((_, i) => i !== index))} aria-label={`${t('common.delete')} ${fichier.name}`}><X size={14} /></button>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <div className="maps-upload-link">
                  <label className="maps-field-label" htmlFor="maps-video-link">
                    {t('visitor.carte.uploadLienLabel', 'Collez un lien YouTube, TikTok, Instagram, Facebook, Vimeo ou Dailymotion')}
                  </label>
                  <div className="maps-upload-link-row">
                    <Link2 size={17} aria-hidden="true" />
                    <input
                      id="maps-video-link"
                      type="url"
                      inputMode="url"
                      autoComplete="off"
                      spellCheck={false}
                      value={videoLink}
                      disabled={uploading}
                      onChange={(event) => setVideoLink(event.target.value)}
                      placeholder={t('visitor.carte.uploadLienPlaceholder', 'https://www.youtube.com/watch?v=…')}
                    />
                    {videoLink && (
                      <button type="button" className="maps-upload-link-clear" onClick={() => setVideoLink('')} aria-label={t('visitor.carte.clearSearch')}>
                        <X size={15} />
                      </button>
                    )}
                  </div>
                  <div className="maps-upload-link-chips" aria-hidden="true">
                    {(['YouTube', 'TikTok', 'Instagram', 'Facebook', 'Vimeo', 'Dailymotion'] as const).map((label) => (
                      <span key={label}>{label}</span>
                    ))}
                  </div>
                  {videoLink.trim() !== '' && !parsedVideoLink && (
                    <p className="maps-upload-link-error" role="alert">
                      {t('visitor.carte.uploadLienInvalide', 'Lien non pris en charge : collez le lien complet de la vidéo (pas un lien raccourci).')}
                    </p>
                  )}
                  {parsedVideoLink && (
                    <div className="maps-upload-link-preview">
                      <p className="maps-upload-preview-title">
                        {t('visitor.carte.uploadApercuInstantane', 'Aperçu instantané')} · {EXTERNAL_VIDEO_PROVIDER_LABELS[parsedVideoLink.provider]}
                      </p>
                      <div className="maps-upload-link-frame">
                        <iframe
                          key={parsedVideoLink.embedUrl}
                          src={parsedVideoLink.embedUrl}
                          title={`${t('visitor.carte.galleryVideo')} ${EXTERNAL_VIDEO_PROVIDER_LABELS[parsedVideoLink.provider]}`}
                          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                        />
                      </div>
                      <a href={parsedVideoLink.watchUrl} target="_blank" rel="noopener noreferrer" className="maps-upload-link-watch">
                        {parsedVideoLink.watchUrl.replace(/^https?:\/\//, '')} <ExternalLink size={13} aria-hidden="true" />
                      </a>
                    </div>
                  )}
                </div>
              )}
              <footer className="maps-upload-footer">
                <button type="button" className="maps-btn-ghost" disabled={uploading} onClick={() => setUploadOpen(false)}>{t('common.cancel')}</button>
                {uploadTab === 'fichiers' ? (
                  <button type="button" className="maps-btn-primary" disabled={uploadFiles.length === 0 || uploading} onClick={() => void envoyerMedias()}>
                    {uploading ? (
                      <><Loader2 size={16} className="animate-spin" /> {t('visitor.carte.uploadEnvoi')}</>
                    ) : (
                      <><Plus size={16} /> {t('visitor.carte.uploadEnvoyer')} ({uploadFiles.length})</>
                    )}
                  </button>
                ) : (
                  <button type="button" className="maps-btn-primary" disabled={!parsedVideoLink || uploading} onClick={() => void envoyerLienVideo()}>
                    {uploading ? (
                      <><Loader2 size={16} className="animate-spin" /> {t('visitor.carte.uploadEnvoi')}</>
                    ) : (
                      <><Link2 size={16} /> {t('visitor.carte.uploadAjouterLien', 'Ajouter cette vidéo')}</>
                    )}
                  </button>
                )}
              </footer>
            </div>
          </div>
        )}</>}
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
            {reviews.map((review) => {
              const menuOuvert = menuReviewId === review.id
              const stats = statsAuteur[review.auteurNom ?? ''] ?? { avis: 1, photos: 0 }
              return (
              <article className="maps-review" key={review.id}><div className="maps-review-head"><span className="maps-avatar" style={{ backgroundColor: `hsl(${teinteAvatar(review.auteurNom)} 45% 42%)` }} aria-hidden="true">{(review.auteurNom || 'U')[0]}</span><div className="maps-review-who"><strong>{review.auteurNom || t('visitor.carte.userFallback')}</strong><small>{t('visitor.carte.reviewsCount', { count: stats.avis })} · {t('visitor.carte.reviewPhotosCount', { count: stats.photos })}</small></div><div className="maps-review-menu-wrap"><button type="button" className="maps-review-menu-btn" aria-expanded={menuOuvert} aria-label={t('visitor.carte.reviewMenuLabel')} onClick={() => setMenuReviewId(menuOuvert ? null : review.id)}><MoreVertical size={18} /></button>{menuOuvert && (<div className="maps-review-menu" role="menu"><button type="button" role="menuitem" onClick={() => { setMenuReviewId(null); void share(review.commentaire) }}><Share2 size={16} />{t('visitor.carte.actionShare')}</button><button type="button" role="menuitem" onClick={() => toggleLike(review.id)}><ThumbsUp size={16} fill={likes.includes(review.id) ? 'currentColor' : 'none'} />{likes.includes(review.id) ? t('visitor.carte.likedButton') : t('visitor.carte.likeButton')}</button><button type="button" role="menuitem" onClick={() => { setMenuReviewId(null); void signalerReview(review.id) }}><Flag size={16} />{t('visitor.carte.reviewSignaler')}</button></div>)}</div></div><div className="maps-review-note"><Rating value={review.note} /><small>{formatRelativeDate(review.createdAt, i18n.language)}</small></div><p>{review.commentaire}</p>{review.images?.length ? <div className="maps-review-images">{review.images.map(image => <a key={image.id} href={imgUrl(image.contentUrl) ?? image.contentUrl} target="_blank" rel="noopener noreferrer"><img src={imgUrl(image.contentUrl) ?? image.contentUrl} alt={t('visitor.carte.reviewPhotoAlt')} loading="lazy" /></a>)}</div> : null}</article>
              )
            })}
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
        onAdd={peutDeposerMedia ? () => { setGalleryOpen(false); setUploadOpen(true) } : undefined}
        onReport={(media) => void reportMedia(media)}
      />
    )}
    {composer && facility && <div className="maps-modal-backdrop" onClick={() => !sending && setComposer(false)}><form className="maps-dialog maps-review-dialog" role="dialog" aria-modal="true" aria-label={t('visitor.carte.writeReview')} onClick={event => event.stopPropagation()} onSubmit={event => { event.preventDefault(); void submit() }}><header className="maps-dialog-header"><div className="maps-dialog-title"><span className="maps-dialog-kicker">{t('visitor.carte.yourReview')}</span><h2>{facility.nom}</h2></div><button type="button" disabled={sending} onClick={() => setComposer(false)} aria-label={t('common.close')}><X size={20} /></button></header><div className="maps-reviewer"><span className="maps-reviewer-avatar">{String(user?.prenom ?? user?.nom ?? user?.email ?? 'U').slice(0, 1).toUpperCase()}</span><div><strong>{user?.prenom || user?.nom ? `${user?.prenom ?? ''} ${user?.nom ?? ''}`.trim() : t('visitor.carte.yourProfile')}</strong><small>{t('visitor.carte.reviewPostPublic')}</small></div></div><div className="maps-review-stars" role="group" aria-label={t('visitor.carte.noteAria')}>{[1, 2, 3, 4, 5].map(star => <button type="button" key={star} aria-label={t('visitor.medecinDetail.starAria', { count: star, value: star })} aria-pressed={note === star} onClick={() => setNote(star)}><Star size={32} fill={star <= note ? 'currentColor' : 'none'} /></button>)}</div><textarea autoFocus value={comment} minLength={5} maxLength={2000} onChange={event => setComment(event.target.value)} placeholder={t('visitor.carte.reviewPlaceholder')} aria-label={t('visitor.carte.yourReview')} /><label className={`maps-upload maps-dropzone ${dragActive ? 'is-dragging' : ''}`} onDragEnter={event => { event.preventDefault(); setDragActive(true) }} onDragOver={event => event.preventDefault()} onDragLeave={() => setDragActive(false)} onDrop={event => { event.preventDefault(); setDragActive(false); acceptReviewFiles(Array.from(event.dataTransfer.files)) }}><span className="maps-dropzone-icon"><ImageIcon size={25} /></span><strong>{dragActive ? t('visitor.carte.dropImages') : t('visitor.carte.addPhotos')}</strong><small>{t('visitor.carte.dropHint')}</small><input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={event => { acceptReviewFiles(Array.from(event.target.files ?? [])); event.target.value = '' }} /></label>{files.length > 0 && <div className="maps-upload-grid">{files.map((file, index) => <figure key={`${file.name}-${index}`}><img src={filePreviews[index]} alt={t('visitor.carte.previewAlt', { name: file.name })} /><button type="button" onClick={() => setFiles(current => current.filter((_, item) => item !== index))} aria-label={t('visitor.carte.removeFile', { name: file.name })}><X size={16} /></button></figure>)}</div>}<ul className="maps-selected-files">{files.map((file, index) => <li key={`${file.name}-${index}`}><span>{file.name}</span></li>)}</ul><footer><button type="button" disabled={sending} onClick={() => setComposer(false)}>{t('common.cancel')}</button><button type="submit" disabled={!note || sending}>{sending ? t('visitor.carte.publishing') : t('visitor.carte.publish')}</button></footer></form></div>}
    {suggestionOpen && facility && <div className="maps-modal-backdrop" onClick={() => !suggestionSending && setSuggestionOpen(false)}><form className="maps-dialog maps-suggestion-dialog" role="dialog" aria-modal="true" aria-label={t('visitor.carte.suggestTitle')} onClick={event => event.stopPropagation()} onSubmit={event => { event.preventDefault(); void submitSuggestion() }}><header><div><h2>{t('visitor.carte.suggestTitle')}</h2><p className="maps-dialog-subtitle">{facility.nom}</p></div><button type="button" disabled={suggestionSending} onClick={() => setSuggestionOpen(false)} aria-label={t('common.close')}><X size={22} /></button></header><label className="maps-field-label">{t('visitor.carte.suggestFieldLabel')}<select value={suggestionField} onChange={event => setSuggestionField(event.target.value)}><option value="adresse">{t('visitor.carte.suggestFieldAdresse')}</option><option value="ville">{t('visitor.carte.suggestFieldVille')}</option><option value="region">{t('visitor.carte.suggestFieldRegion')}</option><option value="telephone">{t('visitor.carte.suggestFieldTelephone')}</option><option value="horaires">{t('visitor.carte.suggestFieldHoraires')}</option><option value="services">{t('visitor.carte.suggestFieldServices')}</option><option value="description">{t('visitor.carte.suggestFieldDescription')}</option><option value="siteWeb">{t('visitor.carte.suggestFieldSiteWeb')}</option><option value="autre">{t('visitor.carte.suggestFieldAutre')}</option></select></label><label className="maps-field-label">{t('visitor.carte.suggestValueLabel')}<textarea required minLength={2} maxLength={2000} value={suggestionValue} onChange={event => setSuggestionValue(event.target.value)} placeholder={t('visitor.carte.suggestValuePlaceholder')} /></label><label className="maps-field-label">{t('visitor.carte.suggestCommentLabel')}<textarea maxLength={1200} value={suggestionComment} onChange={event => setSuggestionComment(event.target.value)} placeholder={t('visitor.carte.suggestCommentPlaceholder')} /></label><p className="maps-suggestion-note">{t('visitor.carte.suggestNote')}</p><footer><button type="button" disabled={suggestionSending} onClick={() => setSuggestionOpen(false)}>{t('common.cancel')}</button><button type="submit" disabled={suggestionSending || suggestionValue.trim().length < 2}>{suggestionSending ? t('visitor.carte.sending') : t('visitor.carte.sendSuggestion')}</button></footer></form></div>}
    {collectionOpen && facility && <div className="maps-modal-backdrop"><section className="maps-dialog" role="dialog" aria-modal="true" aria-label={t('visitor.carte.collectionsAria')}><header><h2>{t('visitor.carte.saveToCollection')}</h2><button type="button" onClick={() => setCollectionOpen(false)} aria-label={t('common.close')}><X size={20} /></button></header>{collections.map(collection => <div className="maps-collection" key={collection.id}><label><input type="checkbox" checked={collection.places.includes(facility.id)} onChange={event => saveCollections(collections.map(item => item.id !== collection.id ? item : { ...item, places: event.target.checked ? [...item.places, facility.id] : item.places.filter(id => id !== facility.id) }))} />{collection.name}</label><input value={collection.note} placeholder={t('visitor.carte.privateNote')} aria-label={t('visitor.carte.noteFor', { name: collection.name })} maxLength={600} onChange={event => saveCollections(collections.map(item => item.id !== collection.id ? item : { ...item, note: event.target.value }))} /><button type="button" onClick={() => saveCollections(collections.filter(item => item.id !== collection.id))}>{t('common.delete')}</button></div>)}<form onSubmit={event => { event.preventDefault(); if (!collectionName.trim()) return; saveCollections([...collections, { id: crypto.randomUUID(), name: collectionName.trim(), places: [facility.id], note: '' }]); setCollectionName('') }}><input required maxLength={80} value={collectionName} onChange={event => setCollectionName(event.target.value)} placeholder={t('visitor.carte.collectionNamePlaceholder')} aria-label={t('visitor.carte.collectionNamePlaceholder')} /><button type="submit">{t('visitor.carte.create')}</button></form></section></div>}
  </>
}
