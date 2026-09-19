'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  Activity,
  Building2,
  Check,
  Eye,
  EyeOff,
  FileImage,
  Loader2,
  LogIn,
  MapPin,
  Palette,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Star,
  Stethoscope,
  Trash2,
  Upload,
  UserPlus,
  Users,
  Video,
} from 'lucide-react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import api from '../../api/axios'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../components/ui/Toast'
import { imgUrl } from '../../lib/config'

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
  centre: CentreLite | null
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

type ManagedReview = {
  id: number
  note: number
  commentaire?: string | null
  statut: 'PUBLIE' | 'REJETE' | 'EN_ATTENTE'
  signale: boolean
  raisonSignalement?: string | null
  auteurNom?: string | null
  createdAt: string
}

type Prefs = {
  accent: string
  showSos: boolean
  compact: boolean
}

const ACCENTS = ['#4f46e5', '#059669', '#0284c7', '#7c3aed', '#e11d48', '#d97706']

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

const PREFS_KEY = 'medisecours_etab_prefs'

function readPrefs(): Prefs {
  if (typeof window === 'undefined') return { accent: ACCENTS[0], showSos: true, compact: false }
  try {
    const raw = window.localStorage.getItem(PREFS_KEY)
    if (!raw) return { accent: ACCENTS[0], showSos: true, compact: false }
    const parsed = JSON.parse(raw) as Partial<Prefs>
    return {
      accent: typeof parsed.accent === 'string' && ACCENTS.includes(parsed.accent) ? parsed.accent : ACCENTS[0],
      showSos: parsed.showSos !== false,
      compact: Boolean(parsed.compact),
    }
  } catch {
    return { accent: ACCENTS[0], showSos: true, compact: false }
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

  // Personnalisation
  const [prefs, setPrefs] = useState<Prefs>(readPrefs)

  const canAccess = isEtablissement || isAdmin
  const accent = prefs.accent

  const applyPrefs = useCallback((next: Prefs) => {
    setPrefs(next)
    try {
      window.localStorage.setItem(PREFS_KEY, JSON.stringify(next))
    } catch {
      // stockage indisponible : on ignore
    }
  }, [])

  /* ── Chargement principal ─────────────────────────────────────────────── */
  const centreById = useMemo(() => {
    return new Map<number, CentreLite>(
      ([] as CentreLite[])
        .concat(mon?.centre ? [mon.centre] : [])
        .concat(results)
        .map((c) => [c.id, c]),
    )
  }, [mon, results])

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
          void api
            .get<{ members: EquipeMembre[] }>('/api/carte/equipes', { params: { centre: centreId } })
            .then(({ data: team }) => setEquipe(team.members))
            .catch(() => undefined)
          void api
            .get<{ items: ManagedMedia[] }>('/api/carte/medias', { params: { centre: centreId } })
            .then(({ data: gallery }) => setMedia(gallery.items ?? []))
            .catch(() => undefined)
          void api
            .get<{ items: ManagedReview[] }>('/api/carte/avis', { params: { centre: centreId } })
            .then(({ data: reviewData }) => setReviews(reviewData.items ?? []))
            .catch(() => undefined)
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
    [mon, t, toast, loadStats],
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
      toast.success('Membre ajouté')
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Impossible d'ajouter ce membre")
    } finally {
      setAddingMember(false)
    }
  }, [memberEmail, memberRole, addingMember, mon, toast])

  const updateMemberRole = useCallback(
    async (member: EquipeMembre, role: string) => {
      try {
        await api.patch(`/api/carte/equipes/${member.id}`, { role })
        setEquipe((current) => current.map((m) => (m.id === member.id ? { ...m, role } : m)))
      } catch (error: any) {
        toast.error(error.response?.data?.error || 'Mise à jour impossible')
      }
    },
    [toast],
  )

  const removeMember = useCallback(
    async (member: EquipeMembre) => {
      try {
        await api.delete(`/api/carte/equipes/${member.id}`)
        setEquipe((current) => current.filter((m) => m.id !== member.id))
      } catch (error: any) {
        toast.error(error.response?.data?.error || 'Suppression impossible')
      }
    },
    [toast],
  )

  /* ── Synchronisation (admin) ──────────────────────────────────────────── */
  const runSync = useCallback(async () => {
    setSyncing(true)
    try {
      const { data } = await api.post<SyncStats>('/api/carte/sync')
      if (data.configured) {
        toast.success(`${data.created ?? 0} créés, ${data.updated ?? 0} enrichis`)
        void loadStats()
        void loadMonEtablissement()
      } else {
        toast.info(data.error || 'Synchronisation indisponible')
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Échec de la synchronisation')
    } finally {
      setSyncing(false)
    }
  }, [toast, loadStats, loadMonEtablissement])

  const uploadMedia = useCallback(async (file: File) => {
    if (!mon?.centre?.id || uploadingMedia) return
    setUploadingMedia(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('centre', String(mon.centre.id))
      const { data } = await api.post<{ media: ManagedMedia }>('/api/carte/medias', form)
      setMedia((current) => [data.media, ...current])
      toast.success('Media ajoute a la fiche publique')
    } catch (error: any) {
      toast.error(error.response?.data?.detail || error.response?.data?.error || "Impossible d'ajouter ce media")
    } finally {
      setUploadingMedia(false)
    }
  }, [mon, toast, uploadingMedia])

  const deleteMedia = useCallback(async (item: ManagedMedia) => {
    try {
      await api.delete(`/api/carte/medias/${item.id}`)
      setMedia((current) => current.filter((mediaItem) => mediaItem.id !== item.id))
      toast.success('Media supprime')
    } catch {
      toast.error('Suppression du media impossible')
    }
  }, [toast])

  const moderateReview = useCallback(async (review: ManagedReview, statut: 'PUBLIE' | 'REJETE') => {
    setModeratingReview(review.id)
    try {
      const { data } = await api.patch<{ avis: ManagedReview }>(`/api/carte/avis/${review.id}`, {
        statut,
        raison: statut === 'REJETE' ? 'Avis masque par le responsable de l etablissement' : null,
      })
      setReviews((current) => current.map((item) => item.id === review.id ? data.avis : item))
      toast.success(statut === 'PUBLIE' ? 'Avis publie' : 'Avis masque')
      void loadMonEtablissement()
    } catch {
      toast.error("La moderation de l'avis a echoue")
    } finally {
      setModeratingReview(null)
    }
  }, [loadMonEtablissement, toast])

  const reloadData = useCallback(() => {
    if (mon?.centre?.id != null) {
      void api
        .get<DashboardData>('/api/carte/dashboard', { params: { centre: mon.centre.id } })
        .then(({ data: dash }) => setDashboard(dash))
        .catch(() => undefined)
      void api
        .get<{ members: EquipeMembre[] }>('/api/carte/equipes', { params: { centre: mon.centre.id } })
        .then(({ data: team }) => setEquipe(team.members))
        .catch(() => undefined)
      void api
        .get<{ items: ManagedMedia[] }>('/api/carte/medias', { params: { centre: mon.centre.id } })
        .then(({ data: gallery }) => setMedia(gallery.items ?? []))
        .catch(() => undefined)
      void api
        .get<{ items: ManagedReview[] }>('/api/carte/avis', { params: { centre: mon.centre.id } })
        .then(({ data: reviewData }) => setReviews(reviewData.items ?? []))
        .catch(() => undefined)
      void loadStats()
    }
  }, [mon, loadStats])

  /* ── Rendu de garde ───────────────────────────────────────────────────── */
  if (!mounted) {
    return (
      <MinimalShell>
        <div className="flex items-center justify-center gap-2 py-24 text-sm font-semibold text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          Chargement…
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
    <div className="etablissement-dashboard overflow-x-hidden" style={{ ['--accent' as never]: accent }}>
      <div className="min-h-[calc(100dvh-76px)] w-full overflow-x-hidden bg-slate-50 dark:bg-slate-950 xl:min-h-[calc(100dvh-96px)]">
        <div className="mx-auto w-full max-w-6xl min-w-0 px-3 py-4 sm:px-6 sm:py-6 xl:py-10">
          {/* ═══ En-tête ═══ */}
          <header className="relative isolate min-w-0 overflow-hidden rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-900/80 sm:p-8">
            <span
              className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full opacity-20 blur-3xl"
              style={{ backgroundColor: accent }}
            />
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-xl text-white shadow-lg"
                  style={{ backgroundColor: accent }}
                >
                  <Building2 className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {t('etablissement.title')}
                  </p>
                  <h1 className="break-words font-display text-xl font-extrabold text-slate-900 dark:text-white sm:text-2xl">
                    {mon?.centre?.nom || user?.etablissementNom || t('etablissement.subtitle')}
                  </h1>
                  {mon?.centre && (
                    <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                      {mon.centre.ville || ''}
                      {mon.centre.region ? ` · ${mon.centre.region}` : ''}
                      {mon.role ? ` · ${t(`etablissement.${ROLE_LABELS[mon.role] ?? 'roleLecture'}`)}` : ''}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {(isAdmin || mon?.centre) && (
                  <HeaderChip
                    icon={RefreshCw}
                    onClick={reloadData}
                    label="Actualiser"
                    disabled={loadingMon}
                  />
                )}
                {isAdmin && (
                  <HeaderChip
                    icon={syncLabelIcon(syncing)}
                    onClick={runSync}
                    label={syncing ? t('etablissement.syncing') : t('etablissement.syncRun')}
                    spin={syncing}
                    accent
                  />
                )}
              </div>
            </div>

            {/* Données de la carte (total + dernière synchro) */}
            {statsTotal != null && (
              <div className="mt-5 flex flex-wrap gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 dark:bg-white/5">
                  <MapPin className="h-3.5 w-3.5" style={{ color: accent }} />
                  {statsTotal} établissements
                </span>
                {lastSync ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                    <Check className="h-3.5 w-3.5" />
                    {t('etablissement.syncLast', { date: new Date(lastSync).toLocaleString() })}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 dark:bg-white/5">
                    {t('etablissement.syncNever')}
                  </span>
                )}
              </div>
            )}
          </header>

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
              Chargement…
            </div>
          ) : !mon?.centre ? (
            <ClaimWizard
              accent={accent}
              searchQuery={searchQuery}
              onSearchQuery={setSearchQuery}
              searching={searching}
              onSearch={runSearch}
              results={results}
              typeLabels={TYPE_LABELS}
              claiming={claiming}
              claimedId={claimedId}
              onClaim={claim}
              isManager={Boolean(mon?.centre)}
            />
          ) : prefs.compact ? (
            <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
              <OverviewPanel dashboard={dashboard} prefs={prefs} accent={accent} />
              <MediaPanel
                items={media}
                uploading={uploadingMedia}
                onUpload={uploadMedia}
                onDelete={deleteMedia}
              />
              <ReviewsPanel
                items={reviews}
                moderatingId={moderatingReview}
                onModerate={moderateReview}
              />
              <TeamPanel
                accent={accent}
                equipe={equipe}
                memberEmail={memberEmail}
                setMemberEmail={setMemberEmail}
                memberRole={memberRole}
                setMemberRole={setMemberRole}
                onAdd={addMember}
                adding={addingMember}
                onRoleChange={updateMemberRole}
                onRemove={removeMember}
                compact
              />
              <PersonalizationPanel prefs={prefs} onChange={applyPrefs} />
            </div>
          ) : (
            <div className="mt-6 space-y-6">
              <OverviewPanel dashboard={dashboard} prefs={prefs} accent={accent} />
              <MediaPanel
                items={media}
                uploading={uploadingMedia}
                onUpload={uploadMedia}
                onDelete={deleteMedia}
              />
              <ReviewsPanel
                items={reviews}
                moderatingId={moderatingReview}
                onModerate={moderateReview}
              />
              <TeamPanel
                accent={accent}
                equipe={equipe}
                memberEmail={memberEmail}
                setMemberEmail={setMemberEmail}
                memberRole={memberRole}
                setMemberRole={setMemberRole}
                onAdd={addMember}
                adding={addingMember}
                onRoleChange={updateMemberRole}
                onRemove={removeMember}
              />
              <PersonalizationPanel prefs={prefs} onChange={applyPrefs} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function syncLabelIcon(syncing: boolean) {
  return syncing ? Loader2 : RefreshCw
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
    <div className="rounded-2xl border border-white/80 bg-white/90 p-8 text-center shadow-sm dark:border-white/10 dark:bg-slate-900/80">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
        <ShieldCheck className="h-6 w-6" />
      </div>
      <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">{title}</h2>
      <div className="mt-6 flex flex-col gap-3">
        <Link
          href={primary.href}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-bold text-white transition hover:bg-indigo-700"
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
      style={isAccent ? { backgroundColor: 'var(--accent, #4f46e5)' } : undefined}
    >
      <Icon className={`h-4 w-4 ${spin ? 'animate-spin' : ''}`} />
      {label}
    </button>
  )
}

function ClaimWizard({
  accent,
  searchQuery,
  onSearchQuery,
  searching,
  onSearch,
  results,
  typeLabels,
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
  typeLabels: Record<string, string>
  claiming: boolean
  claimedId: number | null
  onClaim: (id: number) => void
  isManager: boolean
}) {
  const { t } = useTranslation()
  return (
    <div className="mt-6 rounded-2xl border border-white/80 bg-white/90 p-6 shadow-sm dark:border-white/10 dark:bg-slate-900/80">
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl text-white"
          style={{ backgroundColor: accent }}
        >
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
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 dark:border-slate-700 dark:bg-slate-950/40"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{centre.nom}</p>
                <p className="mt-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {typeLabels[centre.type] ?? centre.type}
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
    </div>
  )
}

function OverviewPanel({
  dashboard,
  prefs,
  accent,
}: {
  dashboard: DashboardData | null
  prefs: Prefs
  accent: string
}) {
  const { t } = useTranslation()
  const sosTotal = dashboard?.sos?.total ?? 0
  const sosEnCours = dashboard?.sos?.enCours ?? 0
  const avis = dashboard?.avis
  const medecins = dashboard?.medecins

  return (
    <div className="rounded-2xl border border-white/80 bg-white/90 p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/80">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {t('etablissement.overviewTitle')}
        </h2>
        {dashboard ? (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            Live
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400">
            <Loader2 className="h-3 w-3 animate-spin" />
            {t('carte.updating')}
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-2">
        <StatCard
          icon={Activity}
          label={t('etablissement.sosLabel')}
          value={sosTotal}
          extra={sosEnCours ? `${sosEnCours} ${t('etablissement.enAttenteLabel').toLowerCase()}` : undefined}
          accent={accent}
          highlight={prefs.showSos}
        />
        <StatCard icon={Star} label={t('etablissement.avisTitle')} value={avis?.totalEnBase ?? 0} accent={accent} />
        <StatCard icon={Star} label={t('etablissement.noteLabel')} value={avis?.noteMoyenne != null ? `${avis.noteMoyenne} /5` : '—'} accent={accent} />
        <StatCard
          icon={Stethoscope}
          label={t('etablissement.medecinsTitle')}
          value={medecins?.acceptes ?? 0}
          extra={medecins?.enAttente ? `${medecins.enAttente} ${t('etablissement.enAttenteLabel').toLowerCase()}` : undefined}
          accent={accent}
        />
        <StatCard icon={Users} label={t('etablissement.equipeTitle')} value={dashboard?.equipe?.total ?? 0} accent={accent} wide />
      </div>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  extra,
  accent,
  wide,
  highlight,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  label: string
  value: string | number
  extra?: string
  accent: string
  wide?: boolean
  highlight?: boolean
}) {
  return (
    <div
      className={`rounded-xl border p-4 transition ${
        highlight
          ? 'border-red-200 bg-red-50/70 dark:border-red-900/40 dark:bg-red-950/20'
          : 'border-slate-200 bg-slate-50/70 dark:border-slate-700 dark:bg-slate-950/40'
      } ${wide ? 'sm:col-span-2' : ''}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</span>
        <Icon className="h-4 w-4" style={{ color: highlight ? '#dc2626' : accent }} />
      </div>
      <p className="mt-1.5 text-2xl font-extrabold text-slate-900 dark:text-white">{value}</p>
      {extra && <p className="mt-0.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">{extra}</p>}
    </div>
  )
}

function TeamPanel({
  accent,
  equipe,
  memberEmail,
  setMemberEmail,
  memberRole,
  setMemberRole,
  onAdd,
  adding,
  onRoleChange,
  onRemove,
  compact,
}: {
  accent: string
  equipe: EquipeMembre[]
  memberEmail: string
  setMemberEmail: (value: string) => void
  memberRole: string
  setMemberRole: (value: string) => void
  onAdd: () => void
  adding: boolean
  onRoleChange: (member: EquipeMembre, role: string) => void
  onRemove: (member: EquipeMembre) => void
  compact?: boolean
}) {
  const { t } = useTranslation()
  return (
    <div className="rounded-2xl border border-white/80 bg-white/90 p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/80">
      <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {t('etablissement.equipeTitle')}
      </h2>

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
              {t(`etablissement.role${role}`)}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={adding || memberEmail.trim().length < 3}
          className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-4 text-sm font-bold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ backgroundColor: accent }}
        >
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {t('etablissement.addMember')}
        </button>
      </form>

      <div className={`mt-4 space-y-2 ${compact ? 'max-h-80 overflow-y-auto pr-1' : ''}`}>
        {equipe.length === 0 && (
          <p className="rounded-lg bg-slate-50 px-3 py-3 text-xs text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
            {t('etablissement.equipeEmpty')}
          </p>
        )}
        {equipe.map((member) => (
          <div
            key={member.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950/40"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                {member.prenom} {member.nom}
              </p>
              <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{member.email}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <select
                value={member.role}
                onChange={(event) => onRoleChange(member, event.target.value)}
                className="max-w-32 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-bold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                {TEAM_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {t(`etablissement.role${role}`)}
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
                aria-label="Retirer le membre"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-300"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function MediaPanel({
  items,
  uploading,
  onUpload,
  onDelete,
}: {
  items: ManagedMedia[]
  uploading: boolean
  onUpload: (file: File) => void
  onDelete: (item: ManagedMedia) => void
}) {
  return (
    <section className="rounded-2xl border border-white/80 bg-white/90 p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/80">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Galerie publique
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Images et videos affichees dans la fiche de la carte.
          </p>
        </div>
        <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg bg-indigo-600 px-4 text-xs font-bold text-white transition hover:bg-indigo-700">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {uploading ? 'Envoi...' : 'Ajouter'}
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
      </div>

      {items.length === 0 ? (
        <div className="mt-4 flex min-h-32 flex-col items-center justify-center border border-dashed border-slate-300 bg-slate-50 text-center dark:border-slate-700 dark:bg-slate-950/40">
          <FileImage className="h-7 w-7 text-slate-400" />
          <p className="mt-2 text-sm font-bold text-slate-700 dark:text-slate-200">Aucun media publie</p>
          <p className="mt-1 text-xs text-slate-500">JPEG, PNG, WebP, GIF, MP4, WebM ou MOV.</p>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => {
            const source = imgUrl(item.contentUrl) || item.contentUrl
            return (
              <div key={item.id} className="group relative aspect-[4/3] overflow-hidden bg-slate-100 dark:bg-slate-800">
                {item.kind === 'video' ? (
                  <>
                    <video src={source} muted preload="metadata" className="h-full w-full object-cover" />
                    <Video className="pointer-events-none absolute left-2 top-2 h-5 w-5 text-white drop-shadow" />
                  </>
                ) : (
                  <img src={source} alt={item.originalName || 'Media etablissement'} className="h-full w-full object-cover" />
                )}
                <button
                  type="button"
                  onClick={() => onDelete(item)}
                  className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-md bg-slate-950/75 text-white opacity-100 transition hover:bg-red-600 sm:opacity-0 sm:group-hover:opacity-100"
                  aria-label="Supprimer ce media"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <p className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/80 to-transparent px-2 pb-2 pt-6 text-[10px] font-semibold text-white">
                  {item.originalName || (item.kind === 'video' ? 'Video' : 'Image')}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

function ReviewsPanel({
  items,
  moderatingId,
  onModerate,
}: {
  items: ManagedReview[]
  moderatingId: number | null
  onModerate: (item: ManagedReview, statut: 'PUBLIE' | 'REJETE') => void
}) {
  const published = items.filter((item) => item.statut === 'PUBLIE').length
  const hidden = items.filter((item) => item.statut === 'REJETE').length

  return (
    <section className="rounded-2xl border border-white/80 bg-white/90 p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/80">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Moderation des avis
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {published} publies, {hidden} masques
          </p>
        </div>
        <div className="flex gap-2 text-[10px] font-bold">
          <span className="bg-emerald-50 px-2 py-1 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            {published} visibles
          </span>
          <span className="bg-slate-100 px-2 py-1 text-slate-600 dark:bg-white/10 dark:text-slate-300">
            {hidden} masques
          </span>
        </div>
      </div>

      <div className="mt-4 max-h-[28rem] divide-y divide-slate-100 overflow-y-auto border-y border-slate-100 dark:divide-white/10 dark:border-white/10">
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">Aucun avis pour le moment.</p>
        ) : items.map((item) => (
          <article key={item.id} className="py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {item.auteurNom || 'Utilisateur MediSecours'}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600">
                    <Star className="h-3.5 w-3.5 fill-current" />
                    {item.note}/5
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <span className={`px-2 py-1 text-[10px] font-bold ${
                item.statut === 'PUBLIE'
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                  : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300'
              }`}>
                {item.statut === 'PUBLIE' ? 'Visible' : 'Masque'}
              </span>
            </div>
            {item.commentaire && (
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.commentaire}</p>
            )}
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => onModerate(item, 'PUBLIE')}
                disabled={moderatingId === item.id || item.statut === 'PUBLIE'}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-40 dark:border-white/10 dark:text-slate-200"
              >
                {moderatingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                Publier
              </button>
              <button
                type="button"
                onClick={() => onModerate(item, 'REJETE')}
                disabled={moderatingId === item.id || item.statut === 'REJETE'}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-40 dark:border-white/10 dark:text-slate-200"
              >
                <EyeOff className="h-3.5 w-3.5" />
                Masquer
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function PersonalizationPanel({
  prefs,
  onChange,
}: {
  prefs: Prefs
  onChange: (prefs: Prefs) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="rounded-2xl border border-white/80 bg-white/90 p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/80">
      <div className="flex items-center gap-2">
        <Palette className="h-4 w-4 text-slate-400" />
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {t('etablissement.personalizationTitle')}
        </h2>
      </div>

      <p className="mt-3 text-[11px] font-bold text-slate-400">{t('etablissement.accentColor')}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {ACCENTS.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange({ ...prefs, accent: color })}
            aria-pressed={prefs.accent === color}
            className="flex h-9 w-9 items-center justify-center rounded-full transition hover:scale-110"
            style={{ backgroundColor: color }}
          >
            {prefs.accent === color && <Check className="h-4 w-4 text-white" />}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-2">
        <ToggleRow
          checked={prefs.showSos}
          onChange={(value) => onChange({ ...prefs, showSos: value })}
          label={t('etablissement.showSos')}
        />
        <ToggleRow
          checked={prefs.compact}
          onChange={(value) => onChange({ ...prefs, compact: value })}
          label={t('etablissement.compactMode')}
        />
      </div>
    </div>
  )
}

function ToggleRow({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950/40">
      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`}
        />
      </button>
    </label>
  )
}
