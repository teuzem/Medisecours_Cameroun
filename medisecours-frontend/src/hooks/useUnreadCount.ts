import useSWR from 'swr'
import { fetcher } from '../lib/fetcher'
import { useAuth } from './useAuth'
import { UNREAD_MESSAGES_KEY } from '../lib/keys'

export function useUnreadCount() {
  const { user } = useAuth()

  // M1 corrigé : pas de refreshInterval. Le compteur est rafraîchi via le
  // WebSocket (new_message / message_read) et au refocus de fenêtre.
  const { data, mutate } = useSWR(user ? UNREAD_MESSAGES_KEY : null, fetcher, {
    revalidateOnFocus: true,
  })

  const decrement = () => {
    mutate((prev: any) => {
      if (!prev || prev.unreadCount <= 0) return { unreadCount: 0 }
      return { unreadCount: prev.unreadCount - 1 }
    }, false)
  }

  return {
    unreadCount: data?.unreadCount || 0,
    mutate,
    decrement
  }
}
