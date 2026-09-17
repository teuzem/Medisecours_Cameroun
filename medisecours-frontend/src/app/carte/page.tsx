'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertCircle,
  Bike,
  Car,
  Clock,
  Footprints,
  Loader2,
  LocateFixed,
  MapPin,
  Navigation,
  Phone,
  Route,
  X,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import api from '../../api/axios'
import EtablissementDrawer from '../../components/carte/EtablissementDrawer'
import SosModal from '../../components/carte/SosModal'
import { useToast } from '../../components/ui/Toast'
import { useGeolocation } from '../../hooks/useGeolocation'
import {
  useWayfinding,
  type Destination,
  type Position,
  type WayfindingMode,
} from '../../hooks/useWayfinding'
import {
  formatDistanceKm,
  formatDuration,
  haversineKm,
  readFavorites,
  WAYFINDING_MODES,
  type CarteCentre,
  type EtablissementType,
} from '../../lib/carte'

function CarteMapLoading() {
  const { t } = useTranslation()
  return (
    <div className="flex h-full w-full items-center justify-center bg-slate-100 dark:bg-slate-950">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin text-primary-500" />
        {t('visitor.carte.mapLoading')}
      </div>
    </div>
  )
}

const CarteMap = dynamic(() => import('../../components/carte/CarteMap'), {
  ssr: false,
  loading: () => <CarteMapLoading />,
})

function extractCentres(response: { data?: unknown }): CarteCentre[] {
  const data = response.data as {
    'hydra:member'?: unknown
    member?: unknown
  } | undefined
  const raw = data?.['hydra:member'] ?? data?.member ?? response.data
  return Array.isArray(raw) ? (raw as CarteCentre[]) : []
}

const MODE_META: Record<WayfindingMode, { icon: typeof Car; key: string }> = {
  driving: { icon: Car, key: 'visitor.carte.directions.driving' },
  walking: { icon: Footprints, key: 'visitor.carte.directions.walking' },
  bicycling: { icon: Bike, key: 'visitor.carte.directions.bicycling' },
}

export default function CartePage() {
  const { t } = useTranslation()
  const toast = useToast()
  const { position, error: geoError, loading: locating, locate, watch, stopWatch, isWatching } = useGeolocation()

  const [centres, setCentres] = useState<CarteCentre[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [activeType, setActiveType] = useState<'all' | EtablissementType>('all')
  const [onlyUrgence, setOnlyUrgence] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [drawerOpen, setDrawerOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(min-width: 1280px)').matches
  })
  const [mode, setMode] = useState<WayfindingMode>('driving')
  const [destination, setDestination] = useState<Destination | null>(null)
  const [isTracking, setIsTracking] = useState(false)
  const [sosOpen, setSosOpen] = useState(false)
  const [favorites, setFavorites] = useState<number[]>(() => readFavorites())

  // ── Favoris (localStorage) ────────────────────────────────────────────────

  const toggleFavorite = useCallback((id: number) => {
    setFavorites((current) => {
      const next = current.includes(id) ? current.filter((f) => f !== id) : [...current, id]
      try {
        window.localStorage.setItem('medisecours_carte_favoris', JSON.stringify(next))
      } catch {
        // stockage indisponible : on ignore
      }
      return next
    })
  }, [])

  // ── Chargement des établissements ─────────────────────────────────────────
  const loadCentres = useCallback(() => {
    const controller = new AbortController()
    api
      .get('/api/carte/etablissements', { params: { limit: 500 }, signal: controller.signal })
      .then((response) => {
        const items = extractCentres(response)
        setCentres(items)
      })
      .catch((requestError: any) => {
        if (requestError?.name !== 'CanceledError' && requestError?.message !== 'canceled') {
          toast.error(t('visitor.centres.loadError'))
        }
      })
      .finally(() => setLoading(false))
    return controller
  }, [toast, t])

  useEffect(() => {
    const controller = loadCentres()
    return () => controller.abort()
  }, [loadCentres])

  // ── Suivi GPS continu ─────────────────────────────────────────────────────
  useEffect(() => {
    if (isTracking) watch()
    else stopWatch()
  }, [isTracking, watch, stopWatch])

  const handleLocate = useCallback(() => {
    if (isTracking) {
      setIsTracking(false)
      return
    }
    setIsTracking(true)
    locate()
  }, [isTracking, locate])

  // ── Sélection + itinéraire ────────────────────────────────────────────────
  const centreById = useMemo(() => {
    const map = new Map<number, CarteCentre>()
    centres.forEach((c) => map.set(c.id, c))
    return map
  }, [centres])

  const handleSelect = useCallback(
    (id: number) => {
      setSelectedId(id)
      setSosOpen(false)
      const centre = centreById.get(id)
      if (centre?.latitude != null && centre.longitude != null) {
        setDestination({ lat: centre.latitude, lng: centre.longitude, nom: centre.nom })
      }
    },
    [centreById],
  )

  const handleBackToList = useCallback(() => {
    setSelectedId(null)
  }, [])

  const handleRequestDirections = useCallback(() => {
    if (!position) {
      toast.info(t('visitor.carte.directions.needPosition'))
      locate()
      return
    }
    const centre = selectedId != null ? centreById.get(selectedId) : null
    if (centre?.latitude != null && centre.longitude != null) {
      setDestination({ lat: centre.latitude, lng: centre.longitude, nom: centre.nom })
    }
  }, [centreById, locate, position, selectedId, t, toast])

  const clearRoute = useCallback(() => {
    setDestination(null)
  }, [])

  const {
    route,
    distance,
    duration,
    steps,
    loading: routeLoading,
    error: routeError,
    isFallback,
  } = useWayfinding({
    patientPosition: position,
    destination,
    mode,
  })

  // ── Filtrage + tri ────────────────────────────────────────────────────────
  const visibleCentres = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase('fr')
    let result = centres
    if (activeType !== 'all') {
      result = result.filter((c) => c.type === activeType)
    }
    if (onlyUrgence) {
      result = result.filter((c) => c.urgences24h)
    }
    if (normalizedQuery) {
      result = result.filter((c) =>
        [c.nom, c.adresse, c.ville, c.region, c.quartier]
          .filter(Boolean)
          .some((value) => String(value).toLocaleLowerCase('fr').includes(normalizedQuery)),
      )
    }
    if (position) {
      result = [...result].sort(
        (a, b) =>
          (haversineKm(position, a) ?? Number.MAX_VALUE) -
          (haversineKm(position, b) ?? Number.MAX_VALUE),
      )
    }
    return result
  }, [activeType, centres, onlyUrgence, position, searchQuery])

  const routeActive = Boolean(position && destination)

  return (
    <div className="relative isolate h-[calc(100dvh-76px)] min-h-[520px] w-full overflow-hidden bg-slate-100 xl:h-[calc(100dvh-96px)] dark:bg-slate-950">
      {/* ═══ Carte plein écran ═══ */}
      <div className="absolute inset-0 z-0">
        <CarteMap
          centres={visibleCentres}
          selectedId={selectedId}
          position={position}
          onSelect={handleSelect}
          route={route}
          isFallback={isFallback}
          destination={destination}
        />
      </div>

      {/* ═══ Bouton flottant de recherche (drawer fermé) ═══ */}
      {!drawerOpen && (
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="absolute left-3 top-3 z-[600] inline-flex min-h-12 items-center gap-2 rounded-full border border-white/80 bg-white/95 px-4 text-sm font-bold text-slate-800 shadow-xl backdrop-blur-md transition hover:bg-white dark:border-white/15 dark:bg-slate-950/95 dark:text-white dark:hover:bg-slate-900"
          aria-label={t('visitor.carte.searchSrOnly')}
        >
          <MapPin className="h-4 w-4 text-primary-500" />
          <span className="max-w-40 truncate">
            {searchQuery || t('visitor.carte.searchPlaceholder')}
          </span>
          <span className="rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-bold text-primary-700 dark:bg-primary-500/20 dark:text-primary-200">
            {visibleCentres.length}
          </span>
        </button>
      )}

      {/* ═══ Carte d'itinéraire flottante ═══ */}
      <AnimatePresence>
        {routeActive && position && destination && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="absolute bottom-24 left-3 right-3 z-[600] max-w-md rounded-2xl border border-white/80 bg-white/95 p-3 shadow-2xl backdrop-blur-md dark:border-white/15 dark:bg-slate-950/95 xl:bottom-4 xl:left-4"
            aria-label={t('visitor.carte.routeCard.to', { name: destination.nom })}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <Navigation className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" />
                <p className="line-clamp-2 text-sm font-bold text-slate-900 dark:text-white">
                  {destination.nom}
                </p>
              </div>
              <button
                type="button"
                onClick={clearRoute}
                aria-label={t('visitor.carte.routeCard.clear')}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-red-600 dark:hover:bg-white/10 dark:hover:text-red-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modes de déplacement */}
            <div className="mt-2 flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-white/5">
              {WAYFINDING_MODES.map((m) => {
                const Meta = MODE_META[m]
                const Icon = Meta.icon
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    aria-pressed={mode === m}
                    className={`flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition ${
                      mode === m
                        ? 'bg-white text-primary-700 shadow-sm dark:bg-slate-800 dark:text-white'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {t(Meta.key)}
                  </button>
                )
              })}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-600 dark:text-slate-300">
              {routeLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('visitor.carte.directions.calculating')}
                </span>
              ) : route ? (
                <>
                  <span className="flex items-center gap-1.5">
                    <Route className="h-4 w-4 text-primary-500" />
                    {formatDistanceKm(distance ? distance / 1000 : null)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-primary-500" />
                    {formatDuration(duration)}
                  </span>
                  {steps.length > 0 && <span className="text-slate-400">{steps.length} étapes</span>}
                  {isFallback && (
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                      {t('visitor.carte.directions.approx')}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-red-600 dark:text-red-300">{routeError}</span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ FAB localisation ═══ */}
      <button
        type="button"
        onClick={handleLocate}
        disabled={locating && !position}
        aria-busy={locating}
        aria-label={isTracking ? t('visitor.carte.stopTracking') : t('visitor.carte.locateMe')}
        className={`absolute bottom-24 right-3 z-[600] flex h-12 w-12 items-center justify-center rounded-2xl shadow-xl transition xl:bottom-5 xl:right-[448px] ${
          isTracking ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-white text-primary-700 hover:bg-slate-100 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800'
        }`}
      >
        {locating ? <Loader2 className="h-5 w-5 animate-spin" /> : <LocateFixed className={`h-5 w-5 ${isTracking ? 'animate-pulse' : ''}`} />}
      </button>

      {/* ═══ FAB SOS ═══ */}
      <button
        type="button"
        onClick={() => setSosOpen(true)}
        aria-label={t('visitor.carte.sosFabAria')}
        className="absolute bottom-[7.5rem] right-3 z-[600] flex h-14 w-14 items-center justify-center gap-1.5 rounded-full bg-red-600 text-sm font-bold text-white shadow-[0_10px_24px_rgba(220,38,38,0.45)] transition hover:bg-red-700 xl:bottom-24 xl:right-[448px]"
      >
        <Phone className="h-6 w-6" />
      </button>

      {/* ═══ Panneau (liste / fiche) ═══ */}
      <EtablissementDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        visibleCentres={visibleCentres}
        loading={loading}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeType={activeType}
        onTypeChange={setActiveType}
        onlyUrgence={onlyUrgence}
        onUrgenceChange={setOnlyUrgence}
        selectedId={selectedId}
        onSelect={handleSelect}
        onBackToList={handleBackToList}
        position={position}
        favorites={favorites}
        onToggleFavorite={toggleFavorite}
        onSosClick={() => setSosOpen(true)}
        onRequestDirections={handleRequestDirections}
        mode={mode}
        onModeChange={setMode}
        distance={distance}
        duration={duration}
        steps={steps}
        routeLoading={routeLoading}
        routeError={routeError}
        isFallback={isFallback}
        routeActive={routeActive}
        onClearRoute={clearRoute}
      />

      {/* ═══ État géolocalisation (erreur) ═══ */}
      {geoError && !position && (
        <p className="absolute bottom-24 left-3 z-[600] flex max-w-64 items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs leading-5 text-red-700 shadow-lg dark:bg-red-500/10 dark:text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {geoError}
        </p>
      )}

      <SosModal
        open={sosOpen}
        onClose={() => setSosOpen(false)}
        position={position}
        onLocate={() => locate()}
      />
    </div>
  )
}