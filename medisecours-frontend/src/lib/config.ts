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
