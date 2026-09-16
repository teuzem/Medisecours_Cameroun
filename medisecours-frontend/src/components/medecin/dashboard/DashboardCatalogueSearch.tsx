'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, BookOpen, ChevronRight, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import api from '../../../api/axios'
import { useDebounce } from '../../../hooks/useDebounce'
import useSWR from 'swr'
import { fetcher } from '../../../lib/fetcher'

interface MaladieResult {
  id: number
  nom: string
  niveauGravite: string
  urgence: boolean
  contagieux: boolean
}

export default function DashboardCatalogueSearch() {
  const router = useRouter()
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const debouncedQuery = useDebounce(query, 300)

  // Utilise le endpoint full-text PostgreSQL (`/api/maladies/search?q=...`)
  // au lieu du LIKE partiel (`/api/maladies?nom=...`).
  const searchUrl = debouncedQuery.trim().length >= 2
    ? `/api/maladies/search?q=${encodeURIComponent(debouncedQuery.trim())}&limit=6`
    : null

  const { data: raw, isLoading } = useSWR(searchUrl, fetcher)
  const results: MaladieResult[] = Array.isArray(raw) ? raw : raw?.member ?? []

  // Ferme le dropdown si on clique en dehors
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="rounded-2xl bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
      <div className="flex items-center gap-2 mb-3">
        <BookOpen className="h-4 w-4 text-[#8B5CF6]" />
        <h3 className="text-sm font-bold text-[#0F2C52]">{t('medecin.dashboard.catalogue.title')}</h3>
      </div>

      <div ref={ref} className="relative">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9CA3AF]" />
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            placeholder={t('medecin.dashboard.catalogue.searchPlaceholder')}
            className="w-full rounded-xl bg-[#F3F4F6] py-2.5 pl-9 pr-3 text-sm text-[#374151] placeholder-[#9CA3AF] outline-none transition focus:bg-white focus:ring-2 focus:ring-[#3B6EF8]/20"
          />
          {isLoading && (
            <Loader2 className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-[#9CA3AF]" />
          )}
        </div>

        {open && results.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-1 z-20 rounded-xl border border-[#E5E7EB] bg-white shadow-lg overflow-hidden">
            {results.map((m) => (
              <button
                key={m.id}
                onClick={() => { router.push(`/maladies/${m.id}`); setOpen(false); setQuery('') }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-[#374151] hover:bg-[#F9FAFB] transition border-b border-[#F3F4F6] last:border-0"
              >
                <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                  m.urgence ? 'bg-red-100' : m.contagieux ? 'bg-amber-100' : 'bg-[#F3F4F6]'
                }`}>
                  <BookOpen className={`h-3.5 w-3.5 ${
                    m.urgence ? 'text-red-500' : m.contagieux ? 'text-amber-500' : 'text-[#6B7280]'
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{m.nom}</p>
                  <p className="text-[11px] text-[#9CA3AF]">{m.niveauGravite}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-[#D1D5DB]" />
              </button>
            ))}
          </div>
        )}

        {open && !isLoading && debouncedQuery.trim().length >= 2 && results.length === 0 && (
          <div className="absolute left-0 right-0 top-full mt-1 z-20 rounded-xl border border-[#E5E7EB] bg-white shadow-lg">
            <div className="px-4 py-6 text-center text-sm text-[#9CA3AF]">{t('medecin.dashboard.catalogue.noResult')}</div>
          </div>
        )}
      </div>

      {!query && (
        <p className="mt-3 text-[11px] text-[#9CA3AF]">
          {t('medecin.dashboard.catalogue.hint')}
        </p>
      )}
    </div>
  )
}
