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
  Bookmark,
  Building2,
  Briefcase,
  Car,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  Clock,
  Database,
  Footprints,
  Home,
  Crosshair,
  Layers,
  Loader2,
  LocateFixed,
  FlaskConical,
  HelpCircle,
  History,
  Languages,
  Hospital,
  Pill,
  Printer,
  School,
  Share2,
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
import { useWebSocket } from '../../hooks/useWebSocket'
import { usePhotoSrc } from '../../hooks/usePhotoSrc'
import { mutate } from 'swr'
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

type BasemapMode = 'plan' | 'satellite' | 'relief'
type PlaceKey = 'home' | 'work' | 'school'

interface SavedPlace {
  label: string
  lat?: number
  lng?: number
}

const BASEMAP_STORAGE_KEY = 'medisecours_carte_basemap'
const QUERIES_STORAGE_KEY = 'medisecours_carte_queries'
const PLACES_STORAGE_KEY = 'medisecours_carte_places'

const TYPE_ICONS: Record<string, typeof Car> = {
  all: MapPin,
  hopital_general: Hospital,
  hopital_central: Hospital,
  hopital_regional: Hospital,
  hopital_de_district: Hospital,
  hopital: Hospital,
  chu: Hospital,
  cma: Stethoscope,
  dispensaire: Stethoscope,
  csi: Stethoscope,
  clinique_privee: Stethoscope,
  polyclinique: Stethoscope,
  cabinet_medical: Stethoscope,
  centre_de_sante: Stethoscope,
  pharmacie: Pill,
  laboratoire: FlaskConical,
  centre_specialise: Building2,
}

const PLACE_META: Record<PlaceKey, { icon: typeof Home; labelKey: string }> = {
  home: { icon: Home, labelKey: 'visitor.carte.searchPanel.home' },
  work: { icon: Briefcase, labelKey: 'visitor.carte.searchPanel.work' },
  school: { icon: School, labelKey: 'visitor.carte.searchPanel.school' },
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // stockage indisponible
  }
}

/**
 * Vignettes des fonds de carte : les trois fonds (satellite/plan/relief)
 * affichent une vraie tuile centrée sur Yaoundé (niveau ville, rues
 * visibles — cohérent avec les vignettes Google Maps), servie par les mêmes
 * fournisseurs que la carte elle-même (Esri World Imagery, Esri World Street
 * Map, OpenTopoMap — tous sans clé API) — qualité professionnelle, aucun
 * asset tierce copié. Les superpositions (trafic/transports/vélo) restent
 * des pictogrammes SVG mini-cartes car aucun fournisseur gratuit ne sert
 * de tuiles d'overlay.
 */
const THUMB_TILE_PARAMS = { z: 11, x: 1089, y: 1001 } as const

function BasemapThumb({ mode }: { mode: BasemapMode | 'traffic' | 'transit' | 'cycling' }) {
  const common = { width: 64, height: 44, viewBox: '0 0 64 44', 'aria-hidden': true as const }
  const { z, x, y } = THUMB_TILE_PARAMS
  if (mode === 'satellite') {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- tuile carte externe dynamique (hors remotePatterns)
      <img
        src={`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`}
        alt=""
        width={64}
        height={44}
        loading="lazy"
        decoding="async"
        style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
      />
    )
  }
  if (mode === 'plan') {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- tuile carte externe dynamique (hors remotePatterns)
      <img
        src={`https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${z}/${y}/${x}`}
        alt=""
        width={64}
        height={44}
        loading="lazy"
        decoding="async"
        style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
      />
    )
  }
  if (mode === 'relief') {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- tuile carte externe dynamique (hors remotePatterns)
      <img
        src={`https://a.tile.opentopomap.org/${z}/${x}/${y}.png`}
        alt=""
        width={64}
        height={44}
        loading="lazy"
        decoding="async"
        style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
      />
    )
  }
  if (mode === 'traffic') {
    return (
      <svg {...common}>
        <rect width="64" height="44" fill="#f1f3f4" />
        <path d="M0 22 H64" stroke="#dadce0" strokeWidth="8" />
        <path d="M0 22 H24" stroke="#34a853" strokeWidth="5" />
        <path d="M24 22 H44" stroke="#fbbc04" strokeWidth="5" />
        <path d="M44 22 H64" stroke="#ea4335" strokeWidth="5" />
        <path d="M32 0 V44" stroke="#dadce0" strokeWidth="6" />
      </svg>
    )
  }
  if (mode === 'transit') {
    return (
      <svg {...common}>
        <rect width="64" height="44" fill="#e8eaed" />
        <path d="M0 12 H64 M0 32 H64 M14 0 V44 M46 0 V44" stroke="#fff" strokeWidth="4" />
        <path d="M4 36 L22 22 L44 26 L60 10" stroke="#1a73e8" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="22" cy="22" r="3" fill="#1a73e8" stroke="#fff" strokeWidth="1.5" />
        <circle cx="44" cy="26" r="3" fill="#1a73e8" stroke="#fff" strokeWidth="1.5" />
        <circle cx="60" cy="10" r="3" fill="#1a73e8" stroke="#fff" strokeWidth="1.5" />
      </svg>
    )
  }
  if (mode === 'cycling') {
    return (
      <svg {...common}>
        <rect width="64" height="44" fill="#e6f4ea" />
        <path d="M0 10 H64 M0 34 H64 M20 0 V44 M48 0 V44" stroke="#fff" strokeWidth="4" />
        <path d="M4 32 Q18 12 34 22 T60 12" stroke="#34a853" strokeWidth="3" fill="none" strokeDasharray="7 4" strokeLinecap="round" />
        <circle cx="26" cy="32" r="4.5" fill="#fff" stroke="#34a853" strokeWidth="2" />
        <circle cx="42" cy="32" r="4.5" fill="#fff" stroke="#34a853" strokeWidth="2" />
        <path d="M26 32 L32 21 L42 32 M32 21 L37 21" stroke="#34a853" strokeWidth="2" fill="none" strokeLinecap="round" />
      </svg>
    )
  }
  return null
}

export default function CartePage() {
  const { t } = useTranslation()
  const toast = useToast()
  const { user, token, isAuthenticated, isMedecin, isEtablissement, updateUser } = useAuth()
  const { position, accuracy, isManual, setManualPosition, clearManualPosition, error: geoError, loading: locating, locate, watch, stopWatch, isWatching } = useGeolocation()
  const { provider, state: providerState } = useMapProvider()

  // Avatar du profil connecté (téléversé ou avatar Google) : s’affiche en
  // haut à droite de la carte et se met à jour en temps réel.
  const profilePhoto = usePhotoSrc(user?.photoProfil ?? null)

  // La session peut porter une copie figée de l'utilisateur (photo choisie
  // après la connexion, avatar Google récupéré plus tard). On relit la photo
  // courante pour que l'avatar soit exact, pas l'initiale.
  useEffect(() => {
    if (!isAuthenticated) return
    if (user?.photoProfil) return
    let cancelled = false
    api
      .get<{ photoProfil?: string | null }>('/api/profile/photo')
      .then(({ data }) => {
        if (cancelled || !data?.photoProfil) return
        updateUser({ ...user, photoProfil: data.photoProfil })
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [isAuthenticated, user?.photoProfil, user, updateUser])

  // Avatar temps réel : dès qu'un utilisateur change de photo (téléversée ou
  // issue de son compte Google), les médias qu'il a publiés sur la carte
  // portent la nouvelle image sans rechargement.
  useWebSocket(user?.id || '', token || '', {
    onProfilePhotoChanged: (payload: { userId?: string; photoProfil?: string | null }) => {
      const changedId = payload?.userId ? String(payload.userId) : null
      const photo = typeof payload?.photoProfil === 'string' && payload.photoProfil ? payload.photoProfil : null
      if (!changedId || !photo) return

      setCentres((current) =>
        current.map((centre) => {
          if (!centre.images?.some((media) => String(media.uploadedBy?.id) === changedId)) return centre
          return {
            ...centre,
            images: centre.images.map((media) =>
              String(media.uploadedBy?.id) === changedId
                ? {
                    ...media,
                    uploadedByPhoto: photo,
                    uploadedBy: media.uploadedBy ? { ...media.uploadedBy, photo } : media.uploadedBy,
                  }
                : media,
            ),
          }
        }),
      )
      // Rafraîchit le contexte auth pour que le bouton profil (et toute
      // lecture de user.photoProfil) reflète immédiatement la nouvelle photo,
      // même si elle a été uploadée après la connexion.
      if (changedId === String(user?.id)) {
        updateUser({ ...user, photoProfil: photo })
      }
      // Les avis affichent l'avatar de leur auteur : on les revalide pour que
      // la nouvelle photo y apparaisse sans rechargement.
      void mutate((key) => typeof key === 'string' && key.includes('/avis'))
    },
  }, user?.roles?.[0])

  const [centres, setCentres] = useState<CarteCentre[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [activeType, setActiveType] = useState<'all' | EtablissementType>('all')
  const [onlyUrgence, setOnlyUrgence] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [layersOpen, setLayersOpen] = useState(false)
  const [railOpen, setRailOpen] = useState(true)
  // Mode « préciser ma position » : toucher la carte place le point exact
  // (quartier réel) quand le GPS du navigateur est faux.
  const [pickingPosition, setPickingPosition] = useState(false)
  const categoryRef = useRef<HTMLDivElement | null>(null)
  // Vrai uniquement après une demande explicite : évite la bannière d'erreur
  // au chargement quand la permission est refusée d'emblée.
  const [locationRequested, setLocationRequested] = useState(false)
  const [panelView, setPanelView] = useState<'explore' | 'saved' | 'recent'>('explore')
  const [mode, setMode] = useState<WayfindingMode>('driving')
  const [destination, setDestination] = useState<Destination | null>(null)
  const [isTracking, setIsTracking] = useState(false)
  const [sosOpen, setSosOpen] = useState(false)
  const [sosEtablissement, setSosEtablissement] = useState<{ id: number; nom: string } | null>(null)
  const [favorites, setFavorites] = useState<number[]>(() => readFavorites())
  const [recentIds, setRecentIds] = useState<number[]>(() => readRecentCentres())
  const [basemap, setBasemap] = useState<BasemapMode>(() => {
    if (typeof window === 'undefined') return 'plan'
    const stored = window.localStorage.getItem(BASEMAP_STORAGE_KEY)
    return stored === 'plan' || stored === 'satellite' || stored === 'relief' ? stored : 'plan'
  })
  const [trafficOn, setTrafficOn] = useState(false)
  const [transitOn, setTransitOn] = useState(false)
  const [cyclingOn, setCyclingOn] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQueries, setSearchQueries] = useState<string[]>(() =>
    typeof window === 'undefined' ? [] : readJson<string[]>(QUERIES_STORAGE_KEY, []),
  )
  const [savedPlaces, setSavedPlaces] = useState<Partial<Record<PlaceKey, SavedPlace>>>(() =>
    typeof window === 'undefined' ? {} : readJson<Partial<Record<PlaceKey, SavedPlace>>>(PLACES_STORAGE_KEY, {}),
  )
  const [editingPlace, setEditingPlace] = useState<PlaceKey | null>(null)
  const [placeDraft, setPlaceDraft] = useState('')
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number } | null>(null)
  const remoteFilterActive = useRef(false)
  const sharedCentreHandled = useRef(false)
  const searchShellRef = useRef<HTMLDivElement | null>(null)

  // ── Préférences locales : fond de carte persisté ──────────────────────────
  useEffect(() => {
    window.localStorage.setItem(BASEMAP_STORAGE_KEY, basemap)
  }, [basemap])

  useEffect(() => {
    if (!searchOpen) return
    const handlePointerDown = (event: MouseEvent) => {
      if (!searchShellRef.current?.contains(event.target as Node)) {
        setSearchOpen(false)
        setEditingPlace(null)
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [searchOpen])

  const pushSearchQuery = useCallback((query: string) => {
    const trimmed = query.trim()
    if (trimmed.length < 2) return
    setSearchQueries((current) => {
      const next = [trimmed, ...current.filter((item) => item !== trimmed)].slice(0, 8)
      writeJson(QUERIES_STORAGE_KEY, next)
      return next
    })
  }, [])

  const savePlace = useCallback((key: PlaceKey) => {
    const label = placeDraft.trim()
    if (!label && !position) {
      toast.info(t('visitor.carte.searchPanel.addressPlaceholder'))
      return
    }
    const entry: SavedPlace = {
      label: label || `${position!.lat.toFixed(4)}, ${position!.lng.toFixed(4)}`,
      lat: position?.lat,
      lng: position?.lng,
    }
    setSavedPlaces((current) => {
      const next = { ...current, [key]: entry }
      writeJson(PLACES_STORAGE_KEY, next)
      return next
    })
    setEditingPlace(null)
    setPlaceDraft('')
    if (entry.lat != null && entry.lng != null) {
      setFlyTarget({ lat: entry.lat, lng: entry.lng })
    }
  }, [placeDraft, position, t, toast])

  const shareMap = useCallback(async () => {
    const url = window.location.href
    try {
      if (navigator.share) await navigator.share({ title: 'MediSecours Maps', text: t('visitor.carte.shareMapText'), url })
      else { await navigator.clipboard.writeText(url); toast.success(t('visitor.carte.toastMapCopied')) }
    } catch (cause) {
      if ((cause as Error).name !== 'AbortError') toast.error(t('visitor.carte.toastShareUnavailable'))
    }
  }, [t, toast])

  const sharePosition = useCallback(async () => {
    if (!position) {
      locate()
      toast.info(t('visitor.carte.toastShareNeedLocation'))
      return
    }
    const url = `https://www.google.com/maps?q=${position.lat},${position.lng}`
    try {
      if (navigator.share) await navigator.share({ title: t('visitor.carte.sharePositionTitle'), text: t('visitor.carte.sharePositionText'), url })
      else { await navigator.clipboard.writeText(url); toast.success(t('visitor.carte.toastPositionCopied')) }
    } catch (cause) {
      if ((cause as Error).name !== 'AbortError') toast.error(t('visitor.carte.toastPositionShareUnavailable'))
    }
  }, [locate, position, t, toast])

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
          toast.info(t('visitor.carte.savedOffline'))
        })
      }
      return next
    })
  }, [isAuthenticated, toast, t])

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
    setLocationRequested(true)
    // Retour au GPS live : abandonne un éventuel point placé manuellement.
    clearManualPosition()
    setPickingPosition(false)
    locate()
  }, [isTracking, locate, clearManualPosition])

  // ── Vue initiale : ville GPS de l'utilisateur (façon Google Maps) ───────
  // Un seul fix frais au chargement, sans suivi continu : les moteurs volent
  // vers la ville exacte (zoom 13, tous les établissements visibles).
  // En cas de refus, la vue Cameroun reste affichée.
  const initialLocateDoneRef = useRef(false)
  useEffect(() => {
    if (initialLocateDoneRef.current) return
    initialLocateDoneRef.current = true
    locate()
  }, [locate])

  // Point exact touché sur la carte : devient la position effective
  // (marqueur, distances, itinéraire, SOS) jusqu'à restauration du GPS.
  const handlePickPosition = useCallback((point: { lat: number; lng: number }) => {
    setManualPosition(point)
    setPickingPosition(false)
    toast.success(t('visitor.carte.positionAdjusted'))
  }, [setManualPosition, t, toast])

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
    [],
  )

  useEffect(() => {
    if (selectedId == null) return
    const selectedCentre = centres.find((centre) => centre.id === selectedId)
    if (!selectedCentre?.nom) return
    // Keep the visible search term synchronized with the selected place.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearchQuery((current) => current === selectedCentre.nom ? current : selectedCentre.nom)
  }, [centres, selectedId])

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
      // Selecting a shared place synchronizes the external URL with local map state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
      .catch(() => toast.error(t('visitor.carte.sharedCentreMissing')))
      .finally(() => { sharedCentreHandled.current = true })
    return () => controller.abort()
  }, [centres, handleSelect, loading, t, toast])

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
    // Itinéraire actif : fermer le panneau de recherche pour une visibilité totale.
    setSearchOpen(false)
    if (!position) {
      toast.info(t('visitor.carte.directions.needPosition'))
      locate()
      return
    }
  }, [centreById, isAuthenticated, locate, mode, position, selectedId, t, toast])

  const handleMarkerDirections = useCallback((id: number) => {
    const centre = centreById.get(id)
    if (!centre) return
    setSelectedId(id)
    setDrawerOpen(false)
    setRecentIds((current) => writeRecentCentre(id, current))
    if (centre.latitude != null && centre.longitude != null) {
      setDestination({ lat: centre.latitude, lng: centre.longitude, nom: centre.nom })
      if (isAuthenticated) {
        void api.post('/api/carte/history', { type: 'route', centre: centre.id, metadata: { mode, source: 'marker-preview' } }).catch(() => undefined)
      }
    }
    // Itinéraire actif : fermer le panneau de recherche pour une visibilité totale.
    setSearchOpen(false)
    if (!position) {
      toast.info(t('visitor.carte.directions.needPosition'))
      locate()
    }
  }, [centreById, isAuthenticated, locate, mode, position, t, toast])

  const clearRoute = useCallback(() => {
    setDestination(null)
  }, [])

  // ── Moteurs d'itinéraire ────────────────────────────────────────────────
  // Google par défaut (voiture/marche), OSRM/FOSSGIS pour le vélo et en repli.
  // Le profil vélo n'existe pas chez Google Directions au Cameroun
  // (ZERO_RESULTS systématique) : le vélo passe toujours par le routeur
  // OSRM bike (FOSSGIS), quel que soit le moteur de carte actif. Le moteur
  // Google affiche la polyligne GeoJSON retournée comme les autres.
  const googleRouting = provider === 'google' && mode !== 'bicycling'

  const {
    route: osrmRoute,
    distance: osrmDistance,
    duration: osrmDuration,
    steps: osrmSteps,
    loading: osrmLoading,
    error: osrmError,
    isFallback: osrmIsFallback,
  } = useWayfinding({
    patientPosition: googleRouting ? null : position,
    destination: googleRouting ? null : destination,
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
    enabled: googleRouting,
    position,
    destination,
    mode,
  })

  const route = googleRouting ? googleRoute : osrmRoute
  const distance = googleRouting ? googleDistance : osrmDistance
  const duration = googleRouting ? googleDuration : osrmDuration
  const steps = googleRouting ? googleSteps : osrmSteps
  const routeLoading = googleRouting ? googleLoading : osrmLoading
  const routeError = googleRouting ? googleError : osrmError
  const isFallback = googleRouting ? googleIsFallback : osrmIsFallback

  // ── Filtrage + tri ────────────────────────────────────────────────────────
  const byRating = useCallback((a: CarteCentre, b: CarteCentre) => {
    const noteDiff = (b.noteMoyenne ?? 0) - (a.noteMoyenne ?? 0)
    if (noteDiff !== 0) return noteDiff
    const avisDiff = (b.totalAvis ?? 0) - (a.totalAvis ?? 0)
    if (avisDiff !== 0) return avisDiff
    return a.nom.localeCompare(b.nom, 'fr')
  }, [])

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
      result = [...result].sort(byRating)
    } else if (position) {
      result = [...result].sort(
        (a, b) =>
          (haversineKm(position, a) ?? Number.MAX_VALUE) -
          (haversineKm(position, b) ?? Number.MAX_VALUE),
      )
    }
    return result
  }, [activeType, byRating, centres, onlyUrgence, position, searchQuery])

  // Suggestions d'autocomplétion temps réel (les mieux notées d'abord).
  const suggestions = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase('fr')
    if (normalizedQuery.length < 2) return []
    return centres
      .filter((c) =>
        [c.nom, c.adresse, c.ville, c.quartier]
          .filter(Boolean)
          .some((value) => String(value).toLocaleLowerCase('fr').includes(normalizedQuery)),
      )
      .sort(byRating)
      .slice(0, 8)
  }, [byRating, centres, searchQuery])

  const selectSuggestion = useCallback((centre: CarteCentre) => {
    pushSearchQuery(centre.nom)
    setSearchOpen(false)
    handleSelect(centre.id)
  }, [handleSelect, pushSearchQuery])

  const routeActive = Boolean(position && destination)

  return (
    <div className={`medisecours-map relative isolate h-dvh w-full overflow-hidden bg-slate-100 dark:bg-slate-950${drawerOpen ? ' medisecours-map--fiche-open' : ''}${pickingPosition ? ' medisecours-map--picking' : ''}${routeActive ? ' medisecours-map--route-active' : ''}`}>
      {/* ═══ Carte plein écran (Google par défaut, Leaflet en repli) ═══ */}
      <div className="absolute inset-0 z-0">
        {provider === 'google' ? (
          <GoogleCarteMap
            basemap={basemap}
            traffic={trafficOn}
            transit={transitOn}
            cycling={cyclingOn}
            centres={visibleCentres}
            selectedId={selectedId}
            position={position}
            picking={pickingPosition}
            onPickPosition={handlePickPosition}
            flyTo={flyTarget}
            onSelect={handleSelect}
            onRequestDirections={handleMarkerDirections}
            onToggleFavorite={toggleFavorite}
            favoriteIds={favorites}
            route={route}
            isFallback={isFallback}
            destination={destination}
          />
        ) : provider === 'mapbox' ? (
          <MapboxCarteMap
            basemap={basemap}
            centres={visibleCentres}
            selectedId={selectedId}
            position={position}
            picking={pickingPosition}
            onPickPosition={handlePickPosition}
            flyTo={flyTarget}
            onSelect={handleSelect}
            onRequestDirections={handleMarkerDirections}
            onToggleFavorite={toggleFavorite}
            favoriteIds={favorites}
            route={route}
            isFallback={isFallback}
            destination={destination}
          />
        ) : providerState === 'checking' ? (
          <CarteMapLoading />
        ) : (
          <CarteMap
            basemap={basemap}
            centres={visibleCentres}
            selectedId={selectedId}
            position={position}
            accuracy={accuracy}
            picking={pickingPosition}
            onPickPosition={handlePickPosition}
            flyTo={flyTarget}
            onSelect={handleSelect}
            onRequestDirections={handleMarkerDirections}
            onToggleFavorite={toggleFavorite}
            favoriteIds={favorites}
            route={route}
            isFallback={isFallback}
            destination={destination}
          />
        )}
      </div>

      <div className="maps-search-shell" ref={searchShellRef}>
        <div className="pointer-events-auto flex w-full max-w-2xl items-center gap-2 bg-transparent px-1 py-1">
          <button type="button" onClick={() => setMenuOpen(true)} aria-expanded={menuOpen} aria-controls="maps-navigation-menu" aria-label={t('visitor.carte.menuOpen')} className="maps-search-menu-button grid h-10 w-10 shrink-0 place-items-center rounded text-slate-600 hover:bg-slate-100"><Menu className="h-5 w-5" /></button>
          <input
            value={searchQuery}
            onChange={(event) => { setSearchQuery(event.target.value); setSelectedId(null); setSearchOpen(true) }}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && suggestions[0]) {
                event.preventDefault()
                selectSuggestion(suggestions[0])
              } else if (event.key === 'Escape') {
                setSearchOpen(false)
              }
            }}
            type="search"
            placeholder={t('visitor.carte.searchPlaceholder')}
            className="h-11 min-w-0 flex-1 bg-transparent px-2 text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400 dark:text-white"
            aria-label={t('visitor.carte.searchAria')}
            role="combobox"
            aria-expanded={searchOpen}
            aria-controls="maps-search-suggestions"
          />
          <button type="button" onClick={() => { setSelectedId(null); setDrawerOpen(true); setSearchOpen(true) }} title={t('visitor.carte.showResults')} aria-label={t('visitor.carte.showResults')} className="grid h-10 w-10 shrink-0 place-items-center rounded text-slate-600 hover:bg-slate-100"><Search className="h-5 w-5" /></button>
          {(searchQuery || selectedId != null) && (
            <button
              type="button"
              onClick={() => {
                // Fiche ouverte : la croix ferme la fiche (et la sélection),
                // pas seulement la recherche. Sinon elle se contente de
                // vider le champ.
                setSearchQuery('')
                if (selectedId != null) {
                  setSelectedId(null)
                  setDrawerOpen(false)
                }
              }}
              className="flex h-9 w-9 items-center justify-center rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
              aria-label={selectedId != null ? t('visitor.carte.ariaCloseFiche') : t('visitor.carte.clearSearch')}
              title={selectedId != null ? t('visitor.carte.ariaCloseFiche') : t('visitor.carte.clearSearch')}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {searchOpen && (
          <div id="maps-search-suggestions" className="maps-search-dropdown pointer-events-auto" role="listbox" aria-label={t('visitor.carte.searchAria')}>
            {searchQuery.trim().length < 2 ? (
              <>
                {savedPlaces.home || savedPlaces.work || savedPlaces.school || editingPlace ? (
                  <div className="maps-search-section">
                    <p className="maps-search-section-title">{t('visitor.carte.searchPanel.savedPlaces')}</p>
                    {(Object.keys(PLACE_META) as PlaceKey[]).map((key) => {
                      const Meta = PLACE_META[key]
                      const Icon = Meta.icon
                      const place = savedPlaces[key]
                      if (!place && editingPlace !== key) return null
                      if (editingPlace === key) {
                        return (
                          <div key={key} className="maps-search-place-edit">
                            <div className="maps-search-place-edit-field">
                              <Icon className="h-4 w-4 shrink-0 text-primary-600" />
                              <input
                                value={placeDraft}
                                onChange={(event) => setPlaceDraft(event.target.value)}
                                placeholder={t('visitor.carte.searchPanel.addressPlaceholder')}
                                autoFocus
                              />
                            </div>
                            <div className="maps-search-place-edit-actions">
                              <button type="button" onClick={() => { if (position) { savePlace(key) } else { locate(); toast.info(t('visitor.carte.searchPanel.useMyPosition')) } }} className="maps-search-link">{t('visitor.carte.searchPanel.useMyPosition')}</button>
                              <button type="button" onClick={() => savePlace(key)} className="maps-search-link">{t('visitor.carte.searchPanel.save')}</button>
                              <button type="button" onClick={() => { setEditingPlace(null); setPlaceDraft('') }} className="maps-search-muted">{t('visitor.carte.searchPanel.cancel')}</button>
                            </div>
                          </div>
                        )
                      }
                      return (
                        <button
                          key={key}
                          type="button"
                          className="maps-search-row"
                          onClick={() => {
                            if (place?.lat != null && place.lng != null) {
                              setFlyTarget({ lat: place.lat, lng: place.lng })
                              setSearchOpen(false)
                            } else {
                              setEditingPlace(key)
                              setPlaceDraft(place?.label ?? '')
                            }
                          }}
                        >
                          <Icon className="h-4 w-4 shrink-0 text-primary-600" />
                          <span className="min-w-0 flex-1 text-left text-sm font-semibold text-slate-800 dark:text-slate-100">{t(Meta.labelKey)}</span>
                          <span className="max-w-40 truncate text-xs text-slate-500">{place?.label}</span>
                          <span className="maps-search-link" onClick={(event) => { event.stopPropagation(); setEditingPlace(key); setPlaceDraft(place?.label ?? '') }}>{place ? t('visitor.carte.searchPanel.editPlace') : t('visitor.carte.searchPanel.setPlace')}</span>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <button type="button" className="maps-search-row" onClick={() => setEditingPlace('home')}>
                    <Home className="h-4 w-4 shrink-0 text-primary-600" />
                    <span className="min-w-0 flex-1 text-left text-sm font-semibold text-slate-800 dark:text-slate-100">{t('visitor.carte.searchPanel.home')}</span>
                    <span className="maps-search-link">{t('visitor.carte.searchPanel.setPlace')}</span>
                  </button>
                )}

                {searchQueries.length > 0 && (
                  <div className="maps-search-section">
                    <div className="flex items-center justify-between">
                      <p className="maps-search-section-title">{t('visitor.carte.searchPanel.history')}</p>
                      <button
                        type="button"
                        className="maps-search-muted"
                        onClick={() => { setSearchQueries([]); writeJson(QUERIES_STORAGE_KEY, []) }}
                      >
                        {t('visitor.carte.searchPanel.clearHistory')}
                      </button>
                    </div>
                    {searchQueries.map((query) => (
                      <button key={query} type="button" className="maps-search-row" onClick={() => { setSearchQuery(query); setSearchOpen(false) }}>
                        <History className="h-4 w-4 shrink-0 text-slate-400" />
                        <span className="min-w-0 flex-1 truncate text-left text-sm text-slate-700 dark:text-slate-200">{query}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="maps-search-section">
                <p className="maps-search-section-title">{t('visitor.carte.searchPanel.suggestions')}</p>
                {suggestions.length === 0 && (
                  <p className="px-3 py-2 text-xs text-slate-400">{t('visitor.carte.noResultDesc')}</p>
                )}
                {suggestions.map((centre) => {
                  const Icon = TYPE_ICONS[centre.type] ?? MapPin
                  return (
                    <button key={centre.id} type="button" className="maps-search-row" onClick={() => selectSuggestion(centre)}>
                      <Icon className="h-4 w-4 shrink-0" style={{ color: FACILITY_COLORS[centre.type] ?? '#64748B' }} />
                      <span className="min-w-0 flex-1 text-left">
                        <span className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{centre.nom}</span>
                        <span className="block truncate text-xs text-slate-500">{[centre.quartier, centre.ville].filter(Boolean).join(', ') || centre.adresse}</span>
                      </span>
                      {centre.noteMoyenne != null && centre.noteMoyenne > 0 && (
                        <span className="shrink-0 text-xs font-semibold text-amber-600">★ {centre.noteMoyenne.toFixed(1)}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
        <div className="maps-categories-wrap">
          <button type="button" className="maps-category-arrow" onClick={() => categoryRef.current?.scrollBy({ left: -260, behavior: 'smooth' })} aria-label={t('visitor.carte.prevCategories')}><ChevronLeft size={18} /></button>
          <div ref={categoryRef} className="maps-categories" aria-label={t('visitor.carte.categoriesAria')}>
            {(['all', ...FACILITY_TYPES] as const).map((type) => {
              const Icon = TYPE_ICONS[type] ?? MapPin
              const label = t(`visitor.carte.type.${type}`)
              return (
                <button key={type} type="button" onClick={() => setActiveType(type as 'all' | EtablissementType)} aria-pressed={activeType === type} title={label}>
                  <Icon size={16} aria-hidden="true" /><span>{label}</span>
                </button>
              )
            })}
          </div>
          <button type="button" className="maps-category-arrow" onClick={() => categoryRef.current?.scrollBy({ left: 260, behavior: 'smooth' })} aria-label={t('visitor.carte.nextCategories')}><ChevronRight size={18} /></button>
        </div>
      {menuOpen && (
        <div className="absolute inset-0 z-[1100] bg-black/20" onClick={() => setMenuOpen(false)}>
          <aside id="maps-navigation-menu" className="maps-offcanvas" role="dialog" aria-modal="true" aria-label={t('visitor.nav.carte')} onClick={(event) => event.stopPropagation()}>
            <div className="maps-menu-brand"><div className="maps-menu-wordmark"><strong>MediSecours</strong><span>{t('visitor.carte.menuBrandSubtitle')}</span></div><button type="button" onClick={() => setMenuOpen(false)} aria-label={t('visitor.carte.menuClose')}><X className="h-5 w-5" /></button></div>
            <div className="maps-menu-top-actions">
              <button type="button" onClick={() => { setRailOpen(true); setMenuOpen(false) }} className="maps-menu-link"><Menu className="h-5 w-5" />{t('visitor.carte.menuPanel')}</button>
              <button type="button" onClick={() => { setDrawerOpen(true); setPanelView('explore'); setMenuOpen(false) }} className="maps-menu-link"><MapPin className="h-5 w-5" />{t('visitor.carte.menuExplore')}</button>
            </div>
            <button type="button" onClick={() => { setDrawerOpen(true); setPanelView('saved'); setMenuOpen(false) }} className="maps-menu-link"><Bookmark className="h-5 w-5" />{t('visitor.carte.menuSaved')}</button>
            <button type="button" onClick={() => { setDrawerOpen(true); setPanelView('recent'); setMenuOpen(false) }} className="maps-menu-link"><History className="h-5 w-5" />{t('visitor.carte.menuRecent')}</button>
            <button type="button" onClick={() => { setDrawerOpen(true); setMenuOpen(false); toast.info(t('visitor.carte.contributionsHint')) }} className="maps-menu-link"><MessageCircle className="h-5 w-5" />{t('visitor.carte.menuContributions')}</button>
            <button type="button" onClick={() => { void sharePosition(); setMenuOpen(false) }} className="maps-menu-link"><LocateFixed className="h-5 w-5" />{t('visitor.carte.menuSharePosition')}</button>
            <button type="button" onClick={() => { setDrawerOpen(true); setPanelView('recent'); setMenuOpen(false) }} className="maps-menu-link"><Route className="h-5 w-5" />{t('visitor.carte.menuRoutes')}</button>
            <a href={isAuthenticated ? '/profil' : '/login'} onClick={() => setMenuOpen(false)} className="maps-menu-link"><Database className="h-5 w-5" />{t('visitor.carte.menuYourData')}</a>
            <button type="button" onClick={() => { void shareMap(); setMenuOpen(false) }} className="maps-menu-link"><Share2 className="h-5 w-5" />{t('visitor.carte.menuShareMap')}</button>
            <button type="button" onClick={() => { window.print(); setMenuOpen(false) }} className="maps-menu-link"><Printer className="h-5 w-5" />{t('visitor.carte.menuPrint')}</button>
            <button type="button" onClick={() => { setLocationRequested(true); void locate(); setMenuOpen(false) }} className="maps-menu-link"><LocateFixed className="h-5 w-5" />{t('visitor.carte.menuLocate')}</button>
             <a href="/guide-utilisation" onClick={() => setMenuOpen(false)} className="maps-menu-link"><HelpCircle className="h-5 w-5" />{t('visitor.carte.menuHelp')}</a>
            <button type="button" onClick={() => { toast.info(t('visitor.carte.languageHint')); setMenuOpen(false) }} className="maps-menu-link"><Languages className="h-5 w-5" />{t('visitor.carte.menuLanguage')}</button>
            <button type="button" onClick={() => { setDrawerOpen(true); setPanelView('recent'); setMenuOpen(false) }} className="maps-menu-link"><Clock className="h-5 w-5" />{t('visitor.carte.menuHistory')}</button>
            <nav className="flex flex-col">
              {([
                [UserCircle, t('visitor.carte.navProfile'), isAuthenticated ? '/profil' : '/login'],
                [Stethoscope, t('visitor.carte.navFindDoctor'), '/medecins'],
                [MessageCircle, t('visitor.carte.navMessages'), '/messages'],
                [Bell, t('visitor.carte.navNotifications'), '/notifications'],
                [ClipboardList, t('visitor.carte.navConsultations'), '/patient/consultations'],
                [ClipboardList, t('visitor.carte.navPrescriptions'), '/patient/prescriptions'],
                [Activity, t('visitor.carte.navFirstAid'), '/premiers-soins'],
                [Building2, t('visitor.carte.navCategories'), '/categories'],
              ] as const).filter(([, , href]) => href === '/profil' || href === '/login' || (!isMedecin && !isEtablissement)).map(([Icon, label, href]) => <a key={href} href={href} className="maps-menu-link"><Icon className="h-5 w-5" />{label}</a>)}
            </nav>
          </aside>
        </div>
      )}

      <div className="absolute right-4 top-4 z-[1400]">
        <a
          href={isAuthenticated ? '/profil' : '/login'}
          className="maps-profile-btn flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-transparent text-slate-700 transition hover:bg-white/10 dark:border-white/10 dark:bg-transparent dark:text-slate-200 dark:hover:bg-white/5"
          aria-label={isAuthenticated ? t('visitor.carte.openProfileAria') : t('visitor.carte.loginAria')}
          title={user?.email || (isAuthenticated ? t('visitor.carte.openProfileAria') : t('visitor.carte.loginAria'))}
        >
          {profilePhoto.src ? (
            <img
              src={profilePhoto.src}
              alt={user?.prenom || user?.nom || user?.email || ''}
              aria-hidden="true"
              onError={profilePhoto.onError}
              className="h-6 w-6 rounded-full object-cover"
            />
          ) : (
            <UserCircle className="h-6 w-6" />
          )}
        </a>
      </div>

      <div className="maps-brand">
        <span>MediSecours <b>Maps</b></span>
      </div>
      {railOpen && <button type="button" className="maps-rail-close" onClick={() => setRailOpen(false)} aria-label={t('visitor.carte.menuClose')}><Menu size={18} /></button>}
      {!railOpen && <button type="button" className="maps-rail-open" onClick={() => setRailOpen(true)} aria-label={t('visitor.carte.menuPanel')}><ChevronRight size={18} /></button>}
      {/* ═══ Contrôle de calques façon Google Maps : fond courant + rangée de vignettes ═══ */}
      <div
        className={`maps-layers ${layersOpen ? 'maps-layers-open' : ''}`}
        onMouseEnter={() => setLayersOpen(true)}
        onMouseLeave={() => setLayersOpen(false)}
      >
        <button
          type="button"
          className="maps-layers-current"
          aria-expanded={layersOpen}
          aria-label={t('visitor.carte.basemap.title')}
          onClick={() => setLayersOpen((current) => !current)}
        >
          <span className="maps-layers-thumb maps-layers-cover-img" aria-hidden><BasemapThumb mode="plan" /></span>
          <span className="maps-layers-cover-label"><Layers className="h-3.5 w-3.5" aria-hidden />{t('visitor.carte.basemap.layers')}</span>
        </button>
        {layersOpen && (
          <div className="maps-layers-strip" role="group" aria-label={t('visitor.carte.basemap.title')}>
            {(['satellite', 'plan', 'relief'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                className="maps-layers-box"
                aria-pressed={basemap === mode}
                onClick={() => setBasemap(mode)}
              >
                <span className="maps-layers-thumb"><BasemapThumb mode={mode} /></span>
                <span className="maps-layers-box-label">{t(`visitor.carte.basemap.${mode}`)}</span>
              </button>
            ))}
            <span className="maps-layers-sep" aria-hidden="true" />
            {([
              ['traffic', trafficOn, setTrafficOn, 'traffic'],
              ['transit', transitOn, setTransitOn, 'transit'],
              ['cycling', cyclingOn, setCyclingOn, 'cycling'],
            ] as const).map(([key, active, setActive, thumb]) => {
              const supported = provider === 'google'
              return (
                <button
                  key={key}
                  type="button"
                  className="maps-layers-box"
                  aria-pressed={active}
                  disabled={!supported}
                  title={supported ? undefined : t('visitor.carte.basemap.unavailable')}
                  onClick={() => supported && setActive(!active)}
                >
                  <span className="maps-layers-thumb"><BasemapThumb mode={thumb} /></span>
                  <span className="maps-layers-box-label">{t(`visitor.carte.basemap.${key}`)}</span>
                </button>
              )
            })}
          </div>
        )}
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
                  {steps.length > 0 && (
                    <span className="text-slate-400">{t('visitor.carte.directions.stepsCount', { count: steps.length })}</span>
                  )}
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

            {route && steps.length > 0 && (
              <details className="mt-2 rounded-xl bg-slate-50 px-3 py-2 dark:bg-white/5">
                <summary className="cursor-pointer list-none text-xs font-bold text-slate-700 dark:text-slate-200">
                  {t('visitor.carte.directions.steps')}
                </summary>
                <ol className="mt-2 max-h-40 space-y-1.5 overflow-y-auto pr-1">
                  {steps.map((step, index) => (
                    <li key={index} className="flex gap-2 text-xs leading-5 text-slate-600 dark:text-slate-300">
                      <span className="font-bold text-primary-600 dark:text-primary-400">{index + 1}.</span>
                      <span className="min-w-0 flex-1">{step.instruction}</span>
                      <span className="shrink-0 text-slate-400">{formatDistanceKm(step.distance / 1000)}</span>
                    </li>
                  ))}
                </ol>
              </details>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ FAB SOS + localisation (colonne unique : superposition impossible) ═══ */}
      <div className="absolute bottom-[13.5rem] right-3 z-[600] flex flex-col items-center gap-3 xl:bottom-[11.5rem]">
        <button
          type="button"
          onClick={() => {
            const cible = selectedId != null ? centres.find((c) => c.id === selectedId) : null
            setSosEtablissement(cible && drawerOpen ? { id: cible.id, nom: cible.nom } : null)
            setSosOpen(true)
          }}
          aria-label={t('visitor.carte.sosFabAria')}
          title={t('visitor.carte.sosFabAria')}
          className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-white bg-red-600 text-white shadow-lg shadow-red-600/40 transition hover:scale-105 hover:bg-red-700 active:scale-95"
        >
          <span aria-hidden="true" className="text-[13px] font-black tracking-widest">SOS</span>
        </button>
        <button
          type="button"
          onClick={handleLocate}
          disabled={locating && !position}
          aria-busy={locating}
          aria-label={isTracking ? t('visitor.carte.stopTracking') : t('visitor.carte.locateMe')}
          className={`flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 shadow-lg transition ${
            isTracking ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-white text-primary-700 hover:bg-slate-100 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800'
          }`}
        >
          {locating ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <LocateFixed className={`h-4.5 w-4.5 ${isTracking ? 'animate-pulse' : ''}`} />}
        </button>
        <button
          type="button"
          onClick={() => {
            if (pickingPosition) {
              setPickingPosition(false)
              return
            }
            if (isManual) {
              clearManualPosition()
              toast.success(t('visitor.carte.positionGpsRestored'))
              return
            }
            setPickingPosition(true)
          }}
          aria-pressed={pickingPosition || isManual}
          aria-label={t('visitor.carte.adjustPosition')}
          title={t('visitor.carte.adjustPosition')}
          className={`flex h-10 w-10 items-center justify-center rounded-full border shadow-lg transition ${
            pickingPosition || isManual
              ? 'border-primary-700 bg-primary-700 text-white hover:bg-primary-800'
              : 'border-slate-200 bg-white text-primary-700 hover:bg-slate-100 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800'
          }`}
        >
          <Crosshair className="h-4.5 w-4.5" />
        </button>
      </div>

      {/* ═══ Panneau (liste / fiche) ═══ */}
      <MapsPanel
        railOpen={railOpen}
        initialView={panelView}
        onViewChange={(view) => { setPanelView(view); setDrawerOpen(true) }}
        open={drawerOpen}
        onClose={() => { setSelectedId(null); setDrawerOpen(false) }}
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
        onSosClick={() => {
          const cible = selectedId != null ? centres.find((c) => c.id === selectedId) : null
          setSosEtablissement(cible ? { id: cible.id, nom: cible.nom } : null)
          setSosOpen(true)
        }}
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

      {/* ═══ État géolocalisation (erreur après demande explicite) ═══ */}
      {geoError && !position && locationRequested && (
        <p className="absolute bottom-24 left-3 z-[600] flex max-w-64 items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs leading-5 text-red-700 shadow-lg dark:bg-red-500/10 dark:text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {geoError}
        </p>
      )}

      {/* ═══ Mode ajustement : consigne de toucher la carte ═══ */}
      {pickingPosition && (
        <p className="absolute bottom-24 left-3 z-[600] flex max-w-64 items-start gap-2 rounded-xl bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-800 shadow-lg dark:bg-blue-500/10 dark:text-blue-300">
          <Crosshair className="mt-0.5 h-4 w-4 shrink-0" />
          {t('visitor.carte.adjustHint')}
        </p>
      )}

      <SosModal
        open={sosOpen}
        onClose={() => {
          setSosOpen(false)
          setSosEtablissement(null)
        }}
        position={position}
        onLocate={() => locate()}
        etablissementId={sosEtablissement?.id ?? null}
        etablissementNom={sosEtablissement?.nom ?? null}
      />
    </div>
  )
}
