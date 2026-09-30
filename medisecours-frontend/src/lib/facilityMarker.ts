import type { CarteCentre } from './carte'

export function escapeMarkerHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char]!)
}

export function facilityMarkerHtml(color: string, selected: boolean, name: string) {
  const safeColor = /^#[0-9a-f]{6}$/i.test(color) ? color : '#1a73e8'
  const safeName = escapeMarkerHtml(name)
  return `<div class="maps-marker-label${selected ? ' is-selected' : ''}" style="--marker-color:${safeColor};">
    <span class="maps-marker-pin" aria-hidden="true">+</span>
    <span class="maps-marker-name">${safeName}</span>
  </div>`
}

function mediaKind(item: NonNullable<CarteCentre['images']>[number]): 'image' | 'video' {
  return item.kind === 'video' || item.mimeType?.startsWith('video/') ? 'video' : 'image'
}

function markerMedia(centre: CarteCentre): NonNullable<CarteCentre['images']> {
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
  const match = value.match(/(\d{1,2})(?:h|:)?(\d{2})?/)
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2] ?? 0)
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 ? hour * 60 + minute : null
}

function availabilityState(centre: CarteCentre): { open: boolean | null; closing?: string } {
  const details = centre.horairesDetails
  const now = new Date()
  const dayKeys = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
  const day = details?.weekly?.[dayKeys[now.getDay()]]
  if (day) {
    if (day.closed) return { open: false }
    const current = now.getHours() * 60 + now.getMinutes()
    const opening = toMinutes(day.open)
    const closing = toMinutes(day.close)
    if (opening != null && closing != null) {
      return { open: current >= opening && current <= closing, closing: day.close ?? undefined }
    }
  }
  const match = centre.horaires?.match(/(\d{1,2}(?:h|:)\d{0,2})\s*[-–]\s*(\d{1,2}(?:h|:)\d{0,2})/i)
  if (match) {
    const opening = toMinutes(match[1])
    const closing = toMinutes(match[2])
    const current = now.getHours() * 60 + now.getMinutes()
    if (opening != null && closing != null) return { open: current >= opening && current <= closing, closing: match[2] }
  }
  return centre.urgences24h ? { open: true } : { open: null }
}

export function facilityMarkerPopupHtml(centre: CarteCentre, labels?: {
  viewDetails?: string
  open?: string
  closed?: string
  accessibility?: string
  ambulances?: string
  gallery?: string
  holiday?: string
}): string {
  const text = {
    viewDetails: labels?.viewDetails ?? 'Voir la fiche',
    open: labels?.open ?? 'Ouvert',
    closed: labels?.closed ?? 'Ferme',
    accessibility: labels?.accessibility ?? 'Accessible',
    ambulances: labels?.ambulances ?? 'Ambulances disponibles',
    gallery: labels?.gallery ?? 'Galerie',
    holiday: labels?.holiday ?? 'Fermetures exceptionnelles',
  }
  const gallery = markerMedia(centre).slice(0, 5)
  const mediaHtml = gallery.length > 0
    ? `<div class="maps-marker-gallery" data-gallery-count="${gallery.length}">
        ${gallery.map((item, index) => {
          const source = escapeMarkerHtml(item.contentUrl)
          return mediaKind(item) === 'video'
            ? `<video class="maps-marker-gallery-media" src="${source}" muted preload="metadata" aria-label="${escapeMarkerHtml(centre.nom)} ${index + 1}"></video>`
            : `<img class="maps-marker-gallery-media" src="${source}" alt="${escapeMarkerHtml(centre.nom)} ${index + 1}" loading="lazy" />`
        }).join('')}
        ${gallery.length > 1 ? `<button class="maps-marker-gallery-prev" type="button" aria-label="Previous ${text.gallery}">&#8249;</button><button class="maps-marker-gallery-next" type="button" aria-label="Next ${text.gallery}">&#8250;</button>` : ''}
      </div>`
    : ''
  const access = Array.isArray(centre.accessibilite)
    ? centre.accessibilite.join(', ')
    : centre.accessibilite
  const hours = centre.horaires?.trim() || ''
  const availability = availabilityState(centre)
  const details = centre.horairesDetails
  const exceptionText = [...(details?.holidays ?? []), ...(details?.exceptions ?? [])].filter(Boolean).slice(0, 2)
  return `<article class="maps-marker-popup">
    ${mediaHtml}
    <div class="maps-marker-popup-body">
      <h3>${escapeMarkerHtml(centre.nom)}</h3>
      <p class="maps-marker-popup-type">${escapeMarkerHtml(String(centre.type).replaceAll('_', ' '))}</p>
      <p class="maps-marker-popup-address">${escapeMarkerHtml(centre.adresse || '')}${centre.ville ? ` · ${escapeMarkerHtml(centre.ville)}` : ''}</p>
      <div class="maps-marker-status-row">
        ${hours ? `<span class="maps-marker-hours ${availability.open === true ? 'is-open' : availability.open === false ? 'is-closed' : ''}"><i></i>${availability.open === true ? text.open : availability.open === false ? text.closed : ''}${availability.closing && availability.open === false ? ` ${escapeMarkerHtml(availability.closing)}` : ''}${availability.open !== null ? ': ' : ''}${escapeMarkerHtml(hours)}</span>` : ''}
        ${centre.urgences24h ? `<span class="maps-marker-badge maps-marker-badge-emergency">24h</span>` : ''}
      </div>
      ${exceptionText.length ? `<p class="maps-marker-exception"><strong>${text.holiday}:</strong> ${escapeMarkerHtml(exceptionText.join(' · '))}</p>` : ''}
      <div class="maps-marker-capabilities">
        ${access ? `<span title="${escapeMarkerHtml(text.accessibility)}">♿ ${escapeMarkerHtml(access)}</span>` : ''}
        ${centre.ambulancesDisponibles ? `<span class="is-ambulance" title="${escapeMarkerHtml(text.ambulances)}">🚑 ${escapeMarkerHtml(text.ambulances)}</span>` : ''}
      </div>
      <button class="maps-marker-details" type="button" data-centre-id="${centre.id}">${escapeMarkerHtml(text.viewDetails)}</button>
    </div>
  </article>`
}

export function bindFacilityPopupInteractions(
  root: HTMLElement,
  centreId: number,
  onSelect?: (id: number) => void,
): () => void {
  const details = root.querySelector<HTMLElement>('[data-centre-id]')
  const media = Array.from(root.querySelectorAll<HTMLElement>('.maps-marker-gallery-media'))
  let activeIndex = 0
  const showMedia = (index: number) => {
    if (media.length === 0) return
    activeIndex = (index + media.length) % media.length
    media.forEach((item, itemIndex) => { item.style.display = itemIndex === activeIndex ? 'block' : 'none' })
  }
  const previous = root.querySelector<HTMLButtonElement>('.maps-marker-gallery-prev')
  const next = root.querySelector<HTMLButtonElement>('.maps-marker-gallery-next')
  const handlePrevious = () => showMedia(activeIndex - 1)
  const handleNext = () => showMedia(activeIndex + 1)
  const handleDetails = () => onSelect?.(centreId)
  previous?.addEventListener('click', handlePrevious)
  next?.addEventListener('click', handleNext)
  details?.addEventListener('click', handleDetails)
  showMedia(0)
  return () => {
    previous?.removeEventListener('click', handlePrevious)
    next?.removeEventListener('click', handleNext)
    details?.removeEventListener('click', handleDetails)
  }
}
