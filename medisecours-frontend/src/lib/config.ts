export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || ''

export function resolveImgPath(path: string): string {
  if (!path) return ''
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`
}

/**
 * Résout un chemin d'image (photo de profil, etc.) en URL absolue.
 * Retourne null si le chemin est vide/null (évite les crashs `path.startsWith`).
 */
export function imgUrl(path: string | null | undefined): string | null {
  if (!path) return null
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`
}

/**
 * Candidats d'URL pour une photo stockée par l'application.
 *
 * 1. le même chemin en provenance du proxy Next (toujours joignable depuis le
 *    navigateur, même sans `NEXT_PUBLIC_API_BASE_URL`) ;
 * 2. l'URL API directe lorsque la variable est définie.
 */
export function imgSrcCandidates(path: string | null | undefined): string[] {
  if (!path) return []
  if (path.startsWith('http://') || path.startsWith('https://')) return [path]
  const relative = path.startsWith('/') ? path : `/${path}`
  return API_BASE ? [relative, `${API_BASE}${relative}`] : [relative]
}

/**
 * Premier candidat d'URL encore disponible.
 *
 * Candidat épuisé = URL qui a renvoyé une erreur : on passe alors au suivant
 * (proxy → API directe) et les initiales ne s'affichent qu'une fois la liste
 * entièrement épuisée.
 */
export function pickPhotoSrc(candidates: string[], failed: string[]): string | null {
  return candidates.find((candidate) => !failed.includes(candidate)) ?? null
}
