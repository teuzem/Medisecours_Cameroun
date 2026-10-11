'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Building2,
  Heart,
  Loader2,
  MapPin,
  Navigation,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import useSWR from 'swr'
import { mutate as globalMutate } from 'swr'
import api from '../../../api/axios'
import { useAuth } from '../../../hooks/useAuth'
import { fetcher } from '../../../lib/fetcher'
import { ETABLISSEMENTS_KEY, FAVORIS_KEY } from '../../../lib/keys'
import { extractArray } from '../../../lib/api'
import { FACILITY_TYPES, haversineKm, type CarteCentre, type EtablissementType } from '../../../lib/carte'
import { trackInteraction } from '../../../lib/track'
import GlassCard from '../../../components/ui/GlassCard'
import SectionHeader from '../../../components/ui/SectionHeader'
import EstablishmentCard from '../../../components/patient/EstablishmentCard'

type ZoneFilter = 'ALL' | 'NEARBY' | 'FAVORITES'

export default function PatientEtablissementsPage() {
  const { t } = useTranslation()
  const { isAuthenticated } = useAuth()
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [zone, setZone] = useState<ZoneFilter>('ALL')
  const [typeFilter, setTypeFilter] = useState<EtablissementType | ''>('')
  const [regionFilter, setRegionFilter] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null)
  const [locating, setLocating] = useState(false)
  const [locError, setLocError] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [query])

  const { data: favoris, mutate: mutateFavoris } = useSWR<number[]>(isAuthenticated ? FAVORIS_KEY : null, fetcher)
  const favoriteIds = Array.isArray(favoris) ? favoris : []

  const { data, isLoading, error } = useSWR(
    `${ETABLISSEMENTS_KEY}?estActif=true${debouncedQuery ? `&nom=${encodeURIComponent(debouncedQuery)}` : ''}${typeFilter ? `&type=${typeFilter}` : ''}${regionFilter ? `&region=${encodeURIComponent(regionFilter)}` : ''}`,
    fetcher,
  )

  const allCentres = useMemo(() => extractArray(data as any) as CarteCentre[], [data])

  const regions = useMemo(() => {
    const set = new Set<string>()
    for (const c of allCentres) if (c.region) set.add(c.region)
    return Array.from(set).sort()
  }, [allCentres])

  const withDistance = useMemo(() => {
    if (!position) return allCentres
    return allCentres
      .map((c) => {
        const km = haversineKm(position, { lat: c.latitude, lng: c.longitude })
        return km != null ? { ...c, distance: km } : c
      })
      .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))
  }, [allCentres, position])

  const visible = useMemo(() => {
    let list = withDistance
    if (zone === 'NEARBY' && position) list = list.filter((c) => c.distance != null && c.distance <= 25)
    if (zone === 'FAVORITES') list = list.filter((c) => favoriteIds.includes(c.id))
    return list
  }, [withDistance, zone, position, favoriteIds])

  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setLocError(true)
      return
    }
    setLocating(true)
    setLocError(false)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocating(false)
        setZone('NEARBY')
      },
      () => {
        setLocError(true)
        setLocating(false)
      },
      { enableHighAccuracy: false, timeout: 8000 },
    )
  }, [])

  const toggleFavorite = useCallback(
    async (id: number) => {
      if (!isAuthenticated) return
      const isFav = favoriteIds.includes(id)
      try {
        if (isFav) await api.delete(`/api/carte/saved/${id}`)
        else {
          await api.put(`/api/carte/saved/${id}`)
          trackInteraction(id, 'sauvegarde')
        }
        await mutateFavoris()
        void globalMutate((key) => typeof key === 'string' && key.startsWith('/api/centre_de_santes'), undefined, { revalidate: false })
      } catch {
        // silencieux
      }
    },
    [isAuthenticated, favoriteIds, mutateFavoris],
  )

  const zones: { key: ZoneFilter; label: string; icon: any }[] = [
    { key: 'ALL', label: t('patient.etablissements.filterAll'), icon: Building2 },
    { key: 'NEARBY', label: t('patient.etablissements.filterNearby'), icon: Navigation },
    { key: 'FAVORITES', label: t('patient.etablissements.filterFavorites'), icon: Heart },
  ]

  return (
    <div className="mx-auto w-full max-w-5xl min-w-0 px-3 py-6 sm:px-6">
      <SectionHeader title={t('patient.etablissements.title')} description={t('patient.etablissements.subtitle')} />

      {/* Search + zones */}
      <GlassCard className="mt-4 p-4">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('patient.etablissements.searchPlaceholder')}
              aria-label={t('patient.etablissements.searchPlaceholder')}
              className="min-h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-8 text-xs text-slate-800 outline-none transition focus:border-primary-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Effacer"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition ${
              showFilters || typeFilter || regionFilter
                ? 'border-primary-400 bg-primary-50 text-primary-700 dark:border-primary-500/40 dark:bg-primary-500/10 dark:text-mint-200'
                : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-900'
            }`}
            aria-label={t('patient.etablissements.typeFilter')}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {zones.map((z) => (
            <button
              key={z.key}
              type="button"
              onClick={() => {
                setZone(z.key)
                if (z.key === 'NEARBY' && !position) locate()
              }}
              aria-pressed={zone === z.key}
              className={`inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold transition ${
                zone === z.key
                  ? 'bg-primary-900 text-white dark:bg-white dark:text-primary-900'
                  : 'border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900'
              }`}
            >
              <z.icon className="h-3.5 w-3.5" aria-hidden="true" />
              {z.label}
            </button>
          ))}
          {locating && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" aria-label={t('patient.etablissements.geolocationLoading')} />}
          {locError && <span className="text-[11px] text-amber-600 dark:text-amber-400">{t('patient.etablissements.geolocationDenied')}</span>}
        </div>

        {showFilters && (
          <div className="mt-3 grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2 dark:border-slate-800">
            <label className="block">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{t('patient.etablissements.typeFilter')}</span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as EtablissementType | '')}
                className="mt-1.5 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="">{t('patient.etablissements.filterAll')}</option>
                {FACILITY_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`visitor.carte.type.${type}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{t('patient.etablissements.regionFilter')}</span>
              <select
                value={regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
                className="mt-1.5 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="">{t('patient.etablissements.filterAll')}</option>
                {regions.map((region) => (
                  <option key={region} value={region}>
                    {region}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        <p className="mt-3 text-[11px] text-slate-400" aria-live="polite">
          {t('patient.etablissements.resultsCount', { count: visible.length })}
        </p>
      </GlassCard>

      {/* Results */}
      {error ? (
        <GlassCard className="mt-4 p-8 text-center">
          <p className="text-xs font-bold text-slate-600 dark:text-slate-300">{t('patient.etablissements.loadError')}</p>
        </GlassCard>
      ) : isLoading ? (
        <div className="mt-6 flex items-center justify-center gap-2 py-10 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          <span className="text-xs">{t('patient.etablissements.loadError')}</span>
        </div>
      ) : visible.length === 0 ? (
        <GlassCard className="mt-4 p-8 text-center">
          <MapPin className="mx-auto h-6 w-6 text-slate-300 dark:text-slate-600" aria-hidden="true" />
          <p className="mt-2 text-xs font-bold text-slate-600 dark:text-slate-300">{t('patient.etablissements.emptyTitle')}</p>
          <p className="mt-1 text-[11px] text-slate-400">{t('patient.etablissements.emptyDesc')}</p>
        </GlassCard>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((centre) => (
            <EstablishmentCard
              key={centre.id}
              centre={centre}
              isFavorite={favoriteIds.includes(centre.id)}
              onToggleFavorite={isAuthenticated ? toggleFavorite : undefined}
              showDistance={Boolean(position)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
