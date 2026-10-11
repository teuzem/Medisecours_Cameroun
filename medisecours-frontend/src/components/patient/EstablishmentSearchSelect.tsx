'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Building2, ChevronDown, Loader2, Search, X } from 'lucide-react'
import api from '../../api/axios'
import { extractArray } from '../../lib/api'

type EstablishmentLite = { id: number; nom: string; ville?: string | null }

const DEBOUNCE_MS = 250
const MIN_QUERY = 2
const RESULTS_LIMIT = 8

/**
 * Sélecteur d'établissement avec recherche temps réel (debounce 250 ms).
 * Remplace le <select> chargé en une fois par une recherche paginée
 * sur le filtre `nom` (partial) de l'API.
 */
export default function EstablishmentSearchSelect({
  value,
  onChange,
  disabled = false,
}: {
  value: number | null
  onChange: (id: number | null) => void
  disabled?: boolean
}) {
  const { t } = useTranslation()
  const listId = useId()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [results, setResults] = useState<EstablishmentLite[]>([])
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null)
  const [selectedLoading, setSelectedLoading] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    const q = debouncedQuery
    const fetchUrl =
      q.length >= MIN_QUERY
        ? `/api/centre_de_santes?estActif=true&nom=${encodeURIComponent(q)}&itemsPerPage=${RESULTS_LIMIT}`
        : `/api/centre_de_santes?estActif=true&itemsPerPage=${RESULTS_LIMIT}&order[nom]=asc`

    const loadingTimer = window.setTimeout(() => setSearching(true), 0)
    api
      .get(fetchUrl, { signal: controller.signal })
      .then(({ data }) => {
        setResults(extractArray(data) as EstablishmentLite[])
        setHighlight(-1)
      })
      .catch((err) => {
        if (err?.code === 'ERR_CANCELED' || controller.signal.aborted) return
        setResults([])
      })
      .finally(() => {
        if (!controller.signal.aborted) setSearching(false)
      })

    return () => {
      window.clearTimeout(loadingTimer)
      controller.abort()
    }
  }, [open, debouncedQuery])

  useEffect(() => {
    if (value === null) {
      const timer = window.setTimeout(() => setSelectedLabel(null), 0)
      return () => window.clearTimeout(timer)
    }
    const known = results.find((item) => item.id === value)
    if (known) {
      const label = known.ville ? `${known.nom} — ${known.ville}` : known.nom
      const timer = window.setTimeout(() => setSelectedLabel(label), 0)
      return () => window.clearTimeout(timer)
    }
    const controller = new AbortController()
    const loadingTimer = window.setTimeout(() => setSelectedLoading(true), 0)
    api
      .get(`/api/centre_de_santes/${value}`, { signal: controller.signal })
      .then(({ data }) => {
        const nom = String((data as any)?.nom ?? `#${value}`)
        const ville = (data as any)?.ville ?? null
        setSelectedLabel(ville ? `${nom} — ${ville}` : nom)
      })
      .catch(() => setSelectedLabel(`#${value}`))
      .finally(() => {
        if (!controller.signal.aborted) setSelectedLoading(false)
      })
    return () => {
      window.clearTimeout(loadingTimer)
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  const select = useCallback(
    (item: EstablishmentLite | null) => {
      onChange(item ? item.id : null)
      if (item) {
        setSelectedLabel(item.ville ? `${item.nom} — ${item.ville}` : item.nom)
        setQuery('')
      } else {
        setSelectedLabel(null)
      }
      setOpen(false)
      setHighlight(-1)
    },
    [onChange],
  )

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!open) setOpen(true)
      else setHighlight((h) => Math.min(h + 1, results.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (event.key === 'Enter') {
      if (open && highlight >= 0 && results[highlight]) {
        event.preventDefault()
        select(results[highlight])
      }
    } else if (event.key === 'Escape') {
      setOpen(false)
      setHighlight(-1)
    }
  }

  const displayValue = useMemo(() => {
    if (open) return query
    if (selectedLabel) return selectedLabel
    return ''
  }, [open, query, selectedLabel])

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          disabled={disabled}
          value={displayValue}
          onChange={(event) => {
            setQuery(event.target.value)
            if (!open) setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={t('patient.consultations.establishmentSearchPlaceholder')}
          className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-16 text-sm text-slate-900 outline-none transition focus:border-emerald-500 disabled:opacity-60 dark:border-white/10 dark:bg-slate-950 dark:text-white"
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {selectedLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" aria-hidden="true" />}
          {value !== null && !disabled && (
            <button
              type="button"
              onClick={() => select(null)}
              aria-label={t('patient.consultations.establishmentClear')}
              className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/5"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            onClick={() => {
              setOpen((o) => !o)
              inputRef.current?.focus()
            }}
            className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-400"
          >
            <ChevronDown className={`h-3.5 w-3.5 transition ${open ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          {searching && results.length === 0 && (
            <li className="flex items-center gap-2 px-3 py-2.5 text-xs text-slate-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {t('patient.consultations.establishmentSearching')}
            </li>
          )}
          {!searching && results.length === 0 && (
            <li className="px-3 py-2.5 text-xs text-slate-400">{t('patient.consultations.establishmentNoResult')}</li>
          )}
          {results.map((item, index) => (
            <li
              key={item.id}
              role="option"
              aria-selected={value === item.id || highlight === index}
              onMouseEnter={() => setHighlight(index)}
              onMouseDown={(event) => {
                event.preventDefault()
                select(item)
              }}
              className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm transition ${
                highlight === index || value === item.id
                  ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-100'
                  : 'text-slate-700 dark:text-slate-200'
              }`}
            >
              <Building2 className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden="true" />
              <span className="min-w-0 truncate">
                {item.nom}
                {item.ville ? <span className="text-slate-400"> — {item.ville}</span> : null}
              </span>
            </li>
          ))}
          <li
            role="option"
            aria-selected={value === null}
            onMouseDown={(event) => {
              event.preventDefault()
              select(null)
            }}
            className="cursor-pointer border-t border-slate-100 px-3 py-2 text-xs font-bold text-slate-500 transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-white/5"
          >
            {t('patient.consultations.establishmentAny')}
          </li>
        </ul>
      )}
    </div>
  )
}
