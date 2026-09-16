'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Languages, Check } from 'lucide-react'
import { LOCALES, LOCALE_LABELS, changeLanguage, type AppLocale } from '../../i18n'
import { useLocale } from '../../hooks/useLocale'
import { broadcastLanguageChange } from '../../hooks/useWebSocket'

export default function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { locale: current } = useLocale()
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number; right: number } | null>(null)

  useEffect(() => {
    if (!open) return
    const el = buttonRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setPos({
      top: rect.bottom + 8,
      left: rect.left,
      right: window.innerWidth - rect.right,
    })
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (
        (buttonRef.current && buttonRef.current.contains(e.target as Node)) ||
        (menuRef.current && menuRef.current.contains(e.target as Node))
      ) {
        return
      }
      setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleLanguageChange = async (locale: AppLocale) => {
    changeLanguage(locale)
    broadcastLanguageChange(locale)
    setOpen(false)
  }

  return (
    <div className={`relative shrink-0 ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 items-center gap-1.5 rounded-xl px-2.5 text-[#6B7280] transition hover:bg-[#F3F4F6]"
        aria-label="Langue / Language"
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Langue / Language"
      >
        <Languages className="h-5 w-5" />
        <span className="text-sm font-semibold uppercase">{current}</span>
      </button>
      {open && pos
        ? createPortal(
            <div
              ref={menuRef}
              role="listbox"
              aria-label="Langue / Language"
              style={{ top: pos.top, left: pos.left, right: pos.right }}
              className="fixed z-[999] w-44 rounded-xl border border-[#E5E7EB] bg-white py-1 shadow-lg"
            >
              {LOCALES.map((locale) => (
                <button
                  key={locale}
                  type="button"
                  role="option"
                  aria-selected={locale === current}
                  onClick={() => handleLanguageChange(locale)}
                  className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm text-[#374151] transition hover:bg-[#F3F4F6]"
                >
                  <span className="text-base">{LOCALE_LABELS[locale].flag}</span>
                  <span className="flex-1">{LOCALE_LABELS[locale].label}</span>
                  {locale === current && <Check className="h-4 w-4 text-[#3B6EF8]" />}
                </button>
              ))}
            </div>,
            document.body
          )
        : null}
    </div>
  )
}
