import type { Position, WayfindingMode } from '../hooks/useWayfinding'

// ─── Types exposés par le backend (module Carte Santé) ──────────────────────

export type EtablissementType =
  | 'hopital_general'
  | 'hopital_de_district'
  | 'chu'
  | 'cma'
  | 'csi'
  | 'clinique_privee'
  | 'pharmacie'
  | 'laboratoire'
  | 'centre_specialise'

export interface CarteCentre {
  id: number
  nom: string
  type: EtablissementType
  adresse: string
  ville?: string
  region?: string
  quartier?: string
  telephone?: string
  horaires?: string
  email?: string
  siteWeb?: string
  description?: string
  latitude?: number
  longitude?: number
  imageUrl?: string
  photo?: string
  photos?: string[] | string
  images?: EtablissementMedia[]
  specialites?: string[] | string
  services?: string[] | string
  equipements?: string[] | string
  accessibilite?: string[] | string
  accesRoute?: string | null
  parking?: string | null
  langues?: string[] | string
  paiement?: string[] | string
  assurance?: string[] | string
  teleconsultation?: boolean
  priseRendezVous?: boolean
  urgence?: string | null
  urgences24h?: boolean
  distance?: number | null
  noteMoyenne?: number
  totalAvis?: number
  verificationStatut?: string
}

export interface MedecinFiche {
  id: number
  medecinId: string
  nom: string
  prenom: string
  specialite?: string
  fonction?: string
  salle?: string
  planning?: PlanningJour[]
  teleconsultation?: boolean
  disponibilites?: string[] | string
}

export interface PlanningJour {
  jour: string
  debut?: string
  fin?: string
}

export interface FicheCentre extends CarteCentre {
  medecins?: MedecinFiche[]
}

export interface EtablissementMedia {
  id: number
  contentUrl: string
  originalName?: string | null
  mimeType?: string | null
  size?: number | null
  kind?: 'image' | 'video'
  createdAt?: string
}

export interface Avis {
  id: number
  note: number
  commentaire?: string
  statut: string
  signale: boolean
  createdAt: string
  auteurNom?: string | null
  images?: EtablissementMedia[]
}

export interface SosProche {
  id: number
  nom: string
  distance?: number
  telephone?: string
  type?: EtablissementType
  ville?: string
  adresse?: string
  urgences24h?: boolean
}

export interface SosResult {
  id: number
  statut: string
  proches?: SosProche[]
  createdAt: string
}

// ─── Couleurs & libellés par type d'établissement ───────────────────────────

export const FACILITY_COLORS: Record<EtablissementType, string> = {
  hopital_general: '#D32F2F',
  hopital_de_district: '#E57373',
  chu: '#B71C1C',
  cma: '#FB8C00',
  csi: '#F57C00',
  clinique_privee: '#1E88E5',
  laboratoire: '#6D4C41',
  pharmacie: '#43A047',
  centre_specialise: '#8E24AA',
}

/** i18n keys — chaque type possède une clé `visitor.carte.type.<type>` */
export const FACILITY_TYPES: EtablissementType[] = [
  'hopital_general',
  'hopital_de_district',
  'chu',
  'cma',
  'csi',
  'clinique_privee',
  'pharmacie',
  'laboratoire',
  'centre_specialise',
]

// ─── Helpers géographiques ───────────────────────────────────────────────────

export function haversineKm(
  from: Position,
  to: { lat?: number; lng?: number; latitude?: number; longitude?: number },
): number | null {
  const lat = to.lat ?? to.latitude
  const lng = to.lng ?? to.longitude
  if (lat == null || lng == null) return null
  const earthRadius = 6371
  const dLat = ((lat - from.lat) * Math.PI) / 180
  const dLng = ((lng - from.lng) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((from.lat * Math.PI) / 180) *
      Math.cos((lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function formatDistanceKm(km: number | null | undefined): string {
  if (km == null) return '–'
  if (km < 1) return `${Math.round(km * 1000)} m`
  return `${km.toFixed(1)} km`
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return '–'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.round((seconds % 3600) / 60)
  if (hours > 0) return `${hours} h ${minutes} min`
  if (minutes < 1) return '< 1 min'
  return `${minutes} min`
}

export function formatRelativeDate(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleDateString(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

// ─── Photo ───────────────────────────────────────────────────────────────────

export function getEtablissementPhoto(centre: CarteCentre): string | null {
  const image = centre.images?.find((media) => media.kind !== 'video' && media.contentUrl)
  if (image?.contentUrl) return image.contentUrl
  if (centre.photo) return centre.photo
  if (centre.imageUrl) return centre.imageUrl
  if (Array.isArray(centre.photos)) return centre.photos[0] || null
  if (typeof centre.photos === 'string') {
    const first = centre.photos.split(',')[0]?.trim()
    return first || null
  }
  return null
}

export function getServicesList(centre: CarteCentre): string[] {
  if (!centre.services) return []
  if (Array.isArray(centre.services)) return centre.services.map(String).filter(Boolean)
  return String(centre.services).split(',').map((s) => s.trim()).filter(Boolean)
}

export function getSpecialitesList(centre: CarteCentre): string[] {
  if (!centre.specialites) return []
  if (Array.isArray(centre.specialites)) return centre.specialites.map(String).filter(Boolean)
  return String(centre.specialites).split(',').map((s) => s.trim()).filter(Boolean)
}

export function toGoogleMapsUrl(centre: CarteCentre): string {
  if (centre.latitude != null && centre.longitude != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${centre.latitude},${centre.longitude}`
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(centre.nom + ' ' + (centre.adresse || ''))}`
}

export function toWazeUrl(centre: CarteCentre): string {
  if (centre.latitude != null && centre.longitude != null) {
    return `https://waze.com/ul?ll=${centre.latitude},${centre.longitude}&navigate=yes`
  }
  return `https://waze.com/ul?q=${encodeURIComponent(centre.nom + ' ' + (centre.adresse || ''))}&navigate=yes`
}

export const WAYFINDING_MODES: WayfindingMode[] = ['driving', 'walking', 'bicycling']

export function readFavorites(): number[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem('medisecours_carte_favoris')
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(Number).filter((n) => Number.isFinite(n)) : []
  } catch {
    return []
  }
}

export function readRecentCentres(): number[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem('medisecours_carte_recents')
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(Number).filter(Number.isFinite).slice(0, 20) : []
  } catch {
    return []
  }
}

export function writeRecentCentre(id: number, current: number[]): number[] {
  const next = [id, ...current.filter((item) => item !== id)].slice(0, 20)
  try {
    window.localStorage.setItem('medisecours_carte_recents', JSON.stringify(next))
  } catch {
    // Storage can be disabled in private browsing.
  }
  return next
}
