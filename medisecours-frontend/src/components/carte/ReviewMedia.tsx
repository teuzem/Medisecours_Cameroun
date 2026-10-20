'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, Clapperboard, Play, X } from 'lucide-react'

import { imgUrl } from '../../lib/config'
import { usePhotoSrc } from '../../hooks/usePhotoSrc'
import type { EtablissementMedia } from '../../lib/carte'
import { getMediaEmbedUrl, getMediaProviderLabel, getMediaThumbnailUrl, isExternalVideoMedia } from '../../lib/externalVideo'

export function isVideoMedia(media: Pick<EtablissementMedia, 'kind' | 'mimeType' | 'provider' | 'externalUrl' | 'embedUrl'>): boolean {
  return media.kind === 'video' || Boolean(media.mimeType?.startsWith('video/')) || isExternalVideoMedia(media)
}

function mediaSrc(media: EtablissementMedia): string {
  return imgUrl(media.contentUrl) || media.contentUrl
}

/** Avatar de l'auteur : photo réelle si elle existe et se charge, initiales sinon. */
export function ReviewAvatar({ nom, photo }: { nom?: string | null; photo?: string | null }) {
  // `onError` fait passer au candidat suivant (proxy puis API directe) ; les
  // initiales n'apparaissent qu'une fois tous les candidats épuisés.
  const { src, onError } = usePhotoSrc(photo)
  const initial = (nom || 'U').trim().charAt(0).toUpperCase() || 'U'

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- avatar distant (Google) ou téléversé
      <img className="maps-avatar maps-avatar-photo" src={src} alt="" loading="lazy" onError={onError} />
    )
  }

  return (
    <span className="maps-avatar" style={{ backgroundColor: `hsl(${teinteAvatar(nom)} 55% 45%)` }} aria-hidden="true">
      {initial}
    </span>
  )
}

function teinteAvatar(nom?: string | null): number {
  const base = nom ?? 'U'
  let hash = 0
  for (let i = 0; i < base.length; i++) hash = (hash * 31 + base.charCodeAt(i)) % 360
  return hash
}

/**
 * Photos d'un avis.
 *
 * - une seule photo : pleine largeur, proportions réelles (le navigateur
 *   applique la taille naturelle, `height: auto`) ;
 * - plusieurs : galerie en mosaïque (2 colonnes, la première grande quand
 *   il y en a 3) avec une vignette « +N » qui ouvre la visionneuse ;
 * - la visionneuse affiche les dimensions réelles et se pilote au clavier.
 */
export function ReviewImages({ photos }: { photos: EtablissementMedia[] }) {
  const { t } = useTranslation()
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [ratios, setRatios] = useState<Record<number, string>>({})

  const registerRatio = useCallback((id: number, natural: { width: number; height: number }) => {
    if (!natural.width || !natural.height) return
    setRatios((current) => (current[id] ? current : { ...current, [id]: `${natural.width} / ${natural.height}` }))
  }, [])

  const close = useCallback(() => setOpenIndex(null), [])
  const step = useCallback((delta: number) => {
    setOpenIndex((current) => (current === null ? current : (current + delta + photos.length) % photos.length))
  }, [photos.length])

  useEffect(() => {
    if (openIndex === null) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
      if (event.key === 'ArrowLeft') step(-1)
      if (event.key === 'ArrowRight') step(1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [close, openIndex, step])

  if (photos.length === 0) return null

  const visible = photos.slice(0, 4)
  const remaining = photos.length - visible.length

  return (
    <>
      <div className={`maps-review-gallery${photos.length === 1 ? ' is-single' : ''}${photos.length === 3 ? ' is-triplet' : ''}`}>
        {visible.map((photo, index) => (
          <button
            type="button"
            key={photo.id}
            className="maps-review-gallery-cell"
            style={ratios[photo.id] ? { aspectRatio: ratios[photo.id] } : undefined}
            onClick={() => setOpenIndex(index)}
            aria-label={t('visitor.carte.reviewPhotoAlt')}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- photo téléversée, proportions réelles */}
            <img
              src={mediaSrc(photo)}
              alt={t('visitor.carte.reviewPhotoAlt')}
              loading="lazy"
              onLoad={(event) => registerRatio(photo.id, { width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
            />
            {index === visible.length - 1 && remaining > 0 && (
              <span className="maps-review-gallery-more" aria-hidden="true">+{remaining}</span>
            )}
          </button>
        ))}
      </div>

      {openIndex !== null && (
        <div className="maps-review-lightbox" role="dialog" aria-modal="true" aria-label={t('visitor.carte.reviewPhotoAlt')}>
          <button type="button" className="maps-review-lightbox-close" onClick={close} aria-label={t('visitor.carte.ariaCloseResults')}>
            <X size={22} />
          </button>
          {photos.length > 1 && (
            <>
              <button type="button" className="maps-review-lightbox-nav is-prev" onClick={() => step(-1)} aria-label={t('visitor.carte.galleryPrevious')}>
                <ChevronLeft size={24} />
              </button>
              <button type="button" className="maps-review-lightbox-nav is-next" onClick={() => step(1)} aria-label={t('visitor.carte.galleryNext')}>
                <ChevronRight size={24} />
              </button>
            </>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element -- image téléversée, dimensions réelles */}
          <img src={mediaSrc(photos[openIndex])} alt={t('visitor.carte.reviewPhotoAlt')} className="maps-review-lightbox-image" />
          {photos.length > 1 && (
            <p className="maps-review-lightbox-count">{openIndex + 1} / {photos.length}</p>
          )}
        </div>
      )}
    </>
  )
}

/**
 * Vidéo d'un avis (une seule par avis, conformément aux règles de
 * publication) : pleine largeur, ratio calculé sur les dimensions réelles
 * du fichier, et hauteur bridée pour les vidéos portrait afin qu'elles
 * restent lisibles sans bandes noires.
 */
export function ReviewVideo({ media }: { media: EtablissementMedia }) {
  const { t } = useTranslation()
  const [started, setStarted] = useState(false)
  const [ratio, setRatio] = useState<string | null>(null)

  const external = isExternalVideoMedia(media)
  const embed = external ? getMediaEmbedUrl(media) : null
  const thumb = getMediaThumbnailUrl(media)
  const providerLabel = getMediaProviderLabel(media)
  const src = mediaSrc(media)

  if (external && embed && started) {
    return (
      <div className="maps-review-video">
        <iframe
          src={embed}
          title={`${t('visitor.carte.galleryVideo')} ${providerLabel ?? ''}`}
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    )
  }

  if (external) {
    return (
      <div className="maps-review-video">
        <button
          type="button"
          className="maps-review-video-thumb"
          aria-label={t('visitor.carte.videoLire')}
          onClick={() => (embed ? setStarted(true) : window.open(media.externalUrl ?? src, '_blank', 'noopener,noreferrer'))}
        >
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element -- vignette distante du fournisseur
            <img src={thumb} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.display = 'none' }} />
          ) : (
            <span className="maps-review-video-fallback" aria-hidden="true">
              <Clapperboard size={26} />
              <strong>{providerLabel ?? t('visitor.carte.galleryVideo')}</strong>
            </span>
          )}
          <span className="maps-media-play maps-play-luxe"><Play size={20} fill="currentColor" /></span>
          {providerLabel && <span className="maps-media-tile-provider-badge">{providerLabel}</span>}
        </button>
      </div>
    )
  }

  return (
    <div className={`maps-review-video${ratio && isPortrait(ratio) ? ' is-portrait' : ''}`}>
      <video
        src={src}
        controls
        preload="metadata"
        playsInline
        style={ratio ? { aspectRatio: ratio } : undefined}
        onLoadedMetadata={(event) => {
          const element = event.currentTarget
          if (element.videoWidth && element.videoHeight) {
            setRatio(`${element.videoWidth} / ${element.videoHeight}`)
          }
        }}
      />
    </div>
  )
}

function isPortrait(ratio: string): boolean {
  const [width, height] = ratio.split('/').map((part) => Number(part.trim()))
  return Number.isFinite(width) && Number.isFinite(height) && height > width
}