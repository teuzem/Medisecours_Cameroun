/**
 * Constantes métier partagées — statuts, priorités, styles de badge.
 *
 * Source unique de vérité pour TOUTES les pages médecin/admin.
 * À importer plutôt que de redéfinir STATUT_BADGE / idFromIri dans chaque page.
 */
import type {
  StatutConsultation,
  PrioriteConsultation,
  StatutMessage,
} from '../types/api'

/* ------------------------------------------------------------------ */
/* Libellés                                                           */
/* ------------------------------------------------------------------ */

export const STATUT_CONSULTATION_LABEL: Record<StatutConsultation, string> = {
  OUVERTE: 'Ouverte',
  EN_COURS: 'En cours',
  TERMINEE: 'Terminée',
  ANNULEE: 'Annulée',
}

export const STATUT_CONSULTATION_PILL: Record<StatutConsultation, string> = {
  OUVERTE: 'En attente',
  EN_COURS: 'En cours',
  TERMINEE: 'Terminée',
  ANNULEE: 'Annulée',
}

export const PRIORITE_LABEL: Record<PrioriteConsultation, string> = {
  NORMALE: 'Normale',
  URGENTE: 'Urgente',
  CRITIQUE: 'Critique',
}

export const STATUT_MESSAGE_LABEL: Record<StatutMessage, string> = {
  ENVOYE: 'Envoyé',
  LIVRE: 'Livré',
  LU: 'Lu',
}

/* ------------------------------------------------------------------ */
/* Styles de badge (classes Tailwind)                                 */
/* ------------------------------------------------------------------ */

/** Variante "pleine" — fond coloré (cartes, tableaux compacts) */
export const STATUT_BADGE: Record<StatutConsultation, string> = {
  OUVERTE: 'bg-blue-100 text-blue-700',
  EN_COURS: 'bg-emerald-100 text-emerald-700',
  TERMINEE: 'bg-gray-100 text-gray-600',
  ANNULEE: 'bg-red-100 text-red-700',
}

/** Variante "anneau" — fond clair + bordure (fiches détaillées) */
export const STATUT_BADGE_RING: Record<StatutConsultation, string> = {
  OUVERTE: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  EN_COURS: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  TERMINEE: 'bg-green-50 text-green-700 ring-1 ring-green-200',
  ANNULEE: 'bg-gray-100 text-gray-500 ring-1 ring-gray-200',
}

/** Variante "bordure" — fond clair + border (historique patient, fiche compacte) */
export const STATUT_BADGE_BORDER: Record<StatutConsultation, string> = {
  OUVERTE: 'bg-blue-50 text-blue-700 border-blue-200',
  EN_COURS: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  TERMINEE: 'bg-gray-50 text-gray-500 border-gray-200',
  ANNULEE: 'bg-red-50 text-red-600 border-red-200',
}

/** Styles de badge de priorité */
export const PRIORITE_BADGE: Partial<Record<PrioriteConsultation, string>> = {
  URGENTE: 'text-amber-600 bg-amber-50 ring-1 ring-amber-200',
  CRITIQUE: 'text-red-600 bg-red-50 ring-1 ring-red-200',
}

export const PRIORITE_CONFIG: Record<
  PrioriteConsultation,
  { label: string; color: string; bg: string }
> = {
  CRITIQUE: { label: 'Critique', color: '#EF4444', bg: '#FEF2F2' },
  URGENTE: { label: 'Urgente', color: '#F59E0B', bg: '#FFFBEB' },
  NORMALE: { label: 'Normale', color: '#3B6EF8', bg: '#EFF6FF' },
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Nombre de jours écoulés depuis une date ISO (jamais négatif). */
export function daysSince(dateString: string | null | undefined): number {
  if (!dateString) return 0
  return Math.max(0, Math.floor((Date.now() - new Date(dateString).getTime()) / 86400000))
}

/** Formate une date ISO en format court français. */
export function formatDateShort(dateString: string | null | undefined): string {
  if (!dateString) return '—'
  return new Date(dateString).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

/** Formate une date ISO avec heure. */
export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '—'
  return new Date(dateString).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
