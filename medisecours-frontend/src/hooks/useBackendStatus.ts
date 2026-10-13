'use client'

import { useCallback, useEffect, useState } from 'react'
import api from '../api/axios'

export type BackendStatus = 'checking' | 'up' | 'down'

/**
 * Sonde de disponibilité du backend via le proxy runtime same-origin.
 * Un backend injoignable est la cause n°1 des toasts « service indisponible » :
 * les pages d'auth l'affichent comme une bannière explicite avec nouvel essai.
 */
export function useBackendStatus(enabled = true) {
  const [backendStatus, setBackendStatus] = useState<BackendStatus>('checking')

  const checkBackend = useCallback(async () => {
    setBackendStatus('checking')
    try {
      await api.get('/api/health', { timeout: 8000 })
      setBackendStatus('up')
    } catch {
      setBackendStatus('down')
    }
  }, [])

  useEffect(() => {
    if (enabled) void checkBackend()
  }, [checkBackend, enabled])

  return { backendStatus, setBackendStatus, checkBackend }
}
