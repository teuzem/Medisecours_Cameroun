import api from '../api/axios'

export async function fetcher(url: string) {
  const res = await api.get(url)
  return res.data?.member ?? res.data?.['hydra:member'] ?? res.data
}

/**
 * Normalise la réponse de GET /api/carte/saved ({ids:[...]}) en number[].
 * Le contrôleur CartePersonalController renvoie un objet, pas un tableau.
 */
export function extractIds(data: unknown): number[] {
  const raw = (data as { ids?: unknown } | null)?.ids ?? data
  if (!Array.isArray(raw)) return []
  return raw.map(Number).filter((n) => Number.isFinite(n))
}

export async function fetcherIds(url: string): Promise<number[]> {
  const res = await api.get(url)
  return extractIds(res.data)
}

export async function paginatedFetcher(url: string) {
  const res = await api.get(url)
  const data = res.data
  return {
    items: data?.member ?? data?.['hydra:member'] ?? data,
    totalItems: data?.totalItems ?? data?.['hydra:totalItems'] ?? 0,
  }
}

export const swrConfig = {
  fetcher,
  dedupingInterval: 120_000,
  revalidateOnFocus: false,
  keepPreviousData: true,
  shouldRetryOnError: true,
  errorRetryCount: 3,
  errorRetryInterval: 5_000,
}
