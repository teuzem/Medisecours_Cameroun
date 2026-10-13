'use client'

import { createContext, useContext, useCallback, useEffect, useState, type ReactNode } from 'react'
import api, { refreshSession, setAccessToken } from '../api/axios'

const AuthContext = createContext<any>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<any>(null)
  const [mounted, setMounted] = useState(false)

  const persist = useCallback((newToken: string, newUser: any) => {
    setAccessToken(newToken)
    setToken(newToken)
    setUser(newUser)
  }, [])

  useEffect(() => {
    let active = true
    let timer: number | undefined
    // Une seule relance en cas d'échec (micro-coupure réseau au chargement) :
    // sans cookie valable, le second appel échoue aussi et l'état reste déconnecté.
    refreshSession()
      .then((session) => {
        if (!active) return
        if (session) {
          persist(session.token, session.user)
          return
        }
        timer = window.setTimeout(() => {
          if (!active) return
          refreshSession().then((retried) => {
            if (active && retried) persist(retried.token, retried.user)
          })
        }, 1500)
      })
      .finally(() => {
        if (active) setMounted(true)
      })
    return () => {
      active = false
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [persist])

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post('/api/auth/login', { email, password })
    persist(data.token, data.user)
    return data.user
  }, [persist])

  const loginWithGoogle = useCallback(async (googleIdToken: string) => {
    const { data } = await api.post('/api/auth/google', { googleIdToken })
    persist(data.token, data.user)
    return data.user
  }, [persist])

  const register = useCallback(async (payload: any, config?: { timeout?: number }) => {
    const { data } = await api.post('/api/auth/register', payload, config)
    return data
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout')
    } finally {
      setAccessToken(null)
      setToken(null)
      setUser(null)
    }
  }, [])

  const updateUser = useCallback((newUser: any) => {
    setUser(newUser)
  }, [])

  const isAuthenticated = Boolean(token)
  const isAdmin = Boolean(user?.roles?.includes('ROLE_ADMIN'))
  const isMedecin = Boolean(user?.roles?.includes('ROLE_MEDECIN'))
  const isEtablissement = Boolean(user?.roles?.includes('ROLE_ETABLISSEMENT'))
  const isPersonnel = Boolean(user?.roles?.includes('ROLE_PERSONNEL'))

  return (
    <AuthContext.Provider
      value={{ user, token, isAuthenticated, isAdmin, isMedecin, isEtablissement, isPersonnel, mounted, login, loginWithGoogle, register, logout, updateUser }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthContext() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuthContext doit être utilisé dans un AuthProvider')
  return ctx
}
