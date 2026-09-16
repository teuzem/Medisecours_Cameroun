'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertCircle,
  Car,
  Clock,
  Eye,
  Footprints,
  Loader2,
  LocateFixed,
  MapPin,
  Navigation,
  PanelLeftClose,
  PanelLeftOpen,
  Phone,
  Route,
  Search,
  X,
} from 'lucide-react'
import api from '../../api/axios'
import EmptyState from '../../components/ui/EmptyState'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'
import { useTranslation } from 'react-i18next'
import { useGeolocation } from '../../hooks/useGeolocation'
import { useWayfinding } from '../../hooks/useWayfinding'
import { imgUrl } from '../../lib/config'

function CentresMapLoading() {
  const { t } = useTranslation()
  return (
    <div className="flex h-full w-full items-center justify-center">
      <LoadingSpinner label={t('visitor.centres.mapLoading')} />
    </div>
  )
}

const CentresMap = dynamic(() => import('../../components/CentresMap'), {
  ssr: false,
  loading: () => <CentresMapLoading />,
})

type TravelMode = 'driving' | 'walking'

interface Destination {
  lat: number
  lng: number
  nom: string
}

interface Centre {
  id: number
  nom: string
  adresse?: string
  ville?: string
  region?: string
  telephone?: string
  horaires?: string
  type_centre?: string
  latitude?: number
  longitude?: number
  photo?: string
  imageUrl?: string
  photos?: string[] | string
  images?: string[] | string
  services?: string[] | string
  capacite_lits?: number
}

function extractArray(response: { data?: unknown }): Centre[] {
  const data = response.data as {
    'hydra:member'?: unknown
    member?: unknown
  } | undefined
  const raw = data?.['hydra:member'] ?? data?.member ?? response.data
  return Array.isArray(raw) ? raw as Centre[] : []
}

function distanceKm(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
) {
  const earthRadius = 6371
  const latitudeDelta = ((to.lat - from.lat) * Math.PI) / 180
  const longitudeDelta = ((to.lng - from.lng) * Math.PI) / 180
  const latitudeFrom = (from.lat * Math.PI) / 180
  const latitudeTo = (to.lat * Math.PI) / 180
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitudeFrom) *
      Math.cos(latitudeTo) *
      Math.sin(longitudeDelta / 2) ** 2

  return earthRadius * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
}

function formatDuration(seconds: number | null) {
  if (!seconds) return '–'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.round((seconds % 3600) / 60)
  return hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`
}

function getCentrePhoto(centre: Centre) {
  if (centre.photo) return centre.photo
  if (centre.imageUrl) return centre.imageUrl
  if (Array.isArray(centre.photos)) return centre.photos[0] || null
  if (typeof centre.photos === 'string') return centre.photos.split(',')[0]?.trim() || null
  return null
}

function getCentrePhotos(centre: Centre) {
  const source = centre.photos ?? centre.images ?? centre.imageUrl ?? centre.photo
  if (!source) return []
  const photos = Array.isArray(source) ? source : String(source).split(',')
  return photos.map((photo) => String(photo).trim()).filter(Boolean)
}

export default function CentresPage() {
  const { t } = useTranslation()
  const [centres, setCentres] = useState<Centre[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<number | null>(null)
  const [mode, setMode] = useState<TravelMode>('driving')
  const [destination, setDestination] = useState<Destination | null>(null)
  const [isTracking, setIsTracking] = useState(false)
  const [previewCentre, setPreviewCentre] = useState<Centre | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const { position, error, loading: locating, locate, watch, stopWatch, isWatching } = useGeolocation()
  const toast = useToast()
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const desktopQuery = window.matchMedia('(min-width: 1024px)')
    const syncSidebar = (event?: MediaQueryListEvent) => {
      setSidebarOpen(event ? event.matches : desktopQuery.matches)
    }

    syncSidebar()
    desktopQuery.addEventListener('change', syncSidebar)
    return () => desktopQuery.removeEventListener('change', syncSidebar)
  }, [])

  useEffect(() => {
    if (isTracking) watch()
    else stopWatch()
  }, [isTracking, stopWatch, watch])

  const {
    route,
    distance,
    duration,
    loading: routeLoading,
    error: routeError,
    isFallback,
    clear: clearRoute,
  } = useWayfinding({
    patientPosition: position,
    destination,
    mode,
  })

  const fetchAllCentres = useCallback(() => {
    const controller = new AbortController()
    api.get('/api/centre_de_santes', { signal: controller.signal })
      .then((response) => setCentres(extractArray(response)))
      .catch((requestError) => {
        if (requestError.name !== 'CanceledError' && requestError.message !== 'canceled') {
          toast.error(t('visitor.centres.loadError'))
        }
      })
      .finally(() => setLoading(false))
    return controller
  }, [toast, t])

  const fetchNearbyCentres = useCallback((coordinates: { lat: number; lng: number }) => {
    const controller = new AbortController()
    api.get('/api/centres_de_santes/proches', {
      params: { lat: coordinates.lat, lng: coordinates.lng, rayon: 25, limit: 20 },
      signal: controller.signal,
    })
      .then((response) => {
        const nearbyCentres = extractArray(response)
        if (nearbyCentres.length > 0) setCentres(nearbyCentres)
      })
      .catch((requestError) => {
        if (requestError.name !== 'CanceledError' && requestError.message !== 'canceled') {
          toast.error(t('visitor.centres.nearbyError'))
        }
      })
    return controller
  }, [toast, t])

  useEffect(() => {
    const controller = fetchAllCentres()
    return () => controller.abort()
  }, [fetchAllCentres])

  const hasFetchedNearbyRef = useRef(false)

  useEffect(() => {
    if (!position || destination || hasFetchedNearbyRef.current) return
    hasFetchedNearbyRef.current = true
    const controller = fetchNearbyCentres(position)
    return () => controller.abort()
  }, [destination, fetchNearbyCentres, position])

  const distancesMap = useMemo(() => {
    const distances = new Map<number, number>()
    if (!position) return distances

    centres.forEach((centre) => {
      if (centre.latitude == null || centre.longitude == null) return
      distances.set(
        centre.id,
        distanceKm(position, { lat: centre.latitude, lng: centre.longitude }),
      )
    })
    return distances
  }, [centres, position])

  const sortedCentres = useMemo(() => {
    if (!position) return centres
    return [...centres].sort(
      (first, second) =>
        (distancesMap.get(first.id) ?? Number.MAX_VALUE) -
        (distancesMap.get(second.id) ?? Number.MAX_VALUE),
    )
  }, [centres, distancesMap, position])

  const visibleCentres = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase('fr')
    if (!normalizedQuery) return sortedCentres

    return sortedCentres.filter((centre) =>
      [
        centre.nom,
        centre.adresse,
        centre.ville,
        centre.region,
        centre.type_centre,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLocaleLowerCase('fr').includes(normalizedQuery),
        ),
    )
  }, [searchQuery, sortedCentres])

  const clearAll = useCallback(() => {
    setSelected(null)
    setDestination(null)
    clearRoute()
    setIsTracking(false)
    fetchAllCentres()
  }, [clearRoute, fetchAllCentres])

  const handleSelectCentre = useCallback((centreId: number) => {
    setSidebarOpen(true)

    if (selected === centreId) {
      clearAll()
      return
    }

    setSelected(centreId)
    const centre = sortedCentres.find((item) => item.id === centreId)
    if (centre?.latitude != null && centre.longitude != null) {
      setDestination({
        lat: centre.latitude,
        lng: centre.longitude,
        nom: centre.nom,
      })
    }
  }, [clearAll, selected, sortedCentres])

  useEffect(() => {
    if (!selected || !listRef.current) return
    listRef.current
      .querySelector(`[data-id="${selected}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [selected])

  const handleLocate = () => {
    if (selected) {
      setIsTracking(true)
      return
    }
    if (position) fetchNearbyCentres(position)
    locate()
  }

  return (
    <div className="relative isolate h-[calc(100dvh-76px)] min-h-[520px] w-full overflow-hidden bg-slate-100 xl:h-[calc(100dvh-96px)] dark:bg-slate-950">
      <div className="absolute inset-0 z-0">
        <CentresMap
          centres={visibleCentres}
          position={position || undefined}
          onSelect={handleSelectCentre}
          route={route}
          isFallback={isFallback}
          destination={destination}
        />
      </div>

      <AnimatePresence>
        {sidebarOpen && (
          <motion.button
            type="button"
            aria-label={t('visitor.centres.closePanel')}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="absolute inset-0 z-[650] bg-slate-950/25 backdrop-blur-[1px] lg:hidden"
          />
        )}
      </AnimatePresence>

      <aside
        aria-label={t('visitor.centres.title')}
        className={`absolute inset-y-0 left-0 z-[700] flex w-[min(90vw,410px)] flex-col border-r border-slate-200/90 bg-white/96 shadow-[14px_0_40px_rgba(15,23,42,0.18)] backdrop-blur-xl transition-transform duration-300 ease-out lg:w-[410px] dark:border-white/10 dark:bg-slate-950/96 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="shrink-0 border-b border-slate-200 px-4 pb-4 pt-5 dark:border-white/10 sm:px-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-mint-600 dark:text-mint-400">
                {t('visitor.centres.eyebrow')}
              </p>
              <h1 className="mt-1 font-display text-2xl font-bold text-slate-950 dark:text-white">
                {t('visitor.centres.title')}
              </h1>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                {t('visitor.centres.subtitle')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-100 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              aria-label={t('visitor.centres.closePanel')}
              title={t('visitor.centres.closePanel')}
            >
              <PanelLeftClose className="h-5 w-5" />
            </button>
          </div>

          <label className="relative mt-4 block">
            <span className="sr-only">{t('visitor.centres.searchSrOnly')}</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              type="search"
              placeholder={t('visitor.centres.searchPlaceholder')}
              className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-9 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 dark:border-white/10 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
                aria-label={t('visitor.centres.clearSearch')}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </label>

          <button
            type="button"
            onClick={handleLocate}
            disabled={locating}
            aria-busy={locating}
            className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-primary-700 disabled:cursor-wait disabled:opacity-60"
          >
            {locating
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <LocateFixed className="h-4 w-4" />
            }
            {locating ? t('visitor.centres.locating') : (isWatching ? t('visitor.centres.tracking') : t('visitor.centres.locateMe'))}
          </button>

          {error && (
            <p className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs leading-5 text-red-700 dark:bg-red-500/10 dark:text-red-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </p>
          )}

          {position && selected && (
            <div className="mt-3 flex items-center gap-2" aria-label={t('visitor.centres.travelMode')}>
              {(['driving', 'walking'] as TravelMode[]).map((travelMode) => (
                <button
                  key={travelMode}
                  type="button"
                  onClick={() => setMode(travelMode)}
                  aria-pressed={mode === travelMode}
                  className={`flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg border px-3 text-xs font-bold transition ${
                    mode === travelMode
                      ? 'border-primary-600 bg-primary-600 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  {travelMode === 'driving'
                    ? <><Car className="h-4 w-4" /> {t('visitor.centres.driving')}</>
                    : <><Footprints className="h-4 w-4" /> {t('visitor.centres.walking')}</>
                  }
                </button>
              ))}
            </div>
          )}

          <AnimatePresence initial={false}>
            {destination && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                className="overflow-hidden"
              >
                <div
                  className="rounded-lg border border-primary-200 bg-primary-50 p-3 dark:border-primary-700 dark:bg-primary-900/40"
                  aria-label={t('visitor.centres.routeTo', { name: destination.nom })}
                >
                  {routeLoading ? (
                    <p className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t('visitor.centres.routeCalculating')}
                    </p>
                  ) : routeError && !route ? (
                    <p className="flex items-start gap-2 text-xs text-red-600 dark:text-red-300">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      {routeError}
                    </p>
                  ) : route ? (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <p className="flex min-w-0 items-start gap-2 text-sm font-bold text-primary-900 dark:text-white">
                          <Navigation className="mt-0.5 h-4 w-4 shrink-0 text-primary-600 dark:text-mint-400" />
                          <span className="line-clamp-2">{destination.nom}</span>
                        </p>
                        <button
                          type="button"
                          onClick={clearAll}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-white hover:text-red-600 dark:hover:bg-white/10 dark:hover:text-red-300"
                          aria-label={t('visitor.centres.clearRoute')}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-600 dark:text-slate-300">
                        <span className="flex items-center gap-1">
                          <Route className="h-4 w-4" />
                          {distance ? (distance / 1000).toFixed(1) : '–'} km
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {formatDuration(duration)}
                        </span>
                        {isFallback && (
                          <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                            {t('visitor.centres.approximateRoute')}
                          </span>
                        )}
                      </div>
                    </>
                  ) : null}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-white/10 sm:px-5">
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
              {loading
                ? t('visitor.centres.searching')
                : t('visitor.centres.centresCount', { count: visibleCentres.length })
              }
            </p>
            {position && (
              <span className="text-[11px] font-semibold text-mint-700 dark:text-mint-400">
                {t('visitor.centres.byDistance')}
              </span>
            )}
          </div>

          <div
            ref={listRef}
            className="min-h-0 flex-1 touch-pan-y space-y-3 overflow-y-auto overscroll-contain px-3 py-3 pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))] sm:px-4 lg:pb-5"
          >
            {loading ? (
              <div className="py-10">
                <LoadingSpinner label={t('visitor.centres.loadingCentres')} />
              </div>
            ) : visibleCentres.length === 0 ? (
              <div className="py-8">
                <EmptyState
                  title={searchQuery ? t('visitor.centres.noResultTitle') : t('visitor.centres.noCentreTitle')}
                  description={searchQuery
                    ? t('visitor.centres.noResultDesc')
                    : t('visitor.centres.noCentreDesc')
                  }
                />
              </div>
            ) : (
              visibleCentres.map((centre) => {
                const centreDistance = distancesMap.get(centre.id)
                const isSelected = selected === centre.id
                const hasCoordinates = centre.latitude != null && centre.longitude != null
                const photo = getCentrePhoto(centre)

                return (
                  <article
                    key={centre.id}
                    data-id={centre.id}
                    onClick={() => handleSelectCentre(centre.id)}
                    className={`cursor-pointer rounded-lg border p-3 transition ${
                      isSelected
                        ? 'border-mint-500 bg-mint-50 shadow-[0_8px_24px_rgba(16,185,129,0.12)] dark:bg-mint-500/10'
                        : 'border-slate-200 bg-white hover:border-primary-300 hover:shadow-md dark:border-white/10 dark:bg-slate-900 dark:hover:border-primary-500/50'
                    }`}
                  >
                    {photo && (
                      <div className="mb-3 h-28 w-full overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800">
                        <img
                          src={imgUrl(photo) || photo}
                          alt={centre.nom}
                          className="h-full w-full object-cover"
                          onError={(event) => {
                            const parent = (event.target as HTMLImageElement).parentElement
                            if (parent) parent.style.display = 'none'
                          }}
                        />
                      </div>
                    )}

                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="line-clamp-2 text-sm font-bold text-slate-950 dark:text-white">
                          {centre.nom}
                        </h2>
                        <p className="mt-1 flex items-start gap-1.5 text-xs leading-5 text-slate-500 dark:text-slate-400">
                          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span>{centre.adresse || centre.ville || t('visitor.centres.addressUnknown')}</span>
                        </p>
                      </div>
                      {centreDistance != null && (
                        <span className="shrink-0 rounded-full bg-mint-100 px-2 py-1 text-[10px] font-bold text-mint-800 dark:bg-mint-500/15 dark:text-mint-300">
                          {centreDistance.toFixed(1)} km
                        </span>
                      )}
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          setPreviewCentre(centre)
                        }}
                        className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        {t('common.details')}
                      </button>
                      {centre.telephone && (
                        <a
                          href={`tel:${centre.telephone}`}
                          onClick={(event) => event.stopPropagation()}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-mint-700 transition hover:bg-mint-50 dark:border-white/10 dark:bg-slate-800 dark:text-mint-400 dark:hover:bg-slate-700"
                          aria-label={t('visitor.centres.callAria', { name: centre.nom })}
                          title={t('visitor.centres.callTitle')}
                        >
                          <Phone className="h-4 w-4" />
                        </a>
                      )}
                      {position && hasCoordinates && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            handleSelectCentre(centre.id)
                          }}
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition ${
                            isSelected
                              ? 'border-mint-600 bg-mint-600 text-white'
                              : 'border-slate-200 bg-white text-primary-600 hover:bg-primary-50 dark:border-white/10 dark:bg-slate-800 dark:text-primary-300 dark:hover:bg-slate-700'
                          }`}
                          aria-label={isSelected ? t('visitor.centres.routeActive') : t('visitor.centres.routeTo', { name: centre.nom })}
                          title={isSelected ? t('visitor.centres.routeActive') : t('visitor.centres.routeTitle')}
                        >
                          <Navigation className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </article>
                )
              })
            )}
          </div>
        </div>
      </aside>

      {!sidebarOpen && (
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="absolute left-3 top-3 z-[600] inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/80 bg-white/95 px-4 text-sm font-bold text-slate-800 shadow-xl backdrop-blur-md transition hover:bg-white dark:border-white/15 dark:bg-slate-950/95 dark:text-white dark:hover:bg-slate-900 lg:left-5 lg:top-5"
          aria-label={t('visitor.centres.openList')}
        >
          <PanelLeftOpen className="h-5 w-5" />
          <span>{t('visitor.nav.centres')}</span>
          {!loading && (
            <span className="rounded-full bg-primary-100 px-2 py-0.5 text-[10px] text-primary-700 dark:bg-primary-500/20 dark:text-primary-200">
              {visibleCentres.length}
            </span>
          )}
        </button>
      )}

      {position && (
        <button
          type="button"
          onClick={() => setIsTracking(!isTracking)}
          className={`absolute bottom-24 right-3 z-[600] inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-xs font-bold text-white shadow-xl transition lg:bottom-5 lg:right-5 ${
            isTracking
              ? 'bg-red-600 hover:bg-red-700'
              : 'bg-primary-600 hover:bg-primary-700'
          }`}
        >
          <LocateFixed className={`h-4 w-4 ${isTracking ? 'animate-pulse' : ''}`} />
          {isTracking ? t('visitor.centres.stopTracking') : t('visitor.centres.trackPosition')}
        </button>
      )}

      <Modal
        isOpen={Boolean(previewCentre)}
        onClose={() => setPreviewCentre(null)}
        title={t('visitor.centres.modalTitle')}
      >
        {previewCentre && (
          <div className="space-y-4">
            {getCentrePhoto(previewCentre) && (
              <div className="h-48 w-full overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
                <img
                  src={imgUrl(getCentrePhoto(previewCentre)!) || getCentrePhoto(previewCentre)!}
                  alt={previewCentre.nom}
                  className="h-full w-full object-cover"
                />
              </div>
            )}

            <div>
              <h2 className="font-display text-xl font-bold text-slate-950 dark:text-white">
                {previewCentre.nom}
              </h2>
              <p className="mt-1 text-sm font-semibold text-primary-600 dark:text-primary-300">
                {previewCentre.type_centre || t('visitor.centres.typeDefault')}
              </p>
            </div>

            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-900">
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary-500" />
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{t('visitor.centres.addressLabel')}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    {previewCentre.adresse || t('visitor.centres.addressMissing')}
                    {(previewCentre.ville || previewCentre.region) && (
                      <>
                        <br />
                        {[previewCentre.ville, previewCentre.region].filter(Boolean).join(', ')}
                      </>
                    )}
                  </p>
                </div>
              </div>

              {previewCentre.telephone && (
                <div className="flex items-start gap-3">
                  <Phone className="mt-0.5 h-5 w-5 shrink-0 text-primary-500" />
                  <div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{t('visitor.centres.phoneLabel')}</p>
                    <a
                      href={`tel:${previewCentre.telephone}`}
                      className="text-sm font-semibold text-mint-700 hover:underline dark:text-mint-400"
                    >
                      {previewCentre.telephone}
                    </a>
                  </div>
                </div>
              )}

              {previewCentre.horaires && (
                <div className="flex items-start gap-3">
                  <Clock className="mt-0.5 h-5 w-5 shrink-0 text-primary-500" />
                  <div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{t('visitor.centres.hoursLabel')}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">{previewCentre.horaires}</p>
                  </div>
                </div>
              )}
            </div>

            {previewCentre.capacite_lits != null && (
              <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3 dark:border-white/10">
                <span className="text-sm text-slate-600 dark:text-slate-300">{t('visitor.centres.bedCapacity')}</span>
                <span className="font-bold text-slate-950 dark:text-white">{previewCentre.capacite_lits}</span>
              </div>
            )}

            {previewCentre.services && (
              <div>
                <p className="mb-2 text-sm font-bold text-slate-800 dark:text-slate-100">
                  {t('visitor.centres.servicesLabel')}
                </p>
                <div className="flex flex-wrap gap-2">
                  {(Array.isArray(previewCentre.services)
                    ? previewCentre.services
                    : previewCentre.services.split(',')
                  ).map((service) => (
                    <span
                      key={service}
                      className="rounded-full bg-primary-100 px-2.5 py-1 text-xs font-semibold text-primary-700 dark:bg-primary-500/15 dark:text-primary-200"
                    >
                      {service.trim()}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {getCentrePhotos(previewCentre).length > 1 && (
              <div>
                <p className="mb-2 text-sm font-bold text-slate-800 dark:text-slate-100">
                  {t('visitor.centres.photosLabel')}
                </p>
                <div className="flex snap-x gap-3 overflow-x-auto pb-2">
                  {getCentrePhotos(previewCentre).map((photo, index) => (
                    <img
                      key={`${photo}-${index}`}
                      src={imgUrl(photo) || photo}
                      alt={t('visitor.centres.photoAlt', { number: index + 1, name: previewCentre.nom })}
                      className="h-32 w-48 shrink-0 snap-start rounded-lg border border-slate-200 object-cover dark:border-white/10"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
