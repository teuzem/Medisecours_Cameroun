import axios from 'axios'
import i18n from '../i18n'

let accessToken: string | null = null
type RefreshedSession = { token: string; user: any }
let refreshPromise: Promise<RefreshedSession | null> | null = null

export function setAccessToken(token: string | null) {
  accessToken = token
}

const api = axios.create({
  baseURL: '',
  withCredentials: true,
  headers: {
    Accept: 'application/ld+json',
    'Content-Type': 'application/ld+json',
  },
})

api.interceptors.request.use((config) => {
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    if (typeof config.headers.delete === 'function') {
      config.headers.delete('Content-Type')
    } else {
      delete (config.headers as Record<string, unknown>)['Content-Type']
    }
  }

  if (i18n.language) {
    config.headers['Accept-Language'] = i18n.language
  }

  if (accessToken) {
    (config.headers as any).Authorization = `Bearer ${accessToken}`
  }
  return config
})

export function refreshSession(): Promise<RefreshedSession | null> {
  refreshPromise ??= api.post('/api/auth/refresh')
    .then(({ data }) => {
      if (!data?.token || !data?.user) {
        setAccessToken(null)
        return null
      }

      const session = { token: data.token as string, user: data.user }
      setAccessToken(session.token)
      return session
    })
    .catch(() => {
      setAccessToken(null)
      return null
    })
    .finally(() => {
      refreshPromise = null
    })

  return refreshPromise
}

api.interceptors.response.use(
  (response) => response,
  async (error: any) => {
    const request = error.config
    const isAuthEndpoint = request?.url?.includes('/api/auth/')
    if (error.response?.status === 401 && !request?._retry && !isAuthEndpoint) {
      request._retry = true
      const session = await refreshSession()
      if (session?.token) {
        request.headers = request.headers ?? {}
        request.headers.Authorization = `Bearer ${session.token}`
        return api(request)
      }
    }
    return Promise.reject(error)
  }
)

export default api
