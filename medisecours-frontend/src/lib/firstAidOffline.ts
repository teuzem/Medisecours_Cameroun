import { FIRST_AID_OFFLINE_TTL } from '@/config/firstAid'
import type { FirstAidProtocol } from '@/types/firstAid'

const KEY = 'first-aid-protocols-cache'

interface CacheEntry {
  storedAt: number
  protocols: FirstAidProtocol[]
}

export function readOfflineProtocols(): FirstAidProtocol[] | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return null
    const entry = JSON.parse(raw) as CacheEntry
    if (Date.now() - entry.storedAt > FIRST_AID_OFFLINE_TTL) return null
    return Array.isArray(entry.protocols) ? entry.protocols : null
  } catch {
    return null
  }
}

export function writeOfflineProtocols(protocols: FirstAidProtocol[]): void {
  if (typeof window === 'undefined') return
  try {
    const entry: CacheEntry = { storedAt: Date.now(), protocols }
    window.localStorage.setItem(KEY, JSON.stringify(entry))
  } catch {
    // Stockage indisponible (mode privé, quota) : le cache est facultatif.
  }
}
