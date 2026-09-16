import api from '../api/axios'

export async function fetcher(url: string) {
  const res = await api.get(url)
  return res.data?.member ?? res.data?.['hydra:member'] ?? res.data
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
