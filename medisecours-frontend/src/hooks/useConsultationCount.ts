import useSWR from 'swr'
import api from '../api/axios'
import { useWebSocket } from './useWebSocket'
import { useAuth } from './useAuth'
import { CONSULTATIONS_PENDING_KEY } from '../lib/keys'

// Raw fetcher that returns the FULL API response (with hydra:totalItems)
const rawFetcher = async (url: string) => {
  const res = await api.get(url)
  return res.data
}

export function useConsultationCount() {
  const { user, isMedecin, token } = useAuth()

  // M1 corrigé : pas de refreshInterval. Le WebSocket ci-dessous déclenche déjà
  // mutate() sur les événements de consultation. On garde uniquement une
  // revalidation au refocus de fenêtre (peu coûteuse, itemsPerPage=1).
  const { data, mutate } = useSWR(
    (user && isMedecin) ? CONSULTATIONS_PENDING_KEY : null,
    rawFetcher,
    { revalidateOnFocus: true }
  )

  useWebSocket(user?.id || '', token || '', {
    onConsultationCreated: () => mutate(),
    onConsultationAccepted: () => mutate(),
    onConsultationClosed: () => mutate(),
  })

  const consultationCount = data?.['hydra:totalItems'] ?? data?.totalItems ?? 0

  return { consultationCount, mutate }
}
