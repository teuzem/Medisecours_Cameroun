import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { mutate as globalMutate } from 'swr'
import frBase from './locales/fr.json'
import frAdmin from './locales/fr/admin.json'
import frMedecin from './locales/fr/medecin.json'
import frPatient from './locales/fr/patient.json'
import frVisitor from './locales/fr/visitor.json'
import enBase from './locales/en.json'
import enAdmin from './locales/en/admin.json'
import enMedecin from './locales/en/medecin.json'
import enPatient from './locales/en/patient.json'
import enVisitor from './locales/en/visitor.json'

export const LOCALES = ['fr', 'en'] as const
export type AppLocale = (typeof LOCALES)[number]

export const LOCALE_STORAGE_KEY = 'medisecours_lang'
export const LOCALE_EVENT = 'medisecours-language-change'

export const DEFAULT_LOCALE: AppLocale = 'fr'

export const LOCALE_LABELS: Record<AppLocale, { label: string; flag: string }> = {
  fr: { label: 'Français', flag: '🇫🇷' },
  en: { label: 'English', flag: '🇬🇧' },
}

const fr = { ...frBase, ...frAdmin, ...frMedecin, ...frPatient, ...frVisitor }
const en = { ...enBase, ...enAdmin, ...enMedecin, ...enPatient, ...enVisitor }

function isSupportedLocale(locale: string): locale is AppLocale {
  return (LOCALES as readonly string[]).includes(locale)
}

function notifyLocaleChange(locale: AppLocale) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(LOCALE_EVENT, { detail: locale }))
}

function applyDocumentLanguage(locale: AppLocale) {
  if (typeof document === 'undefined') return
  document.documentElement.lang = locale
}

export function getStoredLocale(): AppLocale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY)
    if (stored && isSupportedLocale(stored)) return stored
  } catch {
    /* ignore */
  }
  return DEFAULT_LOCALE
}

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: {
      fr: { translation: fr },
      en: { translation: en },
    },
    lng: DEFAULT_LOCALE,
    fallbackLng: DEFAULT_LOCALE,
    interpolation: { escapeValue: false },
    returnNull: false,
  })
}

if (typeof window !== 'undefined') {
  i18n.on('languageChanged', (locale) => {
    if (!isSupportedLocale(locale)) return
    applyDocumentLanguage(locale)
    notifyLocaleChange(locale)
  })
}

export function changeLanguage(locale: AppLocale) {
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  } catch {
    /* ignore */
  }
  applyDocumentLanguage(locale)
  notifyLocaleChange(locale)
  void i18n.changeLanguage(locale)
  void globalMutate(() => true)
}

export default i18n
