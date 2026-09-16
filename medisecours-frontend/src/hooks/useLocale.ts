'use client'

import { useEffect, useSyncExternalStore } from 'react'
import i18n, {
  changeLanguage,
  DEFAULT_LOCALE,
  getStoredLocale,
  LOCALE_EVENT,
  LOCALES,
  type AppLocale,
} from '../i18n'

function isSupportedLocale(locale: string): locale is AppLocale {
  return (LOCALES as readonly string[]).includes(locale)
}

function subscribeLocale(onChange: () => void) {
  if (typeof window === 'undefined') return () => {}

  const handleStorage = (event: StorageEvent) => {
    if (!event.key || event.key === 'medisecours_lang') {
      onChange()
    }
  }

  const handleLanguageChanged = () => onChange()

  window.addEventListener('storage', handleStorage)
  window.addEventListener(LOCALE_EVENT, handleLanguageChanged)
  i18n.on('languageChanged', handleLanguageChanged)

  return () => {
    window.removeEventListener('storage', handleStorage)
    window.removeEventListener(LOCALE_EVENT, handleLanguageChanged)
    i18n.off('languageChanged', handleLanguageChanged)
  }
}

function getLocaleSnapshot(): AppLocale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE

  const current = i18n.language
  if (isSupportedLocale(current)) return current

  return getStoredLocale()
}

export function useLocale() {
  const locale = useSyncExternalStore(subscribeLocale, getLocaleSnapshot, () => DEFAULT_LOCALE)

  useEffect(() => {
    if (i18n.language !== locale) {
      changeLanguage(locale)
    }
  }, [locale])

  return {
    locale,
    setLocale: changeLanguage,
  }
}
