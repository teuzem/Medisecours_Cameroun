/**
 * Clés SWR centralisées — MediSecours.
 *
 * Pourquoi : SWR déduplique et mutualise le cache PAR CLÉ exacte.
 * Si une page fetch '/api/consultations' et une autre '/api/consultations?itemsPerPage=30',
 * ce sont DEUX entrées de cache distinctes → 2 requêtes réseau.
 *
 * En centralisant les clés, toutes les pages qui consomment la même ressource
 * partagent le même cache, et les mutations (globalMutate) invalident partout.
 */

/** Clé pour la collection de consultations (filtrée par CurrentUserExtension back). */
export const CONVERSATIONS_KEY = '/api/conversations'

export const CONSULTATIONS_KEY = '/api/consultations'

/** Clé "optimisée" pour le compteur du sidebar (1 seul item, ne charge que totalItems). */
export const CONSULTATIONS_PENDING_KEY = '/api/consultations?itemsPerPage=1&statut=OUVERTE'

/** Clé pour la liste des patients (filtrée par CurrentUserExtension). */
export const PATIENTS_KEY = '/api/patients'

/** Clé pour la liste des prescriptions (filtrée par CurrentUserExtension). */
export const PRESCRIPTIONS_KEY = '/api/prescriptions'

/** Clé pour la liste publique des médecins. */
export const MEDECINS_KEY = '/api/medecins-publics'

/** Clé du compteur de messages non lus (endpoint dédié, léger). */
export const UNREAD_MESSAGES_KEY = '/api/messages/unread-count'

/** Liste persistée des notifications de l'utilisateur connecté. */
export const NOTIFICATIONS_KEY = '/api/notifications?itemsPerPage=100&order[createdAt]=desc'

/** Compteur léger des notifications persistées non lues. */
export const UNREAD_NOTIFICATIONS_KEY = '/api/notifications/unread-count'

/** Dashboard agrégé du médecin connecté. */
export const DASHBOARD_KEY = '/api/me/dashboard'

/** Préférences de personnalisation de l'utilisateur connecté (médecin ou patient). */
export const ME_PREFERENCES_KEY = '/api/me/preferences'

/** Fiches établissements (recherche patient, filtres type/région/ville). */
export const ETABLISSEMENTS_KEY = '/api/centre_de_santes'

/** Établissements favoris de l'utilisateur connecté (ids). */
export const FAVORIS_KEY = '/api/carte/saved'

/** Avis d'établissement publiés par l'utilisateur connecté. */
export const AVIS_ETABLISSEMENTS_KEY = '/api/avis_etablissements'

/** Statistiques agrégées des consultations du patient connecté. */
export const PATIENT_CONSULTATIONS_STATS_KEY = '/api/patient/consultations/stats'

/** Construit la clé SWR conditionnelle : retourne null si l'utilisateur n'est pas prêt. */
export function keyed<T>(key: T, condition: unknown): T | null {
  return condition ? key : null
}
