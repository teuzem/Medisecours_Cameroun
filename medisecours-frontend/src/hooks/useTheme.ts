import { useEffect, useSyncExternalStore } from 'react'

export const THEME_KEY = 'medisecours_theme'
export const THEME_EVENT = 'medisecours-theme-change'

function subscribeTheme(onChange: () => void) {
  if (typeof window === 'undefined') return () => {}

  window.addEventListener('storage', onChange)
  window.addEventListener(THEME_EVENT, onChange)

  return () => {
    window.removeEventListener('storage', onChange)
    window.removeEventListener(THEME_EVENT, onChange)
  }
}

function getThemeSnapshot() {
  if (typeof window === 'undefined') return false

  return localStorage.getItem(THEME_KEY) === 'dark'
}

function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle('dark', dark)
}

export function useTheme() {
  const dark = useSyncExternalStore(subscribeTheme, getThemeSnapshot, () => false)

  useEffect(() => {
    applyTheme(dark)
  }, [dark])

  const toggleTheme = () => {
    const next = !dark
    localStorage.setItem(THEME_KEY, next ? 'dark' : 'light')
    applyTheme(next)
    window.dispatchEvent(new Event(THEME_EVENT))
  }

  return { dark, toggleTheme }
}
