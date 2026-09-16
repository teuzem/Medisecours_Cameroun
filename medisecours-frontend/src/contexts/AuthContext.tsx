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
    refreshSession()
      .then((session) => {
        if (active && session) persist(session.token, session.user)
      })
      .finally(() => {
        if (active) setMounted(true)
      })
    return () => { active = false }
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

  const register = useCallback(async (payload: any) => {
    const { data } = await api.post('/api/auth/register', payload)
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

  return (
    <AuthContext.Provider
      value={{ user, token, isAuthenticated, isAdmin, isMedecin, mounted, login, loginWithGoogle, register, logout, updateUser }}
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
