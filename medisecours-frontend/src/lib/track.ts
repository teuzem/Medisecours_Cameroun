import api from '../api/axios'

export type InteractionType =
  | 'fiche'
  | 'telephone'
  | 'email'
  | 'site_web'
  | 'itineraire'
  | 'partage'
  | 'sauvegarde'
  | 'sos'
  | 'suggestion'
  | 'proximite'
  | 'service'
  | 'avis'

const KNOWN_TYPES = new Set<string>([
  'fiche',
  'telephone',
  'email',
  'site_web',
  'itineraire',
  'partage',
  'sauvegarde',
  'sos',
  'suggestion',
  'proximite',
  'service',
  'avis',
])

/**
 * Enregistre une interaction sur une fiche établissement (analytiques temps réel).
 *
 * Fire-and-forget : la promesse échoue silencieusement pour ne jamais dégrader
 * une action visiteur (appel, itinéraire, partage…).
 */
export function trackInteraction(
  centre: number | null | undefined,
  type: InteractionType,
  metadata?: Record<string, unknown>,
) {
  if (centre == null || typeof window === 'undefined' || !KNOWN_TYPES.has(type)) return
  try {
    void api
      .post('/api/carte/evenements', { centre, type, metadata: metadata ?? {} })
      .catch(() => undefined)
  } catch {
    // jamais bloquant
  }
}