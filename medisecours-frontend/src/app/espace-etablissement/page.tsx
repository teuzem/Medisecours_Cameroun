'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  BadgeCheck,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  FileImage,
  Filter,
  Gauge,
  Loader2,
  LogIn,
  MapPin,
  MessageSquare,
  Palette,
  Image as ImageIcon,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Siren,
  Sparkles,
  Star,
  Stethoscope,
  Trash2,
  Upload,
  UserPlus,
  UserCheck,
  Users,
  Video,
} from 'lucide-react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import api from '../../api/axios'
import FichePanel, { type FicheCentre } from '../../components/espace-etablissement/FichePanel'
import AnalyticsPanel from '../../components/espace-etablissement/AnalyticsPanel'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../components/ui/Toast'
import { imgUrl } from '../../lib/config'
import GlassCard from '../../components/ui/GlassCard'
import StatCard from '../../components/ui/StatCard'
import Toggle from '../../components/ui/Toggle'
import SectionHeader from '../../components/ui/SectionHeader'
import Avatar from '../../components/ui/Avatar'
import { useCountUp } from '../../components/ui/useCountUp'

/* ──────────────────────────────────────────────────────────────────────────
 * Types
 * ────────────────────────────────────────────────────────────────────────── */

type CentreLite = {
  id: number
  nom: string
  type: string
  ville?: string | null
  region?: string | null
}

type MonEtablissement = {
  centre: FicheCentre | null
  role?: string | null
  via?: string | null
  statut?: string | null
}

type DashboardData = {
  centre: CentreLite
  sos: { enCours?: number; total?: number } & Record<string, number>
  avis: { total?: number; totalEnBase?: number; noteMoyenne?: number }
  medecins: { acceptes?: number; enAttente?: number }
  equipe: Record<string, number> & { total: number }
  generatedAt?: string
}

type EquipeMembre = {
  id: number
  userId: string
  nom?: string | null
  prenom?: string | null
  email: string
  role: string
  statut: string
  createdAt: string
  photoProfil?: string | null
}

type SyncStats = {
  configured: boolean
  error?: string
  source?: string
  queries?: number
  created?: number
  updated?: number
  skipped?: number
}

type ManagedMedia = {
  id: number
  contentUrl: string
  originalName?: string | null
  mimeType?: string | null
  kind: 'image' | 'video'
  size?: number | null
  createdAt: string
}

type CoverSearchResult = {
  id: string
  url: string
  previewUrl: string
  sourceUrl: string
  author: string
}

type ManagedReview = {
  id: number
  note: number
  commentaire?: string | null
  statut: 'PUBLIE' | 'REJETE' | 'EN_ATTENTE'
  signale: boolean
  raisonSignalement?: string | null
  auteurNom?: string | null
  createdAt: string
  images?: Array<{
    id: number
    contentUrl: string
    originalName?: string | null
    mimeType?: string | null
    size?: number | null
    kind?: 'image' | 'video'
  }>
}

type Prefs = {
  accent: string
  showSos: boolean
  compact: boolean
  animations: boolean
  surface: 'glass' | 'soft'
  showHeroCover: boolean
}

const ACCENTS = ['#059669', '#4f46e5', '#0284c7', '#7c3aed', '#e11d48', '#d97706']
const ACCENT_NAMES: Record<string, string> = {
  '#059669': 'emerald',
  '#4f46e5': 'indigo',
  '#0284c7': 'sky',
  '#7c3aed': 'violet',
  '#e11d48': 'rose',
  '#d97706': 'amber',
}

const TEAM_ROLES = ['DIRECTEUR', 'GESTIONNAIRE', 'MEDECIN', 'INFIRMIER', 'LECTURE']

const STATUS_LABELS: Record<string, string> = {
  ACTIF: 'statusActif',
  INVITE: 'statusInvite',
  REVOQUE: 'statusRevoque',
}

const ROLE_LABELS: Record<string, string> = {
  DIRECTEUR: 'roleDirector',
  GESTIONNAIRE: 'roleGest',
  MEDECIN: 'roleMedecin',
  INFIRMIER: 'roleInfirmier',
  LECTURE: 'roleLecture',
}

const TYPE_LABELS: Record<string, string> = {
  hopital_general: 'Hôpital',
  hopital_de_district: 'Hôpital de district',
  chu: 'CHU',
  cma: 'CMA',
  csi: 'CSI',
  clinique_privee: 'Clinique',
  pharmacie: 'Pharmacie',
  laboratoire: 'Laboratoire',
  centre_specialise: 'Centre spécialisé',
}

const TYPE_TRANSLATION_KEYS: Record<string, string> = {
  hopital_general: 'hopitalGeneral',
  hopital_de_district: 'hopitalDistrict',
  chu: 'chu',
  cma: 'cma',
  csi: 'csi',
  clinique_privee: 'clinique',
  pharmacie: 'pharmacie',
  laboratoire: 'laboratoire',
  centre_specialise: 'centreSpecialise',
}

const ROLE_TONE: Record<string, 'mint' | 'blue' | 'violet' | 'amber' | 'slate'> = {
  DIRECTEUR: 'violet',
  GESTIONNAIRE: 'blue',
  MEDECIN: 'mint',
  INFIRMIER: 'amber',
  LECTURE: 'slate',
}

const PREFS_KEY = 'medisecours_etab_prefs'
const PREFS_VERSION = 2

type StoredPrefs = Prefs & { version: number }

type DashboardSectionId =
  | 'dashboard-overview'
  | 'dashboard-fiche'
  | 'dashboard-team'
  | 'dashboard-media'
  | 'dashboard-reviews'
  | 'dashboard-analytics'
  | 'dashboard-settings'

const DASHBOARD_SECTION_IDS: DashboardSectionId[] = [
  'dashboard-overview',
  'dashboard-fiche',
  'dashboard-team',
  'dashboard-media',
  'dashboard-reviews',
  'dashboard-analytics',
  'dashboard-settings',
]

function defaultPrefs(): Prefs {
  return { accent: ACCENTS[0], showSos: true, compact: false, animations: true, surface: 'glass', showHeroCover: true }
}

function normalizePrefs(parsed: Partial<Prefs> | null | undefined): Prefs {
  return {
    accent: typeof parsed?.accent === 'string' && ACCENTS.includes(parsed.accent) ? parsed.accent : ACCENTS[0],
    showSos: parsed?.showSos !== false,
    compact: Boolean(parsed?.compact),
    animations: parsed?.animations !== false,
    surface: parsed?.surface === 'soft' ? 'soft' : 'glass',
    showHeroCover: parsed?.showHeroCover !== false,
  }
}

function readPrefs(): Prefs {
  if (typeof window === 'undefined') return defaultPrefs()
  try {
    const raw = window.localStorage.getItem(PREFS_KEY)
    if (!raw) return defaultPrefs()
    return normalizePrefs(JSON.parse(raw) as Partial<StoredPrefs>)
  } catch {
    return defaultPrefs()
  }
}

/* ──────────────────────────────────────────────────────────────────────────
 * Page
 * ────────────────────────────────────────────────────────────────────────── */

export default function EtablissementEspacePage() {
  const { t } = useTranslation()
  const toast = useToast()
  const router = useRouter()
  const { isAuthenticated, isEtablissement, isAdmin, mounted, user } = useAuth()

  const [mon, setMon] = useState<MonEtablissement | null>(null)
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [equipe, setEquipe] = useState<EquipeMembre[]>([])
  const [loadingMon, setLoadingMon] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [teamLoading, setTeamLoading] = useState(false)
  const [mediaLoading, setMediaLoading] = useState(false)
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [teamError, setTeamError] = useState(false)
  const [mediaError, setMediaError] = useState(false)
  const [reviewsError, setReviewsError] = useState(false)
  const [activeSection, setActiveSection] = useState<DashboardSectionId>('dashboard-overview')

  // Claim wizard
  const [searchQuery, setSearchQuery] = useState('')
  const [results, setResults] = useState<CentreLite[]>([])
  const [searching, setSearching] = useState(false)
  const [claimedId, setClaimedId] = useState<number | null>(null)
  const [claiming, setClaiming] = useState(false)

  // Equipe
  const [memberEmail, setMemberEmail] = useState('')
  const [memberRole, setMemberRole] = useState('LECTURE')
  const [addingMember, setAddingMember] = useState(false)

  // Sync + stats
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState<string | null>(null)
  const [statsTotal, setStatsTotal] = useState<number | null>(null)
  const [media, setMedia] = useState<ManagedMedia[]>([])
  const [reviews, setReviews] = useState<ManagedReview[]>([])
  const [uploadingMedia, setUploadingMedia] = useState(false)
  const [moderatingReview, setModeratingReview] = useState<number | null>(null)
  const [settingCover, setSettingCover] = useState(false)

  // Personnalisation
  const [prefs, setPrefs] = useState<Prefs>(readPrefs)

  const canAccess = isEtablissement || isAdmin
  const canManageMedia = isAdmin || mon?.role === 'DIRECTEUR' || mon?.role === 'GESTIONNAIRE'
  const accent = prefs.accent

  const applyPrefs = useCallback((next: Prefs) => {
    const normalized = normalizePrefs(next)
    setPrefs(normalized)
    try {
      const stored: StoredPrefs = { ...normalized, version: PREFS_VERSION }
      window.localStorage.setItem(PREFS_KEY, JSON.stringify(stored))
    } catch {
      // stockage indisponible : on ignore
    }
  }, [])

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== PREFS_KEY || !event.newValue) return
      try {
        setPrefs(normalizePrefs(JSON.parse(event.newValue) as Partial<StoredPrefs>))
      } catch {
        // Ignore malformed values from another tab.
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  const resetPrefs = useCallback(() => {
    applyPrefs(defaultPrefs())
    toast.success(t('etablissement.settingsReset'))
  }, [applyPrefs, t, toast])

  /* ── Chargement principal ─────────────────────────────────────────────── */
  const loadMonEtablissement = useCallback(() => {
    api
      .get<MonEtablissement>('/api/carte/mon-etablissement')
      .then(({ data }) => {
        setLoadError(false)
        setMon(data)
        if (data.centre?.id != null) {
          const centreId = data.centre.id
          void api
            .get<DashboardData>('/api/carte/dashboard', { params: { centre: centreId } })
            .then(({ data: dash }) => setDashboard(dash))
            .catch(() => undefined)
          setTeamLoading(true)
          setTeamError(false)
          void api
            .get<{ members: EquipeMembre[] }>('/api/carte/equipes', { params: { centre: centreId } })
            .then(({ data: team }) => {
              setEquipe(team.members)
              setTeamError(false)
            })
            .catch(() => setTeamError(true))
            .finally(() => setTeamLoading(false))
          setMediaLoading(true)
          setMediaError(false)
          void api
            .get<{ items: ManagedMedia[] }>('/api/carte/medias', { params: { centre: centreId } })
            .then(({ data: gallery }) => {
              setMedia(gallery.items ?? [])
              setMon((current) =>
                current?.centre
                  ? { ...current, centre: { ...current.centre, images: gallery.items ?? [] } }
                  : current,
              )
              setMediaError(false)
            })
            .catch(() => setMediaError(true))
            .finally(() => setMediaLoading(false))
          setReviewsLoading(true)
          setReviewsError(false)
          void api
            .get<{ items: ManagedReview[] }>('/api/carte/avis', { params: { centre: centreId } })
            .then(({ data: reviewData }) => {
              setReviews(reviewData.items ?? [])
              setReviewsError(false)
            })
            .catch(() => setReviewsError(true))
            .finally(() => setReviewsLoading(false))
        }
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoadingMon(false))
  }, [])

  const loadStats = useCallback(() => {
    api
      .get<{
        total?: number
        dernierSync?: string | null
      }>('/api/carte/stats')
      .then(({ data }) => {
        setStatsTotal(data.total ?? null)
        setLastSync(data.dernierSync ?? null)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!mounted) return
    if (!isAuthenticated) {
      router.replace('/login')
      return
    }
    if (!canAccess) return
    void loadMonEtablissement()
    void loadStats()
  }, [mounted, isAuthenticated, canAccess, loadMonEtablissement, loadStats, router])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const updateFromHash = () => {
      const value = window.location.hash.replace(/^#/, '') as DashboardSectionId
      if (DASHBOARD_SECTION_IDS.includes(value)) {
        setActiveSection(value)
      }
    }
    updateFromHash()
    window.addEventListener('hashchange', updateFromHash)
    return () => window.removeEventListener('hashchange', updateFromHash)
  }, [])

  const selectDashboardSection = useCallback((section: DashboardSectionId) => {
    setActiveSection(section)
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#${section}`)
    }
  }, [])

  /* ── Recherche (réclamation) ───────────────────────────────────────────── */
  const runSearch = useCallback(async () => {
    const q = searchQuery.trim()
    if (q.length < 2) return
    setSearching(true)
    try {
      const { data } = await api.get<CentreLite[]>('/api/carte/etablissements', {
        params: { q, limit: 50 },
      })
      setResults(Array.isArray(data) ? data : [])
    } catch {
      setResults([])
      toast.error(t('etablissement.loadError'))
    } finally {
      setSearching(false)
    }
  }, [searchQuery, t, toast])

  const claim = useCallback(
    async (centreId: number) => {
      setClaiming(true)
      setClaimedId(centreId)
      const isOther = mon?.centre != null && mon.centre.id !== centreId
      try {
        const { data } = await api.post<{ centre: CentreLite; role: string }>('/api/carte/revendiquer', {
          centre: centreId,
          force: isOther,
        })
        setMon({ centre: data.centre, role: data.role, via: 'equipe', statut: 'ACTIF' })
        void loadMonEtablissement()
        toast.success(t('etablissement.claimedToast'))
        setResults([])
        setSearchQuery('')
        void loadStats()
      } catch (error: any) {
        const status = error.response?.status
        const message = error.response?.data?.error
        if (status === 409) {
          toast.error(message || t('etablissement.switchNote'))
        } else if (message) {
          toast.error(message)
        } else {
          toast.error(t('etablissement.loadError'))
        }
      } finally {
        setClaiming(false)
        setClaimedId(null)
      }
    },
    [mon, t, toast, loadStats, loadMonEtablissement],
  )

  /* ── Équipe ───────────────────────────────────────────────────────────── */
  const addMember = useCallback(async () => {
    const email = memberEmail.trim()
    if (!email || addingMember) return
    setAddingMember(true)
    try {
      await api.post('/api/carte/equipes', { centre: mon?.centre?.id, email, role: memberRole })
      setMemberEmail('')
      const { data } = await api.get<{ members: EquipeMembre[] }>('/api/carte/equipes', {
        params: { centre: mon?.centre?.id },
      })
      setEquipe(data.members)
      setTeamError(false)
      toast.success(t('etablissement.teamAdded'))
    } catch (error: any) {
      const status = error.response?.status
      toast.error(
        status === 404
          ? t('etablissement.teamUserNotFound')
          : status === 409
            ? t('etablissement.teamAlreadyMember')
            : error.response?.data?.error || t('etablissement.teamAddFailed'),
      )
    } finally {
      setAddingMember(false)
    }
  }, [memberEmail, memberRole, addingMember, mon, t, toast])

  const updateMemberRole = useCallback(
    async (member: EquipeMembre, role: string) => {
      try {
        await api.patch(`/api/carte/equipes/${member.id}`, { role })
        setEquipe((current) => current.map((m) => (m.id === member.id ? { ...m, role } : m)))
        setTeamError(false)
      } catch (error: any) {
        toast.error(error.response?.data?.error || t('etablissement.teamUpdateFailed'))
      }
    },
    [t, toast],
  )

  const updateMemberStatus = useCallback(
    async (member: EquipeMembre, statut: string) => {
      try {
        const { data } = await api.patch<{ member: EquipeMembre }>(`/api/carte/equipes/${member.id}`, { statut })
        setEquipe((current) =>
          current.map((item) => (item.id === member.id ? { ...item, ...(data.member ?? { statut }) } : item)),
        )
        setTeamError(false)
      } catch (error: any) {
        toast.error(error.response?.data?.error || t('etablissement.teamUpdateFailed'))
      }
    },
    [t, toast],
  )

  const removeMember = useCallback(
    async (member: EquipeMembre) => {
      try {
        await api.delete(`/api/carte/equipes/${member.id}`)
        setEquipe((current) => current.filter((m) => m.id !== member.id))
        setTeamError(false)
      } catch (error: any) {
        toast.error(error.response?.data?.error || t('etablissement.teamRemoveFailed'))
      }
    },
    [t, toast],
  )

  /* ── Synchronisation (admin) ──────────────────────────────────────────── */
  const runSync = useCallback(async () => {
    setSyncing(true)
    try {
      const { data } = await api.post<SyncStats>('/api/carte/sync')
      if (data.configured) {
        toast.success(t('etablissement.syncResult', { created: data.created ?? 0, updated: data.updated ?? 0 }))
        void loadStats()
        void loadMonEtablissement()
      } else {
        toast.info(data.error || t('etablissement.syncDisabled'))
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('etablissement.syncFailed'))
    } finally {
      setSyncing(false)
    }
  }, [loadMonEtablissement, loadStats, t, toast])

  const uploadMedia = useCallback(async (file: File): Promise<ManagedMedia | null> => {
    if (!mon?.centre?.id || uploadingMedia) return null
    const allowed = new Set([
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'video/mp4',
      'video/webm',
      'video/quicktime',
    ])
    const isVideo = file.type.startsWith('video/')
    const maxBytes = isVideo ? 30 * 1024 * 1024 : 10 * 1024 * 1024
    if (!allowed.has(file.type)) {
      toast.error(t('etablissement.mediaFormatInvalid'))
      return null
    }
    if (file.size > maxBytes) {
      toast.error(isVideo ? t('etablissement.mediaVideoTooLarge') : t('etablissement.mediaImageTooLarge'))
      return null
    }
    setUploadingMedia(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('centre', String(mon.centre.id))
      const { data } = await api.post<{ media: ManagedMedia }>('/api/carte/medias', form)
      setMedia((current) => [data.media, ...current])
      setMon((current) =>
        current?.centre
          ? { ...current, centre: { ...current.centre, images: [data.media, ...(current.centre.images ?? [])] } }
          : current,
      )
      setMediaError(false)
      toast.success(t('etablissement.mediaAdded'))
      return data.media
    } catch (error: any) {
      toast.error(error.response?.data?.detail || error.response?.data?.error || t('etablissement.mediaAddFailed'))
      return null
    } finally {
      setUploadingMedia(false)
    }
  }, [mon, t, toast, uploadingMedia])

  const deleteMedia = useCallback(async (item: ManagedMedia) => {
    try {
      await api.delete(`/api/carte/medias/${item.id}`)
      setMedia((current) => current.filter((mediaItem) => mediaItem.id !== item.id))
      setMon((current) =>
        current?.centre
          ? {
              ...current,
              centre: {
                ...current.centre,
                imageUrl: current.centre.imageUrl === item.contentUrl ? null : current.centre.imageUrl,
                logoUrl: current.centre.logoUrl === item.contentUrl ? null : current.centre.logoUrl,
                images: (current.centre.images ?? []).filter((image) => image.id !== item.id),
              },
            }
          : current,
      )
      toast.success(t('etablissement.mediaDeleted'))
    } catch {
      toast.error(t('etablissement.mediaDeleteFailed'))
    }
  }, [t, toast])

  const setCoverMedia = useCallback(async (item: ManagedMedia | null): Promise<boolean> => {
    if (!mon?.centre?.id || settingCover) return false
    setSettingCover(true)
    try {
      const { data } = await api.patch<{ centre: FicheCentre }>('/api/carte/mon-etablissement', {
        imageUrl: item?.contentUrl ?? null,
      })
      setMon((current) => (current ? { ...current, centre: data.centre } : current))
      toast.success(t(item ? 'etablissement.coverSelected' : 'etablissement.coverRemoved'))
      return true
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('etablissement.coverSaveFailed'))
      return false
    } finally {
      setSettingCover(false)
    }
  }, [mon, settingCover, t, toast])

  const setLogoUrl = useCallback(async (logoUrl: string | null): Promise<boolean> => {
    if (!mon?.centre?.id) return false
    try {
      const { data } = await api.patch<{ centre: FicheCentre }>('/api/carte/mon-etablissement', { logoUrl })
      setMon(current => current ? { ...current, centre: data.centre } : current)
      toast.success(t('etablissement.logoSaved'))
      return true
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('etablissement.logoSaveFailed'))
      return false
    }
  }, [mon, t, toast])

  const moderateReview = useCallback(async (review: ManagedReview, statut: 'PUBLIE' | 'REJETE') => {
    setModeratingReview(review.id)
    try {
      const { data } = await api.patch<{ avis: ManagedReview }>(`/api/carte/avis/${review.id}`, {
        statut,
        raison: statut === 'REJETE' ? t('etablissement.reviewHiddenReason') : null,
      })
      setReviews((current) => current.map((item) => item.id === review.id ? data.avis : item))
      toast.success(statut === 'PUBLIE' ? t('etablissement.reviewsPublished') : t('etablissement.reviewsHidden'))
      void loadMonEtablissement()
    } catch {
      toast.error(t('etablissement.reviewsModerationFailed'))
    } finally {
      setModeratingReview(null)
    }
  }, [loadMonEtablissement, t, toast])

  const reloadData = useCallback(() => {
    if (mon?.centre?.id == null) return
    void loadMonEtablissement()
    void loadStats()
    router.refresh()
  }, [loadMonEtablissement, loadStats, mon?.centre?.id, router])

  const handleFicheSaved = useCallback((centre: FicheCentre) => {
    setMon((current) => (current ? { ...current, centre } : current))
    void api
      .get<DashboardData>('/api/carte/dashboard', { params: { centre: centre.id } })
      .then(({ data: dash }) => setDashboard(dash))
      .catch(() => undefined)
  }, [])

  /* ── Rendu de garde ───────────────────────────────────────────────────── */
  if (!mounted) {
    return (
      <MinimalShell>
        <div className="flex items-center justify-center gap-2 py-24 text-sm font-semibold text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          {t('etablissement.loading')}
        </div>
      </MinimalShell>
    )
  }

  if (!isAuthenticated) {
    return (
      <MinimalShell>
        <GuardCard
          title={t('etablissement.accessDenied')}
          primary={{ href: '/login', label: t('etablissement.loginCta'), icon: LogIn }}
          secondary={{ href: '/register', label: t('etablissement.createCta'), icon: UserPlus }}
        />
      </MinimalShell>
    )
  }

  if (!canAccess) {
    return (
      <MinimalShell>
        <GuardCard
          title={t('etablissement.accessDenied')}
          primary={{ href: '/register', label: t('etablissement.createCta'), icon: UserPlus }}
        />
      </MinimalShell>
    )
  }

  return (
    <div
      className="etablissement-dashboard overflow-x-hidden"
      style={{ ['--accent' as never]: accent }}
      data-surface={prefs.surface}
      data-anim={prefs.animations ? 'on' : 'off'}
    >
      <div className="relative min-h-[calc(100dvh-76px)] w-full overflow-x-hidden bg-slate-50 dark:bg-slate-950 xl:min-h-[calc(100dvh-96px)]">
        {/* Halo décoratif (accent personnalisé) */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-32 left-1/2 h-72 w-[42rem] max-w-full -translate-x-1/2 rounded-full blur-3xl"
          style={{ background: `color-mix(in srgb, ${accent} 14%, transparent)` }}
        />
        <div className="relative mx-auto w-full max-w-6xl min-w-0 px-3 py-4 sm:px-6 sm:py-6 xl:py-10">
          {/* ═══ En-tête ═══ */}
          <DashboardHeader
            accent={accent}
            mon={mon}
            userNom={user?.etablissementNom}
            statsTotal={statsTotal}
            lastSync={lastSync}
            loadingMon={loadingMon}
            syncing={syncing}
            isAdmin={isAdmin}
            onRefresh={reloadData}
            onSync={runSync}
            prefs={prefs}
          />

          {/* ═══ Chargement / erreur ═══ */}
          {loadError && (
            <div className="mt-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{t('etablissement.loadError')}</span>
            </div>
          )}

          {loadingMon ? (
            <div className="mt-6 flex items-center justify-center gap-2 rounded-2xl border border-white/60 bg-white/70 py-16 text-sm font-semibold text-slate-400 dark:border-white/10 dark:bg-slate-900/70">
              <Loader2 className="h-5 w-5 animate-spin" />
              {t('etablissement.loading')}
            </div>
          ) : !mon?.centre ? (
            <ClaimWizard
              accent={accent}
              searchQuery={searchQuery}
              onSearchQuery={setSearchQuery}
              searching={searching}
              onSearch={runSearch}
              results={results}
              claiming={claiming}
              claimedId={claimedId}
              onClaim={claim}
              isManager={Boolean(mon?.centre)}
            />
          ) : (
            <>
              <DashboardSectionNav activeSection={activeSection} onSelect={selectDashboardSection} />
              <DashboardWorkspace
                activeSection={activeSection}
                compact={prefs.compact}
                dashboard={dashboard}
                prefs={prefs}
                mon={mon}
                accent={accent}
                reviews={reviews}
                equipe={equipe}
                media={media}
                memberEmail={memberEmail}
                setMemberEmail={setMemberEmail}
                memberRole={memberRole}
                setMemberRole={setMemberRole}
                addMember={addMember}
                addingMember={addingMember}
                updateMemberRole={updateMemberRole}
                updateMemberStatus={updateMemberStatus}
                removeMember={removeMember}
                teamLoading={teamLoading}
                teamError={teamError}
                mediaLoading={mediaLoading}
                mediaError={mediaError}
                reviewsLoading={reviewsLoading}
                reviewsError={reviewsError}
                reloadData={reloadData}
                uploadingMedia={uploadingMedia}
                uploadMedia={uploadMedia}
                deleteMedia={deleteMedia}
                canManageMedia={canManageMedia}
                coverUrl={mon.centre.imageUrl ?? null}
                settingCover={settingCover}
                setCoverMedia={setCoverMedia}
                moderatingReview={moderatingReview}
                moderateReview={moderateReview}
                applyPrefs={applyPrefs}
                resetPrefs={resetPrefs}
                setLogoUrl={setLogoUrl}
                handleFicheSaved={handleFicheSaved}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function DashboardWorkspace({
  activeSection,
  compact,
  dashboard,
  prefs,
  mon,
  accent,
  reviews,
  equipe,
  media,
  memberEmail,
  setMemberEmail,
  memberRole,
  setMemberRole,
  addMember,
  addingMember,
  updateMemberRole,
  updateMemberStatus,
  removeMember,
  teamLoading,
  teamError,
  mediaLoading,
  mediaError,
  reviewsLoading,
  reviewsError,
  reloadData,
  uploadingMedia,
  uploadMedia,
  deleteMedia,
  canManageMedia,
  coverUrl,
  settingCover,
  setCoverMedia,
  moderatingReview,
  moderateReview,
  applyPrefs,
  resetPrefs,
  setLogoUrl,
  handleFicheSaved,
}: {
  activeSection: DashboardSectionId
  compact: boolean
  dashboard: DashboardData | null
  prefs: Prefs
  mon: MonEtablissement & { centre: FicheCentre }
  accent: string
  reviews: ManagedReview[]
  equipe: EquipeMembre[]
  media: ManagedMedia[]
  memberEmail: string
  setMemberEmail: (value: string) => void
  memberRole: string
  setMemberRole: (value: string) => void
  addMember: () => void
  addingMember: boolean
  updateMemberRole: (member: EquipeMembre, role: string) => void
  updateMemberStatus: (member: EquipeMembre, statut: string) => void
  removeMember: (member: EquipeMembre) => void
  teamLoading: boolean
  teamError: boolean
  mediaLoading: boolean
  mediaError: boolean
  reviewsLoading: boolean
  reviewsError: boolean
  reloadData: () => void
  uploadingMedia: boolean
  uploadMedia: (file: File) => Promise<ManagedMedia | null>
  deleteMedia: (item: ManagedMedia) => void
  canManageMedia: boolean
  coverUrl: string | null
  settingCover: boolean
  setCoverMedia: (item: ManagedMedia | null) => Promise<boolean>
  moderatingReview: number | null
  moderateReview: (review: ManagedReview, statut: 'PUBLIE' | 'REJETE') => void
  applyPrefs: (prefs: Prefs) => void
  resetPrefs: () => void
  setLogoUrl: (url: string | null) => Promise<boolean>
  handleFicheSaved: (centre: FicheCentre) => void
}) {
  const panelClass = compact ? 'dashboard-workspace mt-4' : 'dashboard-workspace mt-4'
  const panelProps = {
    role: 'tabpanel' as const,
    'aria-labelledby': `dashboard-tab-${activeSection}`,
    className: 'dashboard-section',
  }

  switch (activeSection) {
    case 'dashboard-fiche':
      return (
        <div className={panelClass}>
          <div id="dashboard-fiche" {...panelProps}>
            <FichePanel centre={mon.centre} accent={accent} onSaved={handleFicheSaved} />
          </div>
        </div>
      )
    case 'dashboard-team':
      return (
        <div className={panelClass}>
          <div id="dashboard-team" {...panelProps}>
            <TeamPanel
              equipe={equipe}
              memberEmail={memberEmail}
              setMemberEmail={setMemberEmail}
              memberRole={memberRole}
              setMemberRole={setMemberRole}
              onAdd={addMember}
              adding={addingMember}
              onRoleChange={updateMemberRole}
              onStatusChange={updateMemberStatus}
              onRemove={removeMember}
              loading={teamLoading}
              error={teamError}
              onRetry={reloadData}
              compact={compact}
            />
          </div>
        </div>
      )
    case 'dashboard-media':
      return (
        <div className={panelClass}>
          <div id="dashboard-media" {...panelProps}>
            <MediaPanel
              items={media}
              uploading={uploadingMedia}
              loading={mediaLoading}
              error={mediaError}
              onRetry={reloadData}
              onUpload={uploadMedia}
              onDelete={deleteMedia}
              canManageMedia={canManageMedia}
              coverUrl={coverUrl}
              settingCover={settingCover}
              onSetCover={setCoverMedia}
            />
          </div>
        </div>
      )
    case 'dashboard-reviews':
      return (
        <div className={panelClass}>
          <div id="dashboard-reviews" {...panelProps}>
            <ReviewsPanel
              items={reviews}
              moderatingId={moderatingReview}
              loading={reviewsLoading}
              error={reviewsError}
              onRetry={reloadData}
              onModerate={moderateReview}
            />
          </div>
        </div>
      )
    case 'dashboard-analytics':
      return (
        <div className={panelClass}>
          <div id="dashboard-analytics" {...panelProps}>
            <AnalyticsPanel centreId={mon.centre.id} accent={accent} />
          </div>
        </div>
      )
    case 'dashboard-settings':
      return (
        <div className={panelClass}>
          <div id="dashboard-settings" {...panelProps}>
            <PersonalizationPanel
              key={`${mon.centre.id}:${mon.centre.logoUrl ?? ''}`}
              prefs={prefs}
              onChange={applyPrefs}
              onReset={resetPrefs}
              accent={accent}
              centre={mon.centre}
              media={media}
              onSetCover={setCoverMedia}
              onSetLogo={setLogoUrl}
              onUploadImage={uploadMedia}
              uploadingMedia={uploadingMedia}
              settingCover={settingCover}
              canManageBranding={canManageMedia}
            />
          </div>
        </div>
      )
    case 'dashboard-overview':
    default:
      return (
        <div className={`${panelClass} space-y-4`}>
          <div id="dashboard-overview" {...panelProps}>
            <KpiBand dashboard={dashboard} prefs={prefs} />
          </div>
          <div className="dashboard-section grid grid-cols-1 gap-4 lg:grid-cols-3">
            <StatsSosWidget dashboard={dashboard} prefs={prefs} />
            <StatsAvisWidget dashboard={dashboard} reviews={reviews} />
            <StatsEquipeWidget dashboard={dashboard} equipe={equipe} />
          </div>
        </div>
      )
  }
}

function syncLabelIcon(syncing: boolean) {
  return syncing ? Loader2 : RefreshCw
}

function DashboardSectionNav({
  activeSection,
  onSelect,
}: {
  activeSection: DashboardSectionId
  onSelect: (section: DashboardSectionId) => void
}) {
  const { t } = useTranslation()
  const items = [
    { id: 'dashboard-overview', label: t('etablissement.navOverview'), icon: Gauge },
    { id: 'dashboard-fiche', label: t('etablissement.navFiche'), icon: Building2 },
    { id: 'dashboard-team', label: t('etablissement.navTeam'), icon: Users },
    { id: 'dashboard-media', label: t('etablissement.navMedia'), icon: FileImage },
    { id: 'dashboard-reviews', label: t('etablissement.navReviews'), icon: MessageSquare },
    { id: 'dashboard-analytics', label: t('etablissement.navAnalytics'), icon: Activity },
    { id: 'dashboard-settings', label: t('etablissement.navSettings'), icon: Palette },
  ]

  const moveFocus = (currentId: DashboardSectionId, direction: 'next' | 'previous' | 'first' | 'last') => {
    const index = items.findIndex((item) => item.id === currentId)
    const nextIndex =
      direction === 'first'
        ? 0
        : direction === 'last'
          ? items.length - 1
          : direction === 'next'
            ? (index + 1) % items.length
            : (index - 1 + items.length) % items.length
    const next = items[nextIndex]?.id as DashboardSectionId | undefined
    if (!next) return
    onSelect(next)
    document.getElementById(`dashboard-tab-${next}`)?.focus()
  }

  return (
    <nav
      className="dashboard-section-nav"
      aria-label={t('etablissement.dashboardNavigation')}
      role="tablist"
    >
      <div className="dashboard-section-nav__scroll">
        {items.map(({ id, label, icon: Icon }) => (
          <a
            key={id}
            id={`dashboard-tab-${id}`}
            href={`#${id}`}
            onClick={(event) => {
              event.preventDefault()
              onSelect(id as DashboardSectionId)
            }}
            onKeyDown={(event) => {
              const currentId = id as DashboardSectionId
              if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                event.preventDefault()
                moveFocus(currentId, 'next')
              } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                event.preventDefault()
                moveFocus(currentId, 'previous')
              } else if (event.key === 'Home') {
                event.preventDefault()
                moveFocus(currentId, 'first')
              } else if (event.key === 'End') {
                event.preventDefault()
                moveFocus(currentId, 'last')
              }
            }}
            role="tab"
            aria-selected={activeSection === id}
            aria-controls={id}
            tabIndex={activeSection === id ? 0 : -1}
            className={`dashboard-section-nav__item ${activeSection === id ? 'is-active' : ''}`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            <span>{label}</span>
          </a>
        ))}
      </div>
    </nav>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
 * Sous-composants
 * ────────────────────────────────────────────────────────────────────────── */

function MinimalShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[calc(100dvh-76px)] w-full items-center justify-center bg-slate-50 px-4 dark:bg-slate-950 xl:min-h-[calc(100dvh-96px)]">
      <div className="w-full max-w-md">{children}</div>
    </div>
  )
}

function GuardCard({
  title,
  primary,
  secondary,
}: {
  title: string
  primary: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }
  secondary?: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }
}) {
  const Icon = primary.icon
  return (
    <div className="wdg wdg__glow rounded-2xl border border-white/80 bg-white/90 p-8 text-center shadow-sm dark:border-white/10 dark:bg-slate-900/80">
      <div className="wdg__tile mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl text-white">
        <ShieldCheck className="h-6 w-6" />
      </div>
      <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">{title}</h2>
      <div className="mt-6 flex flex-col gap-3">
        <Link
          href={primary.href}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--accent,#10b981)] px-4 text-sm font-bold text-white transition hover:brightness-105"
        >
          <Icon className="h-4 w-4" />
          {primary.label}
        </Link>
        {secondary && (
          <Link
            href={secondary.href}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
          >
            <secondary.icon className="h-4 w-4" />
            {secondary.label}
          </Link>
        )}
      </div>
    </div>
  )
}

function HeaderChip({
  icon: Icon,
  onClick,
  label,
  disabled,
  spin,
  accent: isAccent,
}: {
  icon: React.ComponentType<{ className?: string }>
  onClick: () => void
  label: string
  disabled?: boolean
  spin?: boolean
  accent?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-xs font-bold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
        isAccent
          ? 'border-transparent text-white hover:brightness-105'
          : 'border-white/80 bg-white/80 text-slate-700 hover:bg-white dark:border-white/10 dark:bg-slate-950/70 dark:text-slate-200 dark:hover:bg-slate-900'
      }`}
      style={isAccent ? { backgroundColor: 'var(--accent, #10b981)' } : undefined}
    >
      <Icon className={`h-4 w-4 ${spin ? 'animate-spin' : ''}`} />
      {label}
    </button>
  )
}

function FacilityLogo({
  url,
  name,
  accent,
  className,
}: {
  url?: string | null
  name: string
  accent: string
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  const source = imgUrl(url) || url

  if (!source || failed) {
    return <Building2 className={className ?? 'h-8 w-8'} style={{ color: accent }} aria-hidden="true" />
  }

  return (
    <img
      src={source}
      alt={name}
      className={className ?? 'max-h-16 max-w-24 object-contain'}
      onError={() => setFailed(true)}
    />
  )
}

function DashboardHeader({
  accent,
  mon,
  userNom,
  statsTotal,
  lastSync,
  loadingMon,
  syncing,
  isAdmin,
  onRefresh,
  onSync,
  prefs,
}: {
  accent: string
  mon: MonEtablissement | null
  userNom?: string | null
  statsTotal: number | null
  lastSync: string | null
  loadingMon: boolean
  syncing: boolean
  isAdmin: boolean
  onRefresh: () => void
  onSync: () => void
  prefs: Prefs
}) {
  const { t, i18n } = useTranslation()
  const centre = mon?.centre
  const verification = centre?.verificationStatut

  return (
    <GlassCard as="header" glow className="relative isolate overflow-hidden p-4 sm:p-8">
      {prefs.showHeroCover && centre?.imageUrl && (
        <img
          src={imgUrl(centre.imageUrl) || centre.imageUrl}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 -z-20 h-full w-full object-cover"
        />
      )}
      <div className={`absolute inset-0 -z-10 ${prefs.showHeroCover && centre?.imageUrl ? 'bg-slate-950/65' : 'bg-white/80 dark:bg-slate-950/70'}`} />
      <div className="relative flex min-w-0 flex-wrap items-center justify-between gap-5">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden">
            <FacilityLogo
              key={centre?.logoUrl ?? 'facility-logo-fallback'}
              url={centre?.logoUrl}
              name={t('etablissement.currentLogoAlt', { name: centre?.nom || userNom || t('etablissement.subtitle') })}
              accent={accent}
              className="max-h-16 max-w-24 object-contain"
            />
          </div>
          <div className="min-w-0">
            <p className={`wdg__eyebrow ${prefs.showHeroCover && centre?.imageUrl ? 'text-white/75' : 'text-slate-400 dark:text-slate-500'}`}>
              {t('etablissement.title')}
            </p>
            <h1 className={`break-words font-display text-xl font-extrabold sm:text-[26px] ${
              prefs.showHeroCover && centre?.imageUrl ? 'text-white' : 'text-slate-900 dark:text-white'
            }`}>
              {centre?.nom || userNom || t('etablissement.subtitle')}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {centre?.ville || centre?.region ? (
                <span className={`inline-flex items-center gap-1 text-xs font-medium ${prefs.showHeroCover && centre?.imageUrl ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}`}>
                  <MapPin className="h-3.5 w-3.5" style={{ color: accent }} />
                  {[centre.ville, centre.region].filter(Boolean).join(' · ')}
                </span>
              ) : null}
              {mon?.role ? (
                <span className="wdg-chip wdg-chip--slate">{t(`etablissement.${ROLE_LABELS[mon.role] ?? 'roleLecture'}`)}</span>
              ) : null}
              {verification === 'VERIFIE' ? (
                <span className="wdg-chip wdg-chip--mint">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  {t('etablissement.verificationOk')}
                </span>
              ) : verification === 'EN_COURS' ? (
                <span className="wdg-chip wdg-chip--amber">
                  <Clock className="h-3.5 w-3.5" />
                  {t('etablissement.verificationPending')}
                </span>
              ) : (verification && (
                <span className="wdg-chip wdg-chip--slate">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {t('etablissement.verificationNone')}
                </span>
              ))}
              {centre?.urgences24h && (
                <span className="wdg-chip wdg-chip--red">
                  <Siren className="h-3.5 w-3.5" />
                  {t('etablissement.urgencesLabel')}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="relative flex flex-wrap items-center gap-2">
          {centre && (
            <Link
              href={`/carte?centre=${centre.id}`}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-white/80 bg-white/80 px-4 text-xs font-bold text-slate-700 transition hover:bg-white dark:border-white/10 dark:bg-slate-950/70 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              <ArrowUpRight className="h-4 w-4" />
              {t('etablissement.fichePublicLink')}
            </Link>
          )}
          {(isAdmin || centre) && (
            <HeaderChip icon={RefreshCw} onClick={onRefresh} label={t('etablissement.refresh')} disabled={loadingMon} />
          )}
          {isAdmin && (
            <HeaderChip
              icon={syncLabelIcon(syncing)}
              onClick={onSync}
              label={syncing ? t('etablissement.syncing') : t('etablissement.syncRun')}
              spin={syncing}
              accent
            />
          )}
        </div>
      </div>

      {statsTotal != null && (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="wdg-chip wdg-chip--slate">
            <MapPin className="h-3.5 w-3.5" style={{ color: accent }} />
            {statsTotal || 0} {t('etablissement.establishmentCount')}
          </span>
          {lastSync ? (
            <span className="wdg-chip wdg-chip--mint">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {t('etablissement.syncLast', { date: new Date(lastSync).toLocaleString(i18n.language) })}
            </span>
          ) : (
            <span className="wdg-chip wdg-chip--slate">
              <Clock className="h-3.5 w-3.5" />
              {t('etablissement.syncNever')}
            </span>
          )}
          <span className="ml-auto flex items-center gap-1.5 text-[11px] font-bold text-slate-400 dark:text-slate-500">
            <span className="wdg-live-dot" />
            {t('etablissement.widgetLive')}
          </span>
        </div>
      )}
    </GlassCard>
  )
}

/* ── Bandeau KPI ─────────────────────────────────────────────────────────── */

function KpiBand({ dashboard, prefs }: { dashboard: DashboardData | null; prefs: Prefs }) {
  const { t } = useTranslation()
  const sos = dashboard?.sos
  const avis = dashboard?.avis
  const medecins = dashboard?.medecins
  const equipe = dashboard?.equipe
  const note = avis?.noteMoyenne
  const count = avis?.totalEnBase ?? 0

  return (
    <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3`}>
      <StatCard
        icon={Siren}
        tile={prefs.showSos ? 'red' : 'accent'}
        highlight={prefs.showSos}
        label={t('etablissement.sosLabel')}
        value={sos?.total ?? 0}
        caption={sos?.enCours ? `${sos.enCours} ${t('etablissement.sosEnCours')}` : undefined}
        delay={0}
      />
      <StatCard
        icon={MessageSquare}
        tile="accent"
        label={t('etablissement.avisTitle')}
        value={count}
        caption={note != null ? t('etablissement.avisScoreCaption', { note: Number(note).toFixed(1) }) : undefined}
        delay={60}
      />
      <StatCard
        icon={Star}
        tile="amber"
        label={t('etablissement.noteLabel')}
        value={note != null ? `${Number(note).toFixed(1)}/5` : '—'}
        caption={t('etablissement.noteCaption')}
        delay={120}
      />
      <StatCard
        icon={Stethoscope}
        tile="sky"
        label={t('etablissement.medecinsTitle')}
        value={medecins?.acceptes ?? 0}
        caption={medecins?.enAttente ? `${medecins.enAttente} ${t('etablissement.enAttenteLabel').toLowerCase()}` : undefined}
        delay={180}
      />
      <StatCard
        icon={Users}
        tile="violet"
        label={t('etablissement.equipeTitle')}
        value={equipe?.total ?? 0}
        caption={t('etablissement.teamCaption')}
        delay={240}
      />
      <StatCard
        icon={ShieldCheck}
        tile="mint"
        label={t('etablissement.ficheCompleteness')}
        value="—"
        caption={t('etablissement.ficheCompletenessHint')}
        delay={300}
      />
    </div>
  )
}

/* ── Widgets statistiques ────────────────────────────────────────────────── */

function StatsSosWidget({ dashboard, prefs }: { dashboard: DashboardData | null; prefs: Prefs }) {
  const { t } = useTranslation()
  const sos = dashboard?.sos
  const total = sos?.total ?? 0
  const enCours = sos?.enCours ?? 0
  const traitees = sos?.traitees ?? 0
  const cloturees = sos?.cloturees ?? 0
  const active = prefs.showSos
  const donutColor = active ? '#ef4444' : 'var(--accent,#10b981)'
  const share = total > 0 ? Math.min(100, Math.round((enCours / total) * 100)) : 0
  const center = useCountUp(enCours)

  const rows: { key: string; value: number; color: string }[] = [
    { key: t('etablissement.sosEnCours'), value: enCours, color: active ? '#ef4444' : 'var(--accent,#10b981)' },
    { key: t('etablissement.sosTraitees'), value: traitees, color: '#10b981' },
    { key: t('etablissement.sosCloturees'), value: cloturees, color: '#0ea5e9' },
  ]

  return (
    <GlassCard hover className="wdg-anim p-5" delay={60}>
      <SectionHeader
        eyebrow={t('etablissement.sosWidgetDesc')}
        title={t('etablissement.sosWidgetTitle')}
        action={
          dashboard ? (
            <span className="wdg-chip wdg-chip--red">
              <span className="wdg-live-dot wdg-live-dot--red" />
              {t('etablissement.widgetLive')}
            </span>
          ) : (
            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
          )
        }
      />
      <div className="mt-5 flex items-center justify-center gap-6">
        <div
          className="wdg-donut relative grid place-items-center"
          style={{ ['--p' as never]: share, ['--dc' as never]: donutColor }}
        >
          <div className="absolute inset-0 grid place-items-center">
            <div className="text-center">
              <p className="wdg__value text-2xl">{center}</p>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t('etablissement.sosEnCours')}</p>
            </div>
          </div>
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          {rows.map((row, index) => (
            <div key={row.key}>
              <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                <span>{row.key}</span>
                <span className="font-bold text-slate-700 dark:text-slate-200">{row.value}</span>
              </div>
              <div className="wdg-progress" style={{ background: `color-mix(in srgb, ${row.color} 18%, transparent)` }}>
                <div
                  className="wdg-progress__bar"
                  style={{
                    width: `${total > 0 ? Math.max(4, Math.round((row.value / total) * 100)) : 0}%`,
                    background: `linear-gradient(90deg, ${row.color}, ${row.color})`,
                    animationDelay: `${150 + index * 120}ms`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      {total === 0 && (
        <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2.5 text-[11px] font-semibold text-slate-400 dark:bg-slate-950/50">
          {t('etablissement.sosNoData')}
        </p>
      )}
    </GlassCard>
  )
}

function StatsAvisWidget({ dashboard, reviews }: { dashboard: DashboardData | null; reviews: ManagedReview[] }) {
  const { t } = useTranslation()
  const avis = dashboard?.avis
  const note = avis?.noteMoyenne
  const distribution = [5, 4, 3, 2, 1].map((n) => ({
    note: n,
    count: reviews.filter((item) => Math.round(item.note) === n).length,
  }))
  const max = Math.max(1, ...distribution.map((d) => d.count))
  const notePct = note != null ? Math.max(2, Math.min(100, (note / 5) * 100)) : 0

  return (
    <GlassCard hover className="wdg-anim p-5" delay={120}>
      <SectionHeader
        eyebrow={t('etablissement.avisWidgetDesc')}
        title={t('etablissement.avisWidgetTitle')}
        action={
          <span className="wdg-chip wdg-chip--amber">
            <Star className="h-3 w-3 fill-current" />
            {note != null ? Number(note).toFixed(1) : '—'}
          </span>
        }
      />
      <div className="mt-5 flex items-center gap-4">
        <div className="text-center">
          <p className="wdg__value text-4xl text-amber-500">{note != null ? Number(note).toFixed(1) : '—'}</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">/ 5</p>
          <div className="relative mt-1.5 inline-flex">
            <div className="flex gap-0.5 text-slate-200 dark:text-slate-700">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star key={n} className="h-4 w-4" />
              ))}
            </div>
            <div className="absolute inset-0 flex gap-0.5 overflow-hidden" style={{ width: `${notePct}%` }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Star key={n} className="h-4 w-4 shrink-0 fill-amber-400 text-amber-400" />
              ))}
            </div>
          </div>
          <p className="mt-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400">
            {avis?.totalEnBase ?? 0} {t('etablissement.avisCountLabel')}
          </p>
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          {distribution.map((d, index) => (
            <div key={d.note} className="flex items-center gap-2">
              <span className="w-7 text-right text-[11px] font-bold text-slate-500 dark:text-slate-400">{d.note}</span>
              <div className="wdg-progress flex-1" style={{ background: 'color-mix(in srgb, #f59e0b 14%, transparent)' }}>
                <div
                  className="wdg-progress__bar"
                  style={{
                    width: `${Math.max(d.count > 0 ? 6 : 0, Math.round((d.count / max) * 100))}%`,
                    background: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
                    animationDelay: `${150 + index * 90}ms`,
                  }}
                />
              </div>
              <span className="w-7 text-right text-[11px] font-bold text-slate-400">{d.count}</span>
            </div>
          ))}
        </div>
      </div>
      {reviews.length === 0 && (
        <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2.5 text-[11px] font-semibold text-slate-400 dark:bg-slate-950/50">
          {t('etablissement.reviewsEmpty')}
        </p>
      )}
    </GlassCard>
  )
}

function StatsEquipeWidget({ dashboard, equipe }: { dashboard: DashboardData | null; equipe: EquipeMembre[] }) {
  const { t } = useTranslation()
  const roles = dashboard?.equipe
  const total = roles?.total ?? 0
  const max = Math.max(1, ...TEAM_ROLES.map((role) => roles?.[role] ?? 0))
  const displayed = equipe.slice(0, 4)
  const extra = Math.max(0, equipe.length - displayed.length)

  return (
    <GlassCard hover className="wdg-anim p-5" delay={180}>
      <SectionHeader
        eyebrow={t('etablissement.equipeWidgetDesc')}
        title={t('etablissement.equipeWidgetTitle')}
        action={
          <span className="wdg-chip wdg-chip--violet">
            <Users className="h-3 w-3" />
            {total}
          </span>
        }
      />
      <div className="mt-5 space-y-3">
        {TEAM_ROLES.map((role, index) => {
          const value = roles?.[role] ?? 0
          if (value === 0) return null
          const tone = ROLE_TONE[role] ?? 'slate'
          return (
            <div key={role}>
              <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                <span className="wdg-chip wdg-chip--slate px-2 py-0.5 text-[10px]">
                  {t(`etablissement.${ROLE_LABELS[role] ?? 'roleLecture'}`)}
                </span>
                <span className="font-bold text-slate-700 dark:text-slate-200">{value}</span>
              </div>
              <div className={`wdg-progress mb-3 ${tone}`} style={{ background: 'color-mix(in srgb, var(--accent,#10b981) 14%, transparent)' }}>
                <div
                  className="wdg-progress__bar"
                  style={{
                    width: `${Math.max(6, Math.round((value / max) * 100))}%`,
                    animationDelay: `${120 + index * 100}ms`,
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
      {equipe.length > 0 && (
        <div className="mt-4 flex items-center gap-3">
          <div className="flex -space-x-2">
            {displayed.map((member) => (
              <Avatar
                key={member.id}
                name={`${member.prenom ?? ''} ${member.nom ?? ''}`.trim() || member.email}
                src={member.photoProfil ? imgUrl(member.photoProfil) : null}
                size="sm"
              />
            ))}
            {extra > 0 && (
              <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-slate-200 text-[10px] font-extrabold text-slate-600 dark:border-slate-900 dark:bg-slate-700 dark:text-slate-200">
                +{extra}
              </span>
            )}
          </div>
          <p className="text-[11px] font-semibold text-slate-400">
            {equipe.length} {t('etablissement.teamCaption')}
          </p>
        </div>
      )}
    </GlassCard>
  )
}

/* ── Réclamation d'établissement ─────────────────────────────────────────── */

function ClaimWizard({
  accent,
  searchQuery,
  onSearchQuery,
  searching,
  onSearch,
  results,
  claiming,
  claimedId,
  onClaim,
  isManager,
}: {
  accent: string
  searchQuery: string
  onSearchQuery: (value: string) => void
  searching: boolean
  onSearch: () => void
  results: CentreLite[]
  claiming: boolean
  claimedId: number | null
  onClaim: (id: number) => void
  isManager: boolean
}) {
  const { t, i18n } = useTranslation()
  return (
    <GlassCard glow className="wdg-anim mt-6 p-6">
      <div className="flex items-center gap-3">
        <div className="wdg__tile flex h-11 w-11 items-center justify-center rounded-xl text-white">
          <Building2 className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
            {isManager ? t('etablissement.switchCentre') : t('etablissement.noClaim')}
          </h2>
          <p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">
            {isManager && t('etablissement.switchNote')}
            {!isManager && t('etablissement.claimLegend')}
          </p>
        </div>
      </div>

      <form
        className="mt-4 flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault()
          onSearch()
        }}
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={searchQuery}
            onChange={(event) => onSearchQuery(event.target.value)}
            className="min-h-11 w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-3.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:bg-slate-900"
            placeholder={t('etablissement.searchPlaceholder')}
          />
        </div>
        <button
          type="submit"
          disabled={searching || searchQuery.trim().length < 2}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-bold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ backgroundColor: accent }}
        >
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {searching ? t('etablissement.searching') : t('etablissement.search')}
        </button>
      </form>

      <div className="mt-4 space-y-2">
        {results.length === 0 && searchQuery.trim().length >= 2 && !searching && (
          <p className="rounded-lg bg-slate-50 px-3 py-3 text-xs text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
            {t('etablissement.noResults')}
          </p>
        )}
        {results.map((centre) => {
          const isClaiming = claiming && claimedId === centre.id
          return (
            <div
              key={centre.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950/40 dark:hover:border-slate-600"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{centre.nom}</p>
                <p className="mt-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {t(`etablissement.types.${TYPE_TRANSLATION_KEYS[centre.type] ?? 'unknown'}`, {
                    defaultValue: centre.type,
                  })}
                  {centre.ville ? ` · ${centre.ville}` : ''}
                  {centre.region ? ` · ${centre.region}` : ''}
                </p>
              </div>
              <button
                type="button"
                disabled={claiming}
                onClick={() => onClaim(centre.id)}
                className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg px-3.5 text-xs font-bold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                style={{ backgroundColor: accent }}
              >
                {isClaiming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                {isClaiming ? t('etablissement.claiming') : t('etablissement.claimConfirm')}
              </button>
            </div>
          )
        })}
      </div>
    </GlassCard>
  )
}

/* ── Équipe ──────────────────────────────────────────────────────────────── */

function TeamPanel({
  equipe,
  memberEmail,
  setMemberEmail,
  memberRole,
  setMemberRole,
  onAdd,
  adding,
  onRoleChange,
  onStatusChange,
  onRemove,
  loading,
  error,
  onRetry,
  compact,
}: {
  equipe: EquipeMembre[]
  memberEmail: string
  setMemberEmail: (value: string) => void
  memberRole: string
  setMemberRole: (value: string) => void
  onAdd: () => void
  adding: boolean
  onRoleChange: (member: EquipeMembre, role: string) => void
  onStatusChange: (member: EquipeMembre, statut: string) => void
  onRemove: (member: EquipeMembre) => void
  loading?: boolean
  error?: boolean
  onRetry?: () => void
  compact?: boolean
}) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const active = equipe.filter((m) => m.statut === 'ACTIF').length
  const doctors = equipe.filter((m) => m.role === 'MEDECIN').length
  const filteredMembers = equipe.filter((member) => {
    const haystack = `${member.prenom ?? ''} ${member.nom ?? ''} ${member.email}`.toLowerCase()
    return (
      (roleFilter === 'ALL' || member.role === roleFilter) &&
      (statusFilter === 'ALL' || member.statut === statusFilter) &&
      (!query.trim() || haystack.includes(query.trim().toLowerCase()))
    )
  })
  return (
    <GlassCard as="section" hover className="wdg-anim p-5" delay={220}>
      <SectionHeader
        eyebrow={t('etablissement.equipeWidgetDesc')}
        title={t('etablissement.equipeTitle')}
        description={t('etablissement.equipeDesc')}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <span className="wdg-chip wdg-chip--mint">
              <Users className="h-3 w-3" />
              {active} {t('etablissement.teamActiveLabel')}
            </span>
            <span className="wdg-chip wdg-chip--blue">
              <UserCheck className="h-3 w-3" />
              {doctors} {t('etablissement.doctorCountLabel')}
            </span>
          </div>
        }
      />

      {error ? (
        <PanelState kind="error" onRetry={onRetry} />
      ) : loading && equipe.length === 0 ? (
        <PanelState kind="loading" />
      ) : null}

      <form
        className="mt-4 flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault()
          onAdd()
        }}
      >
        <input
          value={memberEmail}
          onChange={(event) => setMemberEmail(event.target.value)}
          type="email"
          className="min-h-10 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:bg-slate-900"
          placeholder={t('etablissement.addMemberEmail')}
        />
        <select
          value={memberRole}
          onChange={(event) => setMemberRole(event.target.value)}
          className="min-h-10 rounded-lg border border-slate-200 bg-slate-50 px-2 text-sm font-semibold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          {TEAM_ROLES.map((role) => (
            <option key={role} value={role}>
              {t(`etablissement.${ROLE_LABELS[role] ?? 'roleLecture'}`)}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={adding || memberEmail.trim().length < 3}
          className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-[var(--accent,#10b981)] px-4 text-sm font-bold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {t('etablissement.addMember')}
        </button>
      </form>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="min-h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs font-semibold text-slate-800 outline-none focus:border-[var(--accent,#059669)] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            placeholder={t('etablissement.teamSearchPlaceholder')}
          />
        </label>
        <select
          value={roleFilter}
          onChange={(event) => setRoleFilter(event.target.value)}
          className="min-h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          aria-label={t('etablissement.teamRoleFilter')}
        >
          <option value="ALL">{t('etablissement.allRoles')}</option>
          {TEAM_ROLES.map((role) => (
            <option key={role} value={role}>
              {t(`etablissement.${ROLE_LABELS[role] ?? 'roleLecture'}`)}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="min-h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          aria-label={t('etablissement.teamStatusFilter')}
        >
          <option value="ALL">{t('etablissement.allStatuses')}</option>
          {Object.keys(STATUS_LABELS).map((status) => (
            <option key={status} value={status}>
              {t(`etablissement.${STATUS_LABELS[status]}`)}
            </option>
          ))}
        </select>
      </div>

      <div className={`mt-4 space-y-2 ${compact ? 'max-h-72 overflow-y-auto pr-1' : ''} ${error ? 'opacity-60' : ''}`}>
        {equipe.length === 0 && (
          <p className="rounded-lg bg-slate-50 px-3 py-3 text-xs text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
            {t('etablissement.equipeEmpty')}
          </p>
        )}
        {equipe.length > 0 && filteredMembers.length === 0 && (
          <p className="rounded-lg bg-slate-50 px-3 py-3 text-xs text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
            {t('etablissement.teamFilterEmpty')}
          </p>
        )}
        {filteredMembers.map((member) => {
          const tone = ROLE_TONE[member.role] ?? 'slate'
          return (
            <div
              key={member.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5 transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950/40 dark:hover:border-slate-600"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar
                  name={`${member.prenom ?? ''} ${member.nom ?? ''}`.trim() || member.email}
                  src={member.photoProfil ? imgUrl(member.photoProfil) : null}
                  size="sm"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                    {member.prenom} {member.nom}
                  </p>
                  <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{member.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`wdg-chip ${tone}`}>
                  {t(`etablissement.${ROLE_LABELS[member.role] ?? 'roleLecture'}`)}
                </span>
                <select
                  value={member.role}
                  onChange={(event) => onRoleChange(member, event.target.value)}
                  aria-label={t('etablissement.roleSelectLabel')}
                  className="max-w-28 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-bold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  {TEAM_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {t(`etablissement.${ROLE_LABELS[role] ?? 'roleLecture'}`)}
                    </option>
                  ))}
                </select>
                <select
                  value={member.statut}
                  onChange={(event) => onStatusChange(member, event.target.value)}
                  aria-label={t('etablissement.statusSelectLabel')}
                  className="max-w-24 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-bold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  {Object.keys(STATUS_LABELS).map((status) => (
                    <option key={status} value={status}>
                      {t(`etablissement.${STATUS_LABELS[status]}`)}
                    </option>
                  ))}
                </select>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    member.statut === 'ACTIF'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                      : member.statut === 'REVOQUE'
                        ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
                  }`}
                >
                  {t(`etablissement.${STATUS_LABELS[member.statut] ?? 'statusInvite'}`)}
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(member)}
                  aria-label={t('etablissement.removeMember')}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-300"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </GlassCard>
  )
}

/* ── Galerie médias ──────────────────────────────────────────────────────── */

function MediaPanel({
  items,
  uploading,
  loading,
  error,
  canManageMedia,
  coverUrl,
  settingCover,
  onRetry,
  onUpload,
  onDelete,
  onSetCover,
}: {
  items: ManagedMedia[]
  uploading: boolean
  loading?: boolean
  error?: boolean
  canManageMedia: boolean
  coverUrl?: string | null
  settingCover?: boolean
  onRetry?: () => void
  onUpload: (file: File) => void
  onDelete: (item: ManagedMedia) => void
  onSetCover: (item: ManagedMedia | null) => void
}) {
  const { t } = useTranslation()
  const [dragActive, setDragActive] = useState(false)
  const [query, setQuery] = useState('')
  const [kindFilter, setKindFilter] = useState<'all' | 'image' | 'video'>('all')
  const visibleItems = items.filter((item) => {
    const matchesKind = kindFilter === 'all' || item.kind === kindFilter
    const matchesQuery = !query.trim() || (item.originalName ?? '').toLowerCase().includes(query.trim().toLowerCase())
    return matchesKind && matchesQuery
  })
  const normalizedCoverUrl = coverUrl ? (imgUrl(coverUrl) || coverUrl).replace(/\/+$/, '').toLowerCase() : ''
  return (
    <GlassCard as="section" hover className="wdg-anim p-5" delay={280}>
      <SectionHeader
        eyebrow={t('etablissement.galleryDesc')}
        title={t('etablissement.galleryTitle')}
        action={
          <>
            <span className="wdg-chip wdg-chip--slate">
              <FileImage className="h-3 w-3" />
              {items.length}
            </span>
            {canManageMedia && (
              <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg bg-[var(--accent,#10b981)] px-4 text-xs font-bold text-white transition hover:brightness-105">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {uploading ? t('etablissement.mediaUploading') : t('etablissement.mediaAdd')}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
                  className="sr-only"
                  disabled={uploading}
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) onUpload(file)
                    event.currentTarget.value = ''
                  }}
                />
              </label>
            )}
          </>
        }
      />

      {error ? (
        <PanelState kind="error" onRetry={onRetry} />
      ) : loading && items.length === 0 ? (
        <PanelState kind="loading" />
      ) : null}

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="min-h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs font-semibold text-slate-800 outline-none focus:border-[var(--accent,#059669)] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            placeholder={t('etablissement.mediaSearchPlaceholder')}
          />
        </label>
        <label className="relative block">
          <Filter className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <select
            value={kindFilter}
            onChange={(event) => setKindFilter(event.target.value as 'all' | 'image' | 'video')}
            className="min-h-9 rounded-lg border border-slate-200 bg-white pl-9 pr-7 text-xs font-semibold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            aria-label={t('etablissement.mediaTypeFilter')}
          >
            <option value="all">{t('etablissement.allMedia')}</option>
            <option value="image">{t('etablissement.mediaImage')}</option>
            <option value="video">{t('etablissement.mediaVideo')}</option>
          </select>
        </label>
      </div>

      {items.length === 0 ? (
        canManageMedia ? (
          <label
            className={`mt-4 flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-4 text-center transition ${
              dragActive
                ? 'border-[var(--accent,#059669)] bg-emerald-50/70 dark:bg-emerald-950/20'
                : 'border-slate-300 bg-slate-50 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-950/40'
            }`}
            onDragOver={(event) => {
              event.preventDefault()
              setDragActive(true)
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(event) => {
              event.preventDefault()
              setDragActive(false)
              const file = event.dataTransfer.files?.[0]
              if (file) onUpload(file)
            }}
          >
            <FileImage className="h-7 w-7 text-slate-400" />
            <p className="mt-2 text-sm font-bold text-slate-700 dark:text-slate-200">
              {dragActive ? t('etablissement.mediaDropActive') : t('etablissement.galleryEmpty')}
            </p>
            <p className="mt-1 text-xs text-slate-500">{t('etablissement.mediaSizeHint')}</p>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
              className="sr-only"
              disabled={uploading}
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) onUpload(file)
                event.currentTarget.value = ''
              }}
            />
          </label>
        ) : (
          <p className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-xs font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-400">
            {t('etablissement.galleryEmpty')}
          </p>
        )
      ) : visibleItems.length === 0 ? (
        <p className="mt-4 rounded-lg bg-slate-50 px-3 py-8 text-center text-xs font-semibold text-slate-500 dark:bg-slate-950/50 dark:text-slate-400">
          {t('etablissement.mediaFilterEmpty')}
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {visibleItems.map((item) => {
            const source = imgUrl(item.contentUrl) || item.contentUrl
            const itemUrl = (imgUrl(item.contentUrl) || item.contentUrl).replace(/\/+$/, '').toLowerCase()
            const isCover = Boolean(normalizedCoverUrl && normalizedCoverUrl === itemUrl)
            return (
              <div key={item.id} className={`group relative aspect-[4/3] overflow-hidden rounded-xl border bg-slate-100 dark:bg-slate-800 ${isCover ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200 dark:border-slate-700'}`}>
                {item.kind === 'video' ? (
                  <>
                    <video src={source} muted preload="metadata" className="h-full w-full object-cover" />
                    <Video className="pointer-events-none absolute left-2 top-2 h-5 w-5 text-white" />
                  </>
                ) : (
                  <img src={source} alt={item.originalName || t('etablissement.mediaImage')} className="h-full w-full object-cover" />
                )}
                {canManageMedia && (
                  <button
                    type="button"
                    onClick={() => onDelete(item)}
                    className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-md bg-slate-950/75 text-white opacity-100 transition hover:bg-red-600 sm:opacity-0 sm:group-hover:opacity-100"
                    aria-label={t('etablissement.mediaDeleteAlt')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                {canManageMedia && item.kind === 'image' && (
                  <button
                    type="button"
                    disabled={settingCover}
                    onClick={() => onSetCover(isCover ? null : item)}
                    className={`absolute left-2 top-2 inline-flex min-h-7 items-center gap-1 rounded-md px-2 text-[10px] font-bold transition ${isCover ? 'bg-emerald-600 text-white' : 'bg-white/90 text-slate-700 hover:bg-emerald-50 dark:bg-slate-950/85 dark:text-slate-200 dark:hover:bg-emerald-950/50'}`}
                    aria-pressed={isCover}
                  >
                    <FileImage className="h-3 w-3" />
                    {isCover ? t('etablissement.coverActive') : t('etablissement.setAsCover')}
                  </button>
                )}
                <p className="absolute inset-x-0 bottom-0 truncate bg-slate-950/75 px-2 py-2 text-[10px] font-semibold text-white">
                  {item.originalName || (item.kind === 'video' ? t('etablissement.mediaVideo') : t('etablissement.mediaImage'))}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </GlassCard>
  )
}

/* ── Modération des avis ─────────────────────────────────────────────────── */

const REVIEW_TONE: Record<ManagedReview['statut'], 'mint' | 'red' | 'amber'> = {
  PUBLIE: 'mint',
  REJETE: 'red',
  EN_ATTENTE: 'amber',
}

function ReviewsPanel({
  items,
  moderatingId,
  loading,
  error,
  onRetry,
  onModerate,
}: {
  items: ManagedReview[]
  moderatingId: number | null
  loading?: boolean
  error?: boolean
  onRetry?: () => void
  onModerate: (item: ManagedReview, statut: 'PUBLIE' | 'REJETE') => void
}) {
  const { t, i18n } = useTranslation()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | ManagedReview['statut']>('ALL')
  const published = items.filter((item) => item.statut === 'PUBLIE').length
  const pending = items.filter((item) => item.statut === 'EN_ATTENTE').length
  const filteredItems = items.filter((item) => {
    const search = query.trim().toLowerCase()
    const matchesQuery =
      !search ||
      `${item.auteurNom ?? ''} ${item.commentaire ?? ''}`.toLowerCase().includes(search)
    return matchesQuery && (statusFilter === 'ALL' || item.statut === statusFilter)
  })

  return (
    <GlassCard as="section" hover className="wdg-anim p-5" delay={340}>
      <SectionHeader
        eyebrow={t('etablissement.moderationDesc', { published, hidden: items.length - published })}
        title={t('etablissement.moderationTitle')}
        action={
          <span className="wdg-chip wdg-chip--amber">
            <Clock className="h-3 w-3" />
            {pending} {t('etablissement.reviewPendingLabel')}
          </span>
        }
      />

      {error ? (
        <PanelState kind="error" onRetry={onRetry} />
      ) : loading && items.length === 0 ? (
        <PanelState kind="loading" />
      ) : null}

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="min-h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs font-semibold text-slate-800 outline-none focus:border-[var(--accent,#059669)] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            placeholder={t('etablissement.reviewSearchPlaceholder')}
          />
        </label>
        <label className="relative block">
          <Filter className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as 'ALL' | ManagedReview['statut'])}
            className="min-h-9 rounded-lg border border-slate-200 bg-white pl-9 pr-7 text-xs font-semibold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            aria-label={t('etablissement.reviewStatusFilter')}
          >
            <option value="ALL">{t('etablissement.allStatuses')}</option>
            <option value="EN_ATTENTE">{t('etablissement.reviewPendingLabel')}</option>
            <option value="PUBLIE">{t('etablissement.moderationStatusVisible')}</option>
            <option value="REJETE">{t('etablissement.moderationStatusHidden')}</option>
          </select>
        </label>
      </div>

      <div className="mt-4 max-h-[28rem] divide-y divide-slate-100 overflow-y-auto rounded-xl border-y border-slate-100 dark:divide-white/10 dark:border-white/10">
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">{t('etablissement.moderationEmpty')}</p>
        ) : filteredItems.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">{t('etablissement.reviewFilterEmpty')}</p>
        ) : filteredItems.map((item) => (
          <article key={item.id} className="py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <Avatar name={item.auteurNom || 'U'} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                    {item.auteurNom || t('etablissement.moderationUser')}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600">
                      <Star className="h-3.5 w-3.5 fill-current" />
                      {item.note}/5
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {new Date(item.createdAt).toLocaleDateString(i18n.language)}
                    </span>
                  </div>
                </div>
              </div>
              <span className={`wdg-chip ${REVIEW_TONE[item.statut]}`}>
                {item.statut === 'PUBLIE'
                  ? t('etablissement.moderationStatusVisible')
                  : item.statut === 'EN_ATTENTE'
                    ? t('etablissement.reviewPendingLabel')
                    : t('etablissement.moderationStatusHidden')}
              </span>
            </div>
            {item.commentaire && (
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.commentaire}</p>
            )}
            {item.images && item.images.length > 0 && (
              <div className="mt-3 grid grid-cols-5 gap-1.5">
                {item.images.map((image) => (
                  <a
                    key={image.id}
                    href={imgUrl(image.contentUrl) || image.contentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="group aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800"
                    aria-label={image.originalName || t('etablissement.reviewMedia')}
                  >
                    <img
                      src={imgUrl(image.contentUrl) || image.contentUrl}
                      alt={image.originalName || t('etablissement.reviewMedia')}
                      className="h-full w-full object-cover transition group-hover:opacity-80"
                    />
                  </a>
                ))}
              </div>
            )}
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => onModerate(item, 'PUBLIE')}
                disabled={moderatingId === item.id || item.statut === 'PUBLIE'}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-40 dark:border-white/10 dark:text-slate-200"
              >
                {moderatingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                {t('etablissement.moderationPublish')}
              </button>
              <button
                type="button"
                onClick={() => onModerate(item, 'REJETE')}
                disabled={moderatingId === item.id || item.statut === 'REJETE'}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-40 dark:border-white/10 dark:text-slate-200"
              >
                <EyeOff className="h-3.5 w-3.5" />
                {t('etablissement.moderationHide')}
              </button>
            </div>
          </article>
        ))}
      </div>
    </GlassCard>
  )
}

function PanelState({ kind, onRetry }: { kind: 'loading' | 'error'; onRetry?: () => void }) {
  const { t } = useTranslation()
  if (kind === 'loading') {
    return (
      <div className="mt-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-xs font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('etablissement.loading')}
      </div>
    )
  }
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-xs font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300">
      <span className="inline-flex items-center gap-2">
        <AlertCircle className="h-4 w-4" />
        {t('etablissement.panelLoadError')}
      </span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-red-300 px-2.5 text-[11px] font-bold hover:bg-red-100 dark:border-red-800 dark:hover:bg-red-950/40"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {t('etablissement.retry')}
        </button>
      )}
    </div>
  )
}

/* ── Personnalisation ────────────────────────────────────────────────────── */

function PersonalizationPanel({
  prefs,
  onChange,
  onReset,
  accent,
  centre,
  media,
  onSetCover,
  onSetLogo,
  onUploadImage,
  uploadingMedia,
  settingCover,
  canManageBranding,
}: {
  prefs: Prefs
  onChange: (prefs: Prefs) => void
  onReset: () => void
  accent: string
  centre: FicheCentre
  media: ManagedMedia[]
  onSetCover: (item: ManagedMedia | null) => Promise<boolean>
  onSetLogo: (url: string | null) => Promise<boolean>
  onUploadImage: (file: File) => Promise<ManagedMedia | null>
  uploadingMedia: boolean
  settingCover: boolean
  canManageBranding: boolean
}) {
  const { t } = useTranslation()
  const [logoDraft, setLogoDraft] = useState(centre.logoUrl ?? '')
  const [savingLogo, setSavingLogo] = useState(false)
  const [uploadTarget, setUploadTarget] = useState<'logo' | 'cover' | null>(null)
  const [coverQuery, setCoverQuery] = useState('')
  const [coverProvider, setCoverProvider] = useState<'pexels' | 'pixabay'>('pexels')
  const [coverResults, setCoverResults] = useState<CoverSearchResult[]>([])
  const [coverSearching, setCoverSearching] = useState(false)
  const [coverFeedback, setCoverFeedback] = useState<string | null>(null)
  const [importingCoverId, setImportingCoverId] = useState<string | null>(null)
  const imageMedia = media.filter(item => item.kind === 'image')

  const persistLogo = async (url: string | null) => {
    if (savingLogo) return
    setSavingLogo(true)
    try {
      const saved = await onSetLogo(url)
      if (saved) setLogoDraft(url ?? '')
    } finally {
      setSavingLogo(false)
    }
  }

  const uploadAndAssign = async (target: 'logo' | 'cover', file: File) => {
    if (uploadingMedia || uploadTarget) return
    setUploadTarget(target)
    try {
      const uploaded = await onUploadImage(file)
      if (!uploaded || uploaded.kind !== 'image') return
      if (target === 'logo') {
        await persistLogo(uploaded.contentUrl)
      } else {
        await onSetCover(uploaded)
      }
    } finally {
      setUploadTarget(null)
    }
  }

  const searchCovers = async () => {
    const query = coverQuery.trim()
    if (query.length < 2 || coverSearching) {
      if (query.length < 2) setCoverFeedback(t('etablissement.coverSearchQueryTooShort'))
      return
    }
    setCoverSearching(true)
    setCoverFeedback(null)
    setCoverResults([])
    try {
      const response = await fetch(`/api/cover-search?q=${encodeURIComponent(query)}&provider=${coverProvider}`)
      const data = await response.json() as {
        items?: CoverSearchResult[]
        configurationRequired?: boolean
        error?: string
      }
      if (data.configurationRequired) {
        setCoverFeedback(t('etablissement.coverSearchConfigurationRequired', { provider: coverProvider === 'pexels' ? 'Pexels' : 'Pixabay' }))
        return
      }
      if (!response.ok) {
        setCoverFeedback(t(data.error === 'provider_timeout' ? 'etablissement.coverSearchTimeout' : 'etablissement.coverSearchFailed'))
        return
      }
      const results = data.items ?? []
      setCoverResults(results)
      if (results.length === 0) setCoverFeedback(t('etablissement.coverSearchNoResults'))
    } catch {
      setCoverFeedback(t('etablissement.coverSearchFailed'))
    } finally {
      setCoverSearching(false)
    }
  }

  const importProviderCover = async (result: CoverSearchResult) => {
    if (importingCoverId || settingCover || uploadingMedia) return
    const provider = coverProvider
    setImportingCoverId(result.id)
    setCoverFeedback(null)
    try {
      const response = await fetch('/api/cover-search/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          url: result.url,
          fileName: `${provider}-${result.id}`,
        }),
      })
      if (!response.ok) {
        setCoverFeedback(t('etablissement.coverImportFailed'))
        return
      }

      const image = await response.blob()
      const extension = image.type === 'image/png'
        ? 'png'
        : image.type === 'image/webp'
          ? 'webp'
          : image.type === 'image/gif'
            ? 'gif'
            : 'jpg'
      const file = new File([image], `${provider}-${result.id}.${extension}`, { type: image.type })
      const uploaded = await onUploadImage(file)
      if (!uploaded) return
      await onSetCover(uploaded)
    } catch {
      setCoverFeedback(t('etablissement.coverImportFailed'))
    } finally {
      setImportingCoverId(null)
    }
  }
  return (
    <GlassCard as="section" hover glow className="wdg-anim p-5" delay={400}>
      <SectionHeader
        eyebrow={t('etablissement.personalizationEyebrow')}
        title={t('etablissement.personalizationTitle')}
        description={t('etablissement.personalizationDesc')}
        action={
          <span className="wdg__tile flex h-9 w-9 items-center justify-center rounded-xl text-white" style={{ ['--accent' as never]: accent }}>
            <Palette className="h-4 w-4" />
          </span>
        }
      />

      <p className="mt-5 text-[11px] font-bold uppercase tracking-wide text-slate-400">{t('etablissement.accentColor')}</p>
      <div className="mt-2 flex flex-wrap gap-2.5">
        {ACCENTS.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange({ ...prefs, accent: color })}
            aria-pressed={prefs.accent === color}
            aria-label={t(`etablissement.accentNames.${ACCENT_NAMES[color] ?? 'emerald'}`)}
            className="flex h-9 w-9 items-center justify-center rounded-full transition hover:scale-110 focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-300"
            style={{
              backgroundColor: color,
              outline: prefs.accent === color ? `2px solid ${color}` : undefined,
              outlineOffset: prefs.accent === color ? 3 : undefined,
            }}
          >
            {prefs.accent === color && <Check className="h-4 w-4 text-white" />}
          </button>
        ))}
      </div>

      <p className="mt-5 text-[11px] font-bold uppercase tracking-wide text-slate-400">{t('etablissement.surfaceStyle')}</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {(['glass', 'soft'] as const).map((surface) => (
          <button
            key={surface}
            type="button"
            onClick={() => onChange({ ...prefs, surface })}
            aria-pressed={prefs.surface === surface}
            className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-bold transition ${
              prefs.surface === surface
                ? 'border-transparent text-white'
                : 'border-slate-200 bg-slate-50/60 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-300 dark:hover:bg-slate-900'
            }`}
            style={prefs.surface === surface ? { backgroundColor: 'var(--accent,#10b981)' } : undefined}
          >
            {surface === 'glass' ? <Sparkles className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
            {surface === 'glass' ? t('etablissement.surfaceGlass') : t('etablissement.surfaceSoft')}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-3">
        <Toggle
          checked={prefs.showSos}
          onChange={(value) => onChange({ ...prefs, showSos: value })}
          label={t('etablissement.showSos')}
          accent
        />
        <Toggle
          checked={prefs.compact}
          onChange={(value) => onChange({ ...prefs, compact: value })}
          label={t('etablissement.compactMode')}
          accent
        />
        <Toggle
          checked={prefs.animations}
          onChange={(value) => onChange({ ...prefs, animations: value })}
          label={t('etablissement.animations')}
          description={t('etablissement.animationsDesc')}
          accent
        />
        <Toggle
          checked={prefs.showHeroCover}
          onChange={(value) => onChange({ ...prefs, showHeroCover: value })}
          label={t('etablissement.showHeroCover')}
          accent
        />
      </div>
      {!canManageBranding ? (
        <p className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600 dark:border-slate-700 dark:bg-slate-950/30 dark:text-slate-300">
          {t('etablissement.brandingRestricted')}
        </p>
      ) : (
        <>
      <div className="mt-6 grid gap-4 border-t border-slate-200 pt-5 dark:border-slate-700 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-950/30">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden">
              {centre.logoUrl ? (
                <img
                  src={imgUrl(centre.logoUrl) || centre.logoUrl}
                  alt={t('etablissement.currentLogoAlt', { name: centre.nom })}
                  className="max-h-16 max-w-24 object-contain"
                />
              ) : (
                <ImageIcon className="h-8 w-8 text-slate-300 dark:text-slate-600" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{t('etablissement.logoLabel')}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">{t('etablissement.logoDescription')}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              value={logoDraft}
              onChange={event => setLogoDraft(event.target.value)}
              className="min-h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none transition focus:border-[var(--accent)] dark:border-slate-700 dark:bg-slate-900"
              placeholder="https://..."
              inputMode="url"
            />
            <button
              type="button"
              onClick={() => void persistLogo(logoDraft.trim() || null)}
              disabled={savingLogo}
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
              style={{ backgroundColor: accent }}
            >
              {savingLogo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
              {t('etablissement.saveLogo')}
            </button>
          </div>

          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <label className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
              {uploadTarget === 'logo' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {t('etablissement.uploadLogo')}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                disabled={uploadingMedia || uploadTarget !== null}
                className="sr-only"
                onChange={event => {
                  const file = event.currentTarget.files?.[0]
                  event.currentTarget.value = ''
                  if (file) void uploadAndAssign('logo', file)
                }}
              />
            </label>
            {imageMedia.length > 0 && (
              <select
                value=""
                disabled={savingLogo}
                onChange={event => {
                  const value = event.target.value
                  if (value) void persistLogo(value)
                }}
                className="min-h-10 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="">{t('etablissement.chooseUploadedLogo')}</option>
                {imageMedia.map(item => (
                  <option key={item.id} value={item.contentUrl}>{item.originalName || item.contentUrl}</option>
                ))}
              </select>
            )}
          </div>

          {centre.logoUrl && (
            <button
              type="button"
              onClick={() => void persistLogo(null)}
              disabled={savingLogo}
              className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600 transition hover:bg-white disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t('etablissement.removeLogo')}
            </button>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-950/30">
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-900">
            {centre.imageUrl ? (
              <img
                src={imgUrl(centre.imageUrl) || centre.imageUrl}
                alt={t('etablissement.currentCoverAlt', { name: centre.nom })}
                className="aspect-[16/6] w-full object-cover"
              />
            ) : (
              <div className="flex aspect-[16/6] items-center justify-center text-slate-300 dark:text-slate-600">
                <ImageIcon className="h-8 w-8" />
              </div>
            )}
          </div>
          <p className="mt-3 text-[11px] font-bold uppercase tracking-wide text-slate-400">{t('etablissement.heroCoverLabel')}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">{t('etablissement.heroCoverDescription')}</p>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
              {uploadTarget === 'cover' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {t('etablissement.uploadCover')}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                disabled={uploadingMedia || uploadTarget !== null || settingCover}
                className="sr-only"
                onChange={event => {
                  const file = event.currentTarget.files?.[0]
                  event.currentTarget.value = ''
                  if (file) void uploadAndAssign('cover', file)
                }}
              />
            </label>
            {imageMedia.length > 0 && (
              <select
                disabled={settingCover}
                value=""
                onChange={event => {
                  const item = imageMedia.find(candidate => candidate.contentUrl === event.target.value)
                  if (item) void onSetCover(item)
                }}
                className="min-h-10 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="">{t('etablissement.chooseUploadedCover')}</option>
                {imageMedia.map(item => (
                  <option key={item.id} value={item.contentUrl}>{item.originalName || item.contentUrl}</option>
                ))}
              </select>
            )}
          </div>

          {centre.imageUrl && (
            <button
              type="button"
              onClick={() => void onSetCover(null)}
              disabled={settingCover}
              className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600 transition hover:bg-white disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t('etablissement.removeCover')}
            </button>
          )}
        </section>
      </div>

      <section className="mt-4 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{t('etablissement.coverLibraryTitle')}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">{t('etablissement.coverLibraryDescription')}</p>
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            {t('etablissement.coverProviderAttribution', { provider: coverProvider === 'pexels' ? 'Pexels' : 'Pixabay' })}
          </span>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
          <input
            value={coverQuery}
            onChange={event => setCoverQuery(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void searchCovers()
              }
            }}
            className="min-h-10 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none transition focus:border-[var(--accent)] dark:border-slate-700 dark:bg-slate-900"
            placeholder={t('etablissement.coverSearchPlaceholder')}
            maxLength={100}
          />
          <select
            value={coverProvider}
            onChange={event => {
              setCoverProvider(event.target.value as 'pexels' | 'pixabay')
              setCoverResults([])
              setCoverFeedback(null)
            }}
            className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="pexels">Pexels</option>
            <option value="pixabay">Pixabay</option>
          </select>
          <button
            type="button"
            onClick={() => void searchCovers()}
            disabled={coverSearching || coverQuery.trim().length < 2}
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
          >
            {coverSearching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            {coverSearching ? t('etablissement.searching') : t('etablissement.search')}
          </button>
        </div>

        {coverFeedback && (
          <p role="status" className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-xs leading-5 text-slate-600 dark:bg-slate-900 dark:text-slate-300">
            {coverFeedback}
          </p>
        )}

        {coverResults.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {coverResults.map((result) => (
              <article key={`${coverProvider}:${result.id}`} className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                <button
                  type="button"
                  onClick={() => void importProviderCover(result)}
                  disabled={settingCover || uploadingMedia || importingCoverId !== null}
                  className="group block w-full text-left disabled:cursor-wait disabled:opacity-60"
                >
                  <img
                    src={result.previewUrl}
                    alt={t('etablissement.coverResultAlt', { author: result.author })}
                    className="aspect-[4/3] w-full object-cover transition duration-200 group-hover:scale-[1.02]"
                  />
                  <span className="block truncate px-2.5 pt-2 text-[11px] font-bold text-slate-700 dark:text-slate-200">
                    {importingCoverId === result.id ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        {t('etablissement.coverImporting')}
                      </span>
                    ) : t('etablissement.useThisCover')}
                  </span>
                </button>
                <a
                  href={result.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-h-7 items-center gap-1 truncate px-2.5 pb-2 text-[10px] font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                >
                  {result.author}
                  <ArrowUpRight className="h-3 w-3 shrink-0" />
                </a>
              </article>
            ))}
          </div>
        )}
      </section>
        </>
      )}
      <button
        type="button"
        onClick={onReset}
        className="mt-5 inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 px-3.5 text-xs font-bold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        {t('etablissement.resetSettings')}
      </button>
    </GlassCard>
  )
}
