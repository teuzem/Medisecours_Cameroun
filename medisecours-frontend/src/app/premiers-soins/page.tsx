'use client'

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import {
  ArrowRight,
  Bandage,
  Brain,
  CheckCircle2,
  Droplets,
  Flame,
  HeartPulse,
  Loader2,
  PhoneCall,
  Search,
  ShieldAlert,
  Siren,
  WifiOff,
  Wind,
} from 'lucide-react'
import api from '@/api/axios'
import { useTranslation } from 'react-i18next'
import { emergencyCallHref, EMERGENCY_NUMBER, EMERGENCY_NUMBER_LABEL } from '@/config/firstAid'
import { readOfflineProtocols, writeOfflineProtocols } from '@/lib/firstAidOffline'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import type {
  FirstAidCategory,
  FirstAidPaginatedResponse,
  FirstAidProtocol,
  FirstAidUrgency,
} from '@/types/firstAid'

const CATEGORY_SLUG = 'TOUTE_CATEGORIE'
const ITEMS_PER_PAGE = 12
const NAVIGATION_STATE_KEY = 'medisecours:first-aid-navigation'
const subscribeHydration = () => () => {}

interface FirstAidNavigationState {
  query: string
  urgency: 'TOUS' | FirstAidUrgency
  category: string
  page: number
}

const urgencyStyle: Record<FirstAidUrgency, string> = {
  CRITIQUE: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-200',
  ELEVE: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200',
  MOYEN: 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-200',
  FAIBLE: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200',
}

const CAMEROON_PRIORITY_LABELS = [
  'visitor.firstAid.priority1',
  'visitor.firstAid.priority2',
  'visitor.firstAid.priority3',
  'visitor.firstAid.priority4',
  'visitor.firstAid.priority5',
]

function protocolIcon(slug: string) {
  if (slug.includes('respiratoire') || slug === 'etouffement') return Wind
  if (slug.includes('brulure')) return Flame
  if (slug.includes('saignement') || slug === 'plaie') return Bandage
  if (slug.includes('deshydratation')) return Droplets
  if (slug.includes('convulsion') || slug.includes('connaissance')) return Brain
  if (slug.includes('thoracique')) return HeartPulse
  if (slug.includes('intoxication') || slug.includes('allergique')) return ShieldAlert
  return Siren
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function formatVariant(value: string): string {
  return value.toLowerCase().replaceAll('_', ' ')
}

export default function FirstAidPage() {
  const { t } = useTranslation()
  const hydrated = useSyncExternalStore(subscribeHydration, () => true, () => false)
  const online = useOnlineStatus()
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [urgency, setUrgency] = useState<'TOUS' | FirstAidUrgency>('TOUS')
  const [category, setCategory] = useState<string>(CATEGORY_SLUG)
  const [page, setPage] = useState(1)
  const [offlineProtocols, setOfflineProtocols] = useState<FirstAidProtocol[]>([])
  const [hasRestoredNavigation, setHasRestoredNavigation] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = window.sessionStorage.getItem(NAVIGATION_STATE_KEY)
        if (saved) {
          const state = JSON.parse(saved) as Partial<FirstAidNavigationState>
          const savedUrgency = state.urgency
          if (typeof state.query === 'string') setQuery(state.query)
          if (
            savedUrgency === 'TOUS'
            || savedUrgency === 'CRITIQUE'
            || savedUrgency === 'ELEVE'
            || savedUrgency === 'MOYEN'
            || savedUrgency === 'FAIBLE'
          ) {
            setUrgency(savedUrgency)
          }
          if (typeof state.category === 'string' && state.category !== '') {
            setCategory(state.category)
          }
          if (typeof state.page === 'number' && Number.isInteger(state.page) && state.page > 0) {
            setPage(state.page)
          }
        }
      } catch {
        try {
          window.sessionStorage.removeItem(NAVIGATION_STATE_KEY)
        } catch {
          // Le stockage peut être entièrement bloqué par les règles du navigateur.
        }
      } finally {
        setHasRestoredNavigation(true)
      }
    }, 0)

    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!hasRestoredNavigation) return

    const state: FirstAidNavigationState = { query, urgency, category, page }
    try {
      window.sessionStorage.setItem(NAVIGATION_STATE_KEY, JSON.stringify(state))
    } catch {
      // La navigation continue normalement si le stockage du navigateur est indisponible.
    }
  }, [hasRestoredNavigation, query, urgency, category, page])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setOfflineProtocols(readOfflineProtocols() ?? [])
    }, 0)

    return () => window.clearTimeout(timer)
  }, [])

  const listKey = debouncedQuery
    ? null
    : ['public-first-aid-protocols', page, urgency, category]

  const { data: paginatedData, error, isLoading } = useSWR<FirstAidPaginatedResponse>(
    listKey,
    async () => {
      const params = new URLSearchParams({
        page: String(page),
        itemsPerPage: String(ITEMS_PER_PAGE),
      })
      if (urgency !== 'TOUS') params.set('urgency', urgency)
      if (category !== CATEGORY_SLUG) params.set('category', category)
      const { data } = await api.get(`/api/public/first-aid-protocols?${params.toString()}`)
      const response = data as FirstAidPaginatedResponse
      writeOfflineProtocols(response.items)
      return response
    },
    {
      revalidateOnFocus: false,
      keepPreviousData: true,
      fallbackData: {
        items: [],
        total: 0,
        page: 1,
        itemsPerPage: ITEMS_PER_PAGE,
        totalPages: 1,
      },
    },
  )
  const protocols = useMemo(() => {
    if (!hydrated) return []
    const remote = paginatedData?.items ?? []
    return remote.length > 0 ? remote : offlineProtocols
  }, [hydrated, paginatedData?.items, offlineProtocols])

  const { data: categories = [] } = useSWR<FirstAidCategory[]>(
    'public-first-aid-categories',
    async () => {
      const { data } = await api.get('/api/public/first-aid-protocols/categories')
      return data as FirstAidCategory[]
    },
    { revalidateOnFocus: false },
  )

  const { data: searchData } = useSWR(
    debouncedQuery ? ['public-first-aid-search', debouncedQuery] : null,
    async () => {
      const { data } = await api.get(`/api/public/first-aid-protocols/search?q=${encodeURIComponent(debouncedQuery)}`)
      return data as { results: FirstAidProtocol[]; suggestions: string[] }
    },
    { revalidateOnFocus: false },
  )

  const visible = useMemo(() => {
    const source = debouncedQuery ? (searchData?.results ?? protocols) : protocols
    return source
      .filter((protocol) => debouncedQuery === '' || urgency === 'TOUS' || protocol.niveauUrgence === urgency)
      .filter((protocol) => debouncedQuery === '' || category === CATEGORY_SLUG || protocol.categorie === category)
  }, [protocols, searchData, debouncedQuery, urgency, category])

  const showOffline = hydrated && !online && !isLoading
  const visibleCategories = hydrated ? categories : []
  const displayedTotal = paginatedData?.total || protocols.length
  const suggestions = debouncedQuery ? (searchData?.suggestions ?? []) : []

  const changePage = (nextPage: number) => {
    setPage(nextPage)
    window.requestAnimationFrame(() => {
      const catalogue = document.getElementById('first-aid-catalogue')
      if (!catalogue) return

      catalogue.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  return (
    <main
      id="first-aid-catalogue"
      className="scroll-mt-24 mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10"
    >
      <header className="border-b border-slate-200 pb-6 dark:border-white/10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
              {t('visitor.firstAid.eyebrow')}
            </p>
            <h1 className="mt-2 font-display text-3xl font-bold text-slate-950 dark:text-white">
              {t('visitor.firstAid.title')}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              {t('visitor.firstAid.intro')}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={emergencyCallHref()}
              className="inline-flex h-11 items-center justify-center gap-2 bg-red-600 px-4 text-sm font-bold text-white transition hover:bg-red-500"
            >
              <PhoneCall className="h-4 w-4" aria-hidden="true" />
              {t('visitor.firstAid.callEmergency', { label: EMERGENCY_NUMBER_LABEL, number: EMERGENCY_NUMBER })}
            </a>
            <Link
              href="/maladies"
              className="inline-flex h-11 items-center justify-center gap-2 bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              <Siren className="h-4 w-4" aria-hidden="true" />
              {t('visitor.firstAid.orientationButton')}
            </Link>
          </div>
        </div>
      </header>

      <section className="mt-6 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
        <label className="flex h-12 items-center gap-3 border border-slate-300 bg-white px-4 dark:border-white/10 dark:bg-slate-900">
          <Search className="h-5 w-5 text-slate-400" aria-hidden="true" />
          <span className="sr-only">{t('visitor.firstAid.searchSrOnly')}</span>
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setPage(1)
            }}
            placeholder={t('visitor.firstAid.searchPlaceholder')}
            className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-white"
          />
        </label>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('visitor.firstAid.filterUrgencyAria')}>
          {(['TOUS', 'CRITIQUE', 'ELEVE', 'MOYEN', 'FAIBLE'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={urgency === value}
              onClick={() => {
                setUrgency(value)
                setPage(1)
              }}
              className={`h-12 px-3 text-xs font-bold transition ${
                urgency === value
                  ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300'
              }`}
            >
              {value === 'TOUS' ? t('visitor.firstAid.allUrgencies') : value}
            </button>
          ))}
        </div>
      </section>

      {visibleCategories.length > 0 && (
        <section aria-label={t('visitor.firstAid.filterCategoryAria')} className="mt-4 flex flex-wrap gap-1.5">
          <button
            type="button"
            aria-pressed={category === CATEGORY_SLUG}
            onClick={() => {
              setCategory(CATEGORY_SLUG)
              setPage(1)
            }}
            className={`h-9 px-3 text-xs font-bold transition ${
              category === CATEGORY_SLUG
                ? 'bg-emerald-700 text-white dark:bg-emerald-500 dark:text-slate-950'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300'
            }`}
          >
            {t('visitor.firstAid.allCategories')}
          </button>
          {visibleCategories.map((item) => (
            <button
              key={item.slug}
              type="button"
              aria-pressed={category === item.slug}
              onClick={() => {
                setCategory(item.slug)
                setPage(1)
              }}
              className={`h-9 px-3 text-xs font-bold transition ${
                category === item.slug
                  ? 'bg-emerald-700 text-white dark:bg-emerald-500 dark:text-slate-950'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300'
              }`}
            >
              {item.label} ({item.count})
            </button>
          ))}
        </section>
      )}

      {showOffline && (
        <div
          role="status"
          className="mt-5 flex gap-3 border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200"
        >
          <WifiOff className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <p className="min-w-0 break-words">{t('visitor.firstAid.offlineNotice')}</p>
        </div>
      )}

      {!debouncedQuery && category === CATEGORY_SLUG && urgency === 'TOUS' && (
        <section className="mt-5 border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/10">
          <p className="text-sm font-bold text-emerald-950 dark:text-emerald-100">
            {t('visitor.firstAid.cameroonBannerTitle')}
          </p>
          <p className="mt-1 text-xs leading-5 text-emerald-800 dark:text-emerald-200">
            {t('visitor.firstAid.cameroonBannerDesc')}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {CAMEROON_PRIORITY_LABELS.map((key) => (
              <span
                key={key}
                className="border border-emerald-200 bg-white px-2.5 py-1 text-[11px] font-bold text-emerald-800 dark:border-emerald-400/20 dark:bg-slate-950/40 dark:text-emerald-200"
              >
                {t(key)}
              </span>
            ))}
          </div>
        </section>
      )}

      {(!hydrated || (isLoading && protocols.length === 0)) ? (
        <div role="status" className="flex min-h-[360px] items-center justify-center text-sm text-slate-500">
          <Loader2 className="mr-3 h-5 w-5 animate-spin" aria-hidden="true" />
          {t('visitor.firstAid.loading')}
        </div>
      ) : error && protocols.length === 0 && !showOffline ? (
        <div role="alert" className="mt-6 border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {t('visitor.firstAid.errorNotice')}
        </div>
      ) : visible.length === 0 ? (
        <div className="mt-6 border border-slate-200 bg-white px-5 py-10 text-center dark:border-white/10 dark:bg-slate-900">
          <ShieldAlert className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" />
          <h2 className="mt-3 font-bold text-slate-900 dark:text-white">{t('visitor.firstAid.emptyTitle')}</h2>
          <p className="mt-2 text-sm text-slate-500">{t('visitor.firstAid.emptyDesc')}</p>
        </div>
      ) : (
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              {t('visitor.firstAid.resultsCount', { count: debouncedQuery ? visible.length : displayedTotal })}
            </h2>
            <p className="text-xs text-slate-500">
              {debouncedQuery ? t('visitor.firstAid.relevanceSort') : t('visitor.firstAid.cameroonSort')}
            </p>
          </div>
          {suggestions.length > 0 && (
            <p className="mb-3 text-xs leading-5 text-slate-500" role="status">
              {suggestions.join(' — ')}
            </p>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            {visible.map((protocol) => {
              const Icon = protocolIcon(protocol.slug)
              return (
                <Link
                  key={protocol.slug}
                  href={`/premiers-soins/${protocol.slug}`}
                  className="group grid min-h-[176px] grid-cols-[48px_minmax(0,1fr)] gap-4 border border-slate-200 bg-white p-4 transition hover:border-emerald-400 hover:shadow-sm dark:border-white/10 dark:bg-slate-900 dark:hover:border-emerald-500/50"
                >
                  <span className="flex h-12 w-12 items-center justify-center bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                    <Icon className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="font-display text-lg font-bold text-slate-950 dark:text-white">{protocol.titre}</h3>
                      <span className={`px-2 py-1 text-[10px] font-black ${urgencyStyle[protocol.niveauUrgence]}`}>
                        {protocol.niveauUrgence}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                      {protocol.etapes[0]?.instruction ?? t('visitor.firstAid.openSheet')}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <span className="inline-flex items-center gap-1.5 text-slate-500">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                        {t('visitor.firstAid.version', { version: protocol.version })}
                      </span>
                      {protocol.variantKey && protocol.variantKey !== 'STANDARD' && (
                        <span className="bg-slate-100 px-2 py-1 font-bold text-slate-600 dark:bg-white/10 dark:text-slate-200">
                          {t('visitor.firstAid.context', { variant: formatVariant(protocol.variantKey) })}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 font-bold text-emerald-700 transition group-hover:translate-x-0.5 dark:text-emerald-300">
                        {t('visitor.firstAid.open')} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
          {!debouncedQuery && (paginatedData?.totalPages ?? 1) > 1 && (
            <nav
              className="mt-6 flex flex-wrap items-center justify-center gap-2"
              aria-label={t('visitor.firstAid.paginationAria')}
            >
              <button
                type="button"
                onClick={() => changePage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="min-h-11 border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-slate-900 dark:text-white"
              >
                {t('visitor.firstAid.previous')}
              </button>
              <span className="px-3 text-sm font-semibold text-slate-600 dark:text-slate-300">
                {t('visitor.firstAid.pageOf', {
                  page: paginatedData?.page ?? page,
                  total: paginatedData?.totalPages ?? 1,
                })}
              </span>
              <button
                type="button"
                onClick={() => changePage(Math.min(paginatedData?.totalPages ?? page, page + 1))}
                disabled={page >= (paginatedData?.totalPages ?? 1)}
                className="min-h-11 border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-slate-900 dark:text-white"
              >
                {t('visitor.firstAid.next')}
              </button>
            </nav>
          )}
        </section>
      )}
    </main>
  )
}
