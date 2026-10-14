/**
 * Extrait un tableau depuis une réponse API Platform (Hydra JSON-LD) ou une réponse simple.
 * Garantit toujours un Array, même si l'API renvoie null, undefined ou un objet.
 *
 * @param {any} responseData - res.data directement
 * @returns {Array}
 */
export function extractArray(responseData: any) {
  const raw =
    responseData?.['hydra:member'] ??
    responseData?.member ??
    responseData
  return Array.isArray(raw) ? raw : []
}

/**
 * Extrait le total depuis une réponse API Platform.
 * @param {any} responseData
 * @param {number} fallback
 * @returns {number}
 */
export function extractTotal(responseData: any, fallback = 0) {
  return responseData?.['hydra:totalItems'] ?? responseData?.total ?? fallback
}

/**
 * Extrait la liste des avis depuis toutes les formes de réponse connues :
 * - enveloppe dédiée `{items: [...]}` (GET /api/etablissements/{id}/avis),
 * - Hydra (`hydra:member` / `member`),
 * - tableau brut.
 * Garantit toujours un Array (jamais null/undefined/objet) afin que la
 * fiche n'affiche jamais une liste vide par erreur de forme.
 */
export function extractAvisList<T = any>(responseData: any): T[] {
  if (!responseData) return []
  if (Array.isArray(responseData)) return responseData as T[]
  const nested =
    (responseData as { items?: unknown })?.items ??
    responseData?.member ??
    responseData?.['hydra:member']
  return Array.isArray(nested) ? (nested as T[]) : []
}
