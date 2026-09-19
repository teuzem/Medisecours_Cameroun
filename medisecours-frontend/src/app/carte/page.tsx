'use client'

import './maps.css'
import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertCircle,
  Activity,
  Bike,
  Bell,
  Building2,
  Car,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  Clock,
  Footprints,
  Loader2,
  Layers,
  LocateFixed,
  FlaskConical,
  Hospital,
  Pill,
  Stethoscope,
  MapPin,
  Menu,
  MessageCircle,
  Navigation,
  RefreshCw,
  Route,
  Search,
  UserCircle,
  X,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import api from '../../api/axios'
import MapsPanel from '../../components/carte/MapsPanel'
import SosModal from '../../components/carte/SosModal'
import { useToast } from '../../components/ui/Toast'
import { useAuth } from '../../hooks/useAuth'
import { useGeolocation } from '../../hooks/useGeolocation'
import { useGoogleDirections } from '../../hooks/useGoogleDirections'
import { useMapProvider } from '../../hooks/useMapProvider'
import {
  useWayfinding,
  type Destination,
  type Position,
  type WayfindingMode,
} from '../../hooks/useWayfinding'
import {
  FACILITY_COLORS,
  FACILITY_TYPES,
  formatDistanceKm,
  formatDuration,
  haversineKm,
  readFavorites,
  readRecentCentres,
  writeRecentCentre,
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

const GoogleCarteMap = dynamic(() => import('../../components/carte/GoogleCarteMap'), {
  ssr: false,
  loading: () => <CarteMapLoading />,
})

const MapboxCarteMap = dynamic(() => import('../../components/carte/MapboxCarteMap'), {
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
  const { user, isAuthenticated, isMedecin, isEtablissement } = useAuth()
  const { position, error: geoError, loading: locating, locate, watch, stopWatch, isWatching } = useGeolocation()
  const { provider, state: providerState } = useMapProvider()

  const [centres, setCentres] = useState<CarteCentre[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [activeType, setActiveType] = useState<'all' | EtablissementType>('all')
  const [onlyUrgence, setOnlyUrgence] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [layersOpen, setLayersOpen] = useState(false)
  const [satellite, setSatellite] = useState(false)
  const [railOpen, setRailOpen] = useState(true)
  const categoryRef = useRef<HTMLDivElement | null>(null)
  const [panelView, setPanelView] = useState<'explore' | 'saved' | 'recent'>('explore')
  const [mode, setMode] = useState<WayfindingMode>('driving')
  const [destination, setDestination] = useState<Destination | null>(null)
  const [isTracking, setIsTracking] = useState(false)
  const [sosOpen, setSosOpen] = useState(false)
  const [favorites, setFavorites] = useState<number[]>(() => readFavorites())
  const [recentIds, setRecentIds] = useState<number[]>(() => readRecentCentres())
  const remoteFilterActive = useRef(false)
  const sharedCentreHandled = useRef(false)

  // ── Favoris (localStorage) ────────────────────────────────────────────────

  const toggleFavorite = useCallback((id: number) => {
    setFavorites((current) => {
      const next = current.includes(id) ? current.filter((f) => f !== id) : [...current, id]
      try {
        window.localStorage.setItem('medisecours_carte_favoris', JSON.stringify(next))
      } catch {
        // stockage indisponible : on ignore
      }
      if (isAuthenticated) {
        void api.request({ url: `/api/carte/saved/${id}`, method: next.includes(id) ? 'PUT' : 'DELETE' }).catch(() => {
          toast.info('Le favori reste disponible localement, mais n’a pas pu être synchronisé.')
        })
      }
      return next
    })
  }, [isAuthenticated, toast])

  useEffect(() => {
    if (!isAuthenticated) return
    api.get('/api/carte/saved').then(response => {
      const ids = Array.isArray(response.data?.ids) ? response.data.ids.map(Number).filter(Number.isInteger) : []
      if (ids.length) setFavorites(current => Array.from(new Set([...current, ...ids])))
    }).catch(() => undefined)
  }, [isAuthenticated])

  // ── Chargement des établissements ─────────────────────────────────────────
  const loadCentres = useCallback(
    (options?: { silent?: boolean }) => {
      const controller = new AbortController()
      api
        .get('/api/carte/etablissements', { params: { limit: 500 }, signal: controller.signal })
        .then((response) => {
          const items = extractCentres(response)
          setCentres(items)
        })
        .catch((requestError: any) => {
          if (requestError?.name !== 'CanceledError' && requestError?.message !== 'canceled' && !options?.silent) {
            toast.error(t('visitor.centres.loadError'))
          }
        })
        .finally(() => setLoading(false))
      return controller
    },
    [toast, t],
  )

  useEffect(() => {
    const controller = loadCentres()
    return () => controller.abort()
  }, [loadCentres])

  useEffect(() => {
    const query = searchQuery.trim()
    if (!query && activeType === 'all') {
      if (!remoteFilterActive.current) return
      remoteFilterActive.current = false
      const controller = loadCentres({ silent: true })
      return () => controller.abort()
    }
    remoteFilterActive.current = true

    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      api
        .get('/api/carte/etablissements', {
          params: {
            q: query || undefined,
            type: activeType === 'all' ? undefined : activeType,
            limit: 500,
          },
          signal: controller.signal,
        })
        .then((response) => setCentres(extractCentres(response)))
        .catch((requestError: any) => {
          if (requestError?.name !== 'CanceledError' && requestError?.message !== 'canceled') {
            toast.error(t('visitor.centres.loadError'))
          }
        })
    }, 250)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [activeType, loadCentres, searchQuery, t, toast])

  useEffect(() => {
    if (!isAuthenticated || searchQuery.trim().length < 3) return
    const timer = window.setTimeout(() => {
      void api.post('/api/carte/history', { type: 'search', query: searchQuery.trim(), metadata: { type: activeType } }).catch(() => undefined)
    }, 900)
    return () => window.clearTimeout(timer)
  }, [activeType, isAuthenticated, searchQuery])

  // ── Rafraîchissement temps réel silencieux (45 s) ────────────────────────
  // Les structures synchronisées (Google Places) apparaissent sur la carte (et
  // sur le repli Leaflet) sans action de l'utilisateur.
  useEffect(() => {
    const timer = window.setInterval(() => {
      loadCentres({ silent: true })
    }, 45_000)
    return () => window.clearInterval(timer)
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
      setDrawerOpen(true)
      setRecentIds((current) => writeRecentCentre(id, current))
      setSosOpen(false)
      setDestination(null)
    },
    [centreById],
  )

  useEffect(() => {
    if (sharedCentreHandled.current || loading) return
    const rawId = new URLSearchParams(window.location.search).get('centre')
    const id = rawId ? Number(rawId) : NaN
    if (!Number.isInteger(id) || id <= 0) {
      sharedCentreHandled.current = true
      return
    }
    const localCentre = centres.find(centre => centre.id === id)
    if (localCentre) {
      sharedCentreHandled.current = true
      handleSelect(id)
      return
    }

    const controller = new AbortController()
    api.get(`/api/centre_de_santes/${id}`, { signal: controller.signal })
      .then(response => {
        const centre = response.data as CarteCentre
        if (!centre?.id) return
        setCentres(current => current.some(item => item.id === centre.id) ? current : [...current, centre])
        handleSelect(centre.id)
      })
      .catch(() => toast.error("L'etablissement partage n'est plus disponible."))
      .finally(() => { sharedCentreHandled.current = true })
    return () => controller.abort()
  }, [centres, handleSelect, loading, toast])

  const handleBackToList = useCallback(() => {
    setSelectedId(null)
  }, [])

  const handleRequestDirections = useCallback(() => {
    const centre = selectedId != null ? centreById.get(selectedId) : null
    if (centre?.latitude != null && centre.longitude != null) {
      setDestination({ lat: centre.latitude, lng: centre.longitude, nom: centre.nom })
      if (isAuthenticated) {
        void api.post('/api/carte/history', { type: 'route', centre: centre.id, metadata: { mode } }).catch(() => undefined)
      }
    }
    if (!position) {
      toast.info(t('visitor.carte.directions.needPosition'))
      locate()
      return
    }
  }, [centreById, isAuthenticated, locate, mode, position, selectedId, t, toast])

  const clearRoute = useCallback(() => {
    setDestination(null)
  }, [])

  // ── Moteurs d'itinéraire (Google par défaut, OSRM en repli) ───────────────
  const osrmEnabled = provider !== 'google'
  const {
    route: osrmRoute,
    distance: osrmDistance,
    duration: osrmDuration,
    steps: osrmSteps,
    loading: osrmLoading,
    error: osrmError,
    isFallback: osrmIsFallback,
  } = useWayfinding({
    patientPosition: osrmEnabled ? position : null,
    destination: osrmEnabled ? destination : null,
    mode,
  })

  const {
    route: googleRoute,
    distance: googleDistance,
    duration: googleDuration,
    steps: googleSteps,
    loading: googleLoading,
    error: googleError,
    isFallback: googleIsFallback,
  } = useGoogleDirections({
    enabled: provider === 'google',
    position,
    destination,
    mode,
  })

  const route = provider === 'google' ? googleRoute : osrmRoute
  const distance = provider === 'google' ? googleDistance : osrmDistance
  const duration = provider === 'google' ? googleDuration : osrmDuration
  const steps = provider === 'google' ? googleSteps : osrmSteps
  const routeLoading = provider === 'google' ? googleLoading : osrmLoading
  const routeError = provider === 'google' ? googleError : osrmError
  const isFallback = provider === 'google' ? googleIsFallback : osrmIsFallback

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
    <div className="medisecours-map relative isolate h-dvh w-full overflow-hidden bg-slate-100 dark:bg-slate-950">
      {/* ═══ Carte plein écran (Google par défaut, Leaflet en repli) ═══ */}
      <div className="absolute inset-0 z-0">
        {provider === 'google' ? (
          <GoogleCarteMap
            satellite={satellite}
            centres={visibleCentres}
            selectedId={selectedId}
            position={position}
            onSelect={handleSelect}
            route={route}
            isFallback={isFallback}
            destination={destination}
          />
        ) : provider === 'mapbox' ? (
          <MapboxCarteMap
            satellite={satellite}
            centres={visibleCentres}
            selectedId={selectedId}
            position={position}
            onSelect={handleSelect}
            route={route}
            destination={destination}
          />
        ) : providerState === 'checking' ? (
          <CarteMapLoading />
        ) : (
          <CarteMap
            centres={visibleCentres}
            selectedId={selectedId}
            position={position}
            onSelect={handleSelect}
            route={route}
            isFallback={isFallback}
            destination={destination}
          />
        )}
      </div>

      <div className="maps-search-shell">
        <div className="pointer-events-auto flex w-full max-w-2xl items-center gap-2 rounded-full border border-slate-200 bg-white p-1.5 dark:border-white/10 dark:bg-slate-950/95">
          <button type="button" onClick={() => setMenuOpen(true)} aria-label="Ouvrir le menu" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-slate-600 hover:bg-slate-100"><Menu className="h-5 w-5" /></button>
          <input
            value={searchQuery}
            onChange={(event) => { setSearchQuery(event.target.value); setSelectedId(null); setDrawerOpen(true) }}
            type="search"
            placeholder="Rechercher un établissement ou une ville"
            className="h-11 min-w-0 flex-1 bg-transparent px-2 text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400 dark:text-white"
            aria-label="Rechercher sur la carte"
          />
          <button type="button" onClick={() => { setSelectedId(null); setDrawerOpen(true) }} title="Afficher les resultats" aria-label="Afficher les resultats" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-slate-600 hover:bg-slate-100"><Search className="h-5 w-5" /></button>
          {searchQuery && (
            <button type="button" onClick={() => setSearchQuery('')} className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10" aria-label="Effacer la recherche">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
        <div className="maps-categories-wrap">
          <button type="button" className="maps-category-arrow" onClick={() => categoryRef.current?.scrollBy({ left: -260, behavior: 'smooth' })} aria-label="Voir les categories precedentes"><ChevronLeft size={18} /></button>
          <div ref={categoryRef} className="maps-categories" aria-label="Types d'etablissement">
            {([
              ['all', 'Tous', MapPin],
              ['hopital_general', 'Hopitaux', Hospital],
              ['hopital_general', 'Regional', Hospital],
              ['hopital_general', 'General', Hospital],
              ['chu', 'Central', Hospital],
              ['hopital_de_district', 'District', Hospital],
              ['cma', 'CMA', Stethoscope],
              ['csi', 'CSI', Stethoscope],
              ['clinique_privee', 'Cliniques', Stethoscope],
              ['pharmacie', 'Pharmacies', Pill],
              ['laboratoire', 'Laboratoires', FlaskConical],
              ['centre_specialise', 'Specialises', Building2],
            ] as const).map(([type, label, Icon]) => (
              <button key={`${type}-${label}`} type="button" onClick={() => setActiveType(type as 'all' | EtablissementType)} aria-pressed={activeType === type} title={label}>
                <Icon size={16} aria-hidden="true" /><span>{label}</span>
              </button>
            ))}
          </div>
          <button type="button" className="maps-category-arrow" onClick={() => categoryRef.current?.scrollBy({ left: 260, behavior: 'smooth' })} aria-label="Voir les categories suivantes"><ChevronRight size={18} /></button>
        </div>
      {menuOpen && (
        <div className="absolute inset-0 z-[1100] bg-black/20" onClick={() => setMenuOpen(false)}>
          <aside className="maps-offcanvas" role="dialog" aria-modal="true" aria-label="Navigation" onClick={(event) => event.stopPropagation()}>
            <div className="maps-menu-brand"><div className="maps-menu-wordmark"><strong>MediSecours</strong><span>Maps Sante</span></div><button type="button" onClick={() => setMenuOpen(false)} aria-label="Fermer le menu"><X className="h-5 w-5" /></button></div>
            <button type="button" onClick={() => { setDrawerOpen(true); setMenuOpen(false) }} className="maps-menu-link"><MapPin className="h-5 w-5" />Explorer les etablissements</button>
            <nav className="flex flex-col">
              {([
                [UserCircle, 'Mon profil', isAuthenticated ? '/profil' : '/login'],
                [Stethoscope, 'Trouver un medecin', '/medecins'],
                [MessageCircle, 'Messages', '/messages'],
                [Bell, 'Notifications', '/notifications'],
                [ClipboardList, 'Mes consultations', '/patient/consultations'],
                [ClipboardList, 'Mes prescriptions', '/patient/prescriptions'],
                [Activity, 'Premiers soins', '/premiers-soins'],
                [Building2, 'Explorer les categories', '/categories'],
              ] as const).filter(([, , href]) => href === '/profil' || href === '/login' || (!isMedecin && !isEtablissement)).map(([Icon, label, href]) => <a key={href} href={href} className="maps-menu-link"><Icon className="h-5 w-5" />{label}</a>)}
            </nav>
          </aside>
        </div>
      )}

      <div className="absolute right-4 top-4 z-[710]">
        <a
          href={isAuthenticated ? '/profil' : '/login'}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-white/80 bg-white text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-950/95 dark:text-slate-200"
          aria-label={isAuthenticated ? 'Ouvrir le profil' : 'Se connecter'}
          title={user?.email || (isAuthenticated ? 'Profil' : 'Connexion')}
        >
          <UserCircle className="h-6 w-6" />
        </a>
      </div>

      <div className="maps-brand">
        <img src="/brand/medisecours-logo.png" alt="" aria-hidden="true" />
        <span>MediSecours <b>Maps</b></span>
      </div>
      {railOpen && <button type="button" className="maps-rail-close" onClick={() => setRailOpen(false)} aria-label="Fermer le panneau lateral"><Menu size={18} /></button>}
      {!railOpen && <button type="button" className="maps-rail-open" onClick={() => setRailOpen(true)} aria-label="Afficher le panneau lateral"><ChevronRight size={18} /></button>}
      <div className={`maps-layer-control ${drawerOpen ? 'maps-layer-control-open' : ''}`}>
        <button type="button" aria-expanded={layersOpen} onClick={() => setLayersOpen(current => !current)}><Layers size={24} /><span>Calques</span></button>
        {layersOpen && <div role="group" aria-label="Fond de carte">
          <button type="button" aria-pressed={!satellite || provider === 'leaflet'} onClick={() => setSatellite(false)}>Plan</button>
          <button type="button" disabled={provider !== 'google' && provider !== 'mapbox'} aria-pressed={satellite && provider !== 'leaflet'} onClick={() => setSatellite(true)}>Satellite</button>
          {provider !== 'google' && provider !== 'mapbox' && <small>Satellite indisponible avec le fond de carte actuel.</small>}
        </div>}
      </div>

      {/* ═══ État vide : aucune donnée sur la carte ═══ */}
      {!loading && centres.length === 0 && (
        <div className="maps-map-status" role="status">
            <span>{t('visitor.carte.emptyTitle')}</span>
            <button
              type="button"
              onClick={() => loadCentres()}
              className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 text-sm font-bold text-white transition hover:bg-primary-700"
            >
              <RefreshCw className="h-4 w-4" />
              {t('visitor.carte.refresh')}
            </button>
        </div>
      )}

      {/* ═══ Carte d'itinéraire flottante ═══ */}
      <AnimatePresence>
        {routeActive && !drawerOpen && position && destination && (
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
        className={`absolute bottom-40 right-3 z-[600] flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 transition xl:bottom-36 xl:right-3 ${
          isTracking ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-white text-primary-700 hover:bg-slate-100 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800'
        }`}
      >
        {locating ? <Loader2 className="h-5 w-5 animate-spin" /> : <LocateFixed className={`h-5 w-5 ${isTracking ? 'animate-pulse' : ''}`} />}
      </button>

      {/* ═══ Panneau (liste / fiche) ═══ */}
      <MapsPanel
        railOpen={railOpen}
        initialView={panelView}
        onViewChange={(view) => { setPanelView(view); setDrawerOpen(true) }}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        visibleCentres={visibleCentres}
        loading={loading}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeType={activeType}
        onlyUrgence={onlyUrgence}
        onUrgenceChange={setOnlyUrgence}
        selectedId={selectedId}
        onSelect={handleSelect}
        onBackToList={handleBackToList}
        position={position}
        favorites={favorites}
        recentIds={recentIds}
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
