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
