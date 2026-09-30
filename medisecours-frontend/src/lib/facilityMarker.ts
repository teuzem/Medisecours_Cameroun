import type { CarteCentre, EtablissementMedia } from './carte'

type MarkerLabels = {
  directions?: string
  save?: string
  saved?: string
  isSaved?: boolean
  open?: string
  closed?: string
  unknown?: string
  closesAt?: string
  accessibility?: string
  ambulances?: string
  gallery?: string
  galleryPrevious?: string
  galleryNext?: string
  holiday?: string
  emergency?: string
}

type PopupInteractionOptions = {
  onSelect?: (id: number) => void
  onDirections?: (id: number) => void
  onToggleFavorite?: (id: number) => void
  isSaved?: boolean
  onEnter?: () => void
  onLeave?: () => void
}

export function escapeMarkerHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char]!)
}

function iconSvg(kind: 'pin' | 'accessibility' | 'ambulance' | 'image' | 'clock' | 'navigation' | 'bookmark'): string {
  const paths: Record<typeof kind, string> = {
    pin: '<path d="M12 21s7-5.4 7-11A7 7 0 0 0 5 10c0 5.6 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/>',
    accessibility: '<circle cx="12" cy="4" r="1.8"/><path d="M5 8.5h14M12 7v5m0 0-4 8m4-8 4 8M8 12l-3 4m11-4 3 4"/>',
    ambulance: '<path d="M3 16V8.5h10.5L17 12h3v4"/><path d="M6 16a2 2 0 1 0 4 0m6 0a2 2 0 1 0 4 0M13.5 8.5V12H17M15.5 10.25h-4"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8" cy="9" r="1.5"/><path d="m4 17 5-5 3 3 2-2 6 6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    navigation: '<path d="m4 4 16 7-7 2-2 7-7-16Z"/>',
    bookmark: '<path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-4-6 4V4.5Z"/>',
  }
  return `<svg class="maps-marker-icon maps-marker-icon-${kind}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths[kind]}</svg>`
}

export function facilityMarkerHtml(color: string, selected: boolean, name: string) {
  const safeColor = /^#[0-9a-f]{6}$/i.test(color) ? color : '#1a73e8'
  const safeName = escapeMarkerHtml(name)
  return `<div class="maps-marker-label${selected ? ' is-selected' : ''}" style="--marker-color:${safeColor};" tabindex="0">
    <span class="maps-marker-pin" aria-hidden="true">${iconSvg('pin')}</span>
    <span class="maps-marker-name">${safeName}</span>
  </div>`
}

function mediaKind(item: EtablissementMedia): 'image' | 'video' {
  return item.kind === 'video' || item.mimeType?.startsWith('video/') ? 'video' : 'image'
}

function markerMedia(centre: CarteCentre): EtablissementMedia[] {
  const media = (centre.images ?? []).filter((item) => item.contentUrl)
  const cover = centre.imageUrl?.trim()
  if (!cover) return media
  const normalized = cover.replace(/\/+$/, '').toLowerCase()
  return [...media].sort((left, right) => {
    const leftKey = left.contentUrl.replace(/\/+$/, '').toLowerCase()
    const rightKey = right.contentUrl.replace(/\/+$/, '').toLowerCase()
    if (leftKey === normalized) return -1
    if (rightKey === normalized) return 1
    return 0
  })
}

function toMinutes(value?: string | null): number | null {
  if (!value) return null
  const match = value.trim().match(/^(\d{1,2})(?:h|:)?(\d{2})?$/i)
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2] ?? 0)
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 ? hour * 60 + minute : null
}

function isWithinSchedule(current: number, opening: number, closing: number): boolean {
  if (opening === closing) return true
  if (closing > opening) return current >= opening && current <= closing
  return current >= opening || current <= closing
}

function availabilityState(centre: CarteCentre): {
  open: boolean | null
  opening?: string
  closing?: string
} {
  const details = centre.horairesDetails
  const now = new Date()
  const dayKeys = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
  const day = details?.weekly?.[dayKeys[now.getDay()]]
  if (day) {
    if (day.closed) return { open: false }
    const opening = toMinutes(day.open)
    const closing = toMinutes(day.close)
    if (opening != null && closing != null) {
      return {
        open: isWithinSchedule(now.getHours() * 60 + now.getMinutes(), opening, closing),
        opening: day.open ?? undefined,
        closing: day.close ?? undefined,
      }
    }
  }

  const match = centre.horaires?.match(/(\d{1,2}(?:h|:)\d{0,2})\s*[-–]\s*(\d{1,2}(?:h|:)\d{0,2})/i)
  if (match) {
    const opening = toMinutes(match[1])
    const closing = toMinutes(match[2])
    if (opening != null && closing != null) {
      return {
        open: isWithinSchedule(now.getHours() * 60 + now.getMinutes(), opening, closing),
        opening: match[1],
        closing: match[2],
      }
    }
  }

  return centre.urgences24h ? { open: true } : { open: null }
}

export function facilityMarkerPopupHtml(centre: CarteCentre, labels?: MarkerLabels): string {
  const text = {
    directions: labels?.directions ?? 'Itinéraire',
    save: labels?.save ?? 'Enregistrer',
    saved: labels?.saved ?? 'Enregistré',
    open: labels?.open ?? 'Ouvert',
    closed: labels?.closed ?? 'Fermé',
    unknown: labels?.unknown ?? 'Horaires inconnus',
    closesAt: labels?.closesAt ?? 'Ferme à',
    accessibility: labels?.accessibility ?? 'Accessibilité',
    ambulances: labels?.ambulances ?? 'Ambulances disponibles',
    gallery: labels?.gallery ?? 'Galerie',
    galleryPrevious: labels?.galleryPrevious ?? 'Média précédent',
    galleryNext: labels?.galleryNext ?? 'Média suivant',
    holiday: labels?.holiday ?? 'Fermetures exceptionnelles',
    emergency: labels?.emergency ?? 'Urgences 24 h',
  }

  const gallery = markerMedia(centre).slice(0, 5)
  const mediaHtml = gallery.length > 0
    ? `<div class="maps-marker-gallery" data-gallery-count="${gallery.length}" aria-label="${escapeMarkerHtml(text.gallery)}">
        ${gallery.map((item, index) => {
          const source = escapeMarkerHtml(item.contentUrl)
          const mediaLabel = `${escapeMarkerHtml(centre.nom)} ${index + 1}`
          return mediaKind(item) === 'video'
            ? `<video class="maps-marker-gallery-media" data-gallery-index="${index}" src="${source}" muted preload="metadata" playsinline aria-label="${mediaLabel}"></video>`
            : `<img class="maps-marker-gallery-media" data-gallery-index="${index}" src="${source}" alt="${mediaLabel}" loading="lazy" />`
        }).join('')}
        ${gallery.length > 1
          ? `<button class="maps-marker-gallery-prev" type="button" aria-label="${escapeMarkerHtml(text.galleryPrevious)}">&lsaquo;</button>
             <span class="maps-marker-gallery-count" aria-live="polite">1 / ${gallery.length}</span>
             <button class="maps-marker-gallery-next" type="button" aria-label="${escapeMarkerHtml(text.galleryNext)}">&rsaquo;</button>`
          : ''}
      </div>`
    : ''

  const access = Array.isArray(centre.accessibilite)
    ? centre.accessibilite.join(', ')
    : centre.accessibilite
  const availability = availabilityState(centre)
  const details = centre.horairesDetails
  const exceptionText = [...(details?.holidays ?? []), ...(details?.exceptions ?? [])].filter(Boolean).slice(0, 2)
  const statusText = availability.open === true
    ? `${text.open}${availability.closing ? ` · ${text.closesAt} ${availability.closing}` : ''}`
    : availability.open === false
      ? `${text.closed}${availability.closing ? ` · ${text.closesAt} ${availability.closing}` : ''}`
      : text.unknown
  const statusClass = availability.open === true ? 'is-open' : availability.open === false ? 'is-closed' : 'is-unknown'
  const typeLabel = String(centre.type).replaceAll('_', ' ')

  const isSaved = Boolean(labels?.isSaved)
  return `<article class="maps-marker-popup" data-centre-id="${centre.id}" role="button" tabindex="0" aria-label="${escapeMarkerHtml(centre.nom)}">
    ${mediaHtml}
    <div class="maps-marker-popup-body">
      <h3>${escapeMarkerHtml(centre.nom)}</h3>
      <p class="maps-marker-popup-type">${escapeMarkerHtml(typeLabel)}</p>
      <p class="maps-marker-popup-address">${escapeMarkerHtml(centre.adresse || '')}${centre.ville ? ` &middot; ${escapeMarkerHtml(centre.ville)}` : ''}</p>
      <div class="maps-marker-status-row">
        <span class="maps-marker-hours ${statusClass}"><i></i>${escapeMarkerHtml(statusText)}</span>
        ${centre.urgences24h ? `<span class="maps-marker-badge maps-marker-badge-emergency">${escapeMarkerHtml(text.emergency)}</span>` : ''}
      </div>
      ${exceptionText.length ? `<p class="maps-marker-exception"><strong>${escapeMarkerHtml(text.holiday)}:</strong> ${escapeMarkerHtml(exceptionText.join(' · '))}</p>` : ''}
      <div class="maps-marker-capabilities">
        ${access ? `<span class="maps-marker-capability maps-marker-capability-access" title="${escapeMarkerHtml(text.accessibility)}">${iconSvg('accessibility')}<span>${escapeMarkerHtml(access)}</span></span>` : ''}
        ${centre.ambulancesDisponibles ? `<span class="maps-marker-capability maps-marker-capability-ambulance" title="${escapeMarkerHtml(text.ambulances)}">${iconSvg('ambulance')}<span>${escapeMarkerHtml(text.ambulances)}</span></span>` : ''}
      </div>
      <div class="maps-marker-actions" role="group" aria-label="${escapeMarkerHtml(text.directions)}">
        <button class="maps-marker-action maps-marker-action-directions" type="button" data-marker-action="directions" data-centre-id="${centre.id}">${iconSvg('navigation')}<span>${escapeMarkerHtml(text.directions)}</span></button>
        <button class="maps-marker-action maps-marker-action-save${isSaved ? ' is-saved' : ''}" type="button" data-marker-action="save" data-centre-id="${centre.id}" data-label-save="${escapeMarkerHtml(text.save)}" data-label-saved="${escapeMarkerHtml(text.saved)}" aria-pressed="${isSaved ? 'true' : 'false'}">${iconSvg('bookmark')}<span>${escapeMarkerHtml(isSaved ? text.saved : text.save)}</span></button>
      </div>
    </div>
  </article>`
}

export function bindFacilityPopupInteractions(
  root: HTMLElement,
  centreId: number,
  options: PopupInteractionOptions | ((id: number) => void) = {},
): () => void {
  const normalized: PopupInteractionOptions = typeof options === 'function' ? { onSelect: options } : options
  const directions = root.querySelector<HTMLButtonElement>('[data-marker-action="directions"]')
  const save = root.querySelector<HTMLButtonElement>('[data-marker-action="save"]')
  const media = Array.from(root.querySelectorAll<HTMLElement>('.maps-marker-gallery-media'))
  const count = root.querySelector<HTMLElement>('.maps-marker-gallery-count')
  const previous = root.querySelector<HTMLButtonElement>('.maps-marker-gallery-prev')
  const next = root.querySelector<HTMLButtonElement>('.maps-marker-gallery-next')
  let activeIndex = 0

  const showMedia = (index: number) => {
    if (media.length === 0) return
    activeIndex = (index + media.length) % media.length
    media.forEach((item, itemIndex) => {
      item.style.display = itemIndex === activeIndex ? 'block' : 'none'
      if (itemIndex !== activeIndex && item instanceof HTMLVideoElement) {
        item.pause()
        item.currentTime = 0
      }
    })
    if (count) count.textContent = `${activeIndex + 1} / ${media.length}`
  }
  const handlePrevious = () => showMedia(activeIndex - 1)
  const handleNext = () => showMedia(activeIndex + 1)
  const handleDetails = () => normalized.onSelect?.(centreId)
  const handleDirections = (event: Event) => {
    event.stopPropagation()
    normalized.onDirections?.(centreId)
  }
  const handleSave = (event: Event) => {
    event.stopPropagation()
    normalized.onToggleFavorite?.(centreId)
    if (save) {
      const next = save.getAttribute('aria-pressed') !== 'true'
      save.setAttribute('aria-pressed', String(next))
      save.classList.toggle('is-saved', next)
      const label = save.querySelector('span')
      if (label) label.textContent = next ? save.dataset.labelSaved ?? '' : save.dataset.labelSave ?? ''
    }
  }
  const handleRootClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement | null
    if (target?.closest('button, a, video')) return
    handleDetails()
  }
  const handleRootKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleDetails()
    }
  }
  const handleEnter = () => normalized.onEnter?.()
  const handleLeave = () => normalized.onLeave?.()

  previous?.addEventListener('click', handlePrevious)
  next?.addEventListener('click', handleNext)
  directions?.addEventListener('click', handleDirections)
  save?.addEventListener('click', handleSave)
  root.addEventListener('click', handleRootClick)
  root.addEventListener('keydown', handleRootKeyDown)
  root.addEventListener('mouseenter', handleEnter)
  root.addEventListener('mouseleave', handleLeave)
  showMedia(0)

  return () => {
    previous?.removeEventListener('click', handlePrevious)
    next?.removeEventListener('click', handleNext)
    directions?.removeEventListener('click', handleDirections)
    save?.removeEventListener('click', handleSave)
    root.removeEventListener('click', handleRootClick)
    root.removeEventListener('keydown', handleRootKeyDown)
    root.removeEventListener('mouseenter', handleEnter)
    root.removeEventListener('mouseleave', handleLeave)
    media.forEach((item) => {
      if (item instanceof HTMLVideoElement) {
        item.pause()
        item.currentTime = 0
      }
    })
  }
}
