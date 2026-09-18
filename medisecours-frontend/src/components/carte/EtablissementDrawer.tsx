'use client'

import { useMemo, useState } from 'react'
import {
  Bike,
  Bookmark,
  Building2,
  Car,
  ChevronLeft,
  Clock,
  ExternalLink,
  Footprints,
  History,
  Image as ImageIcon,
  Loader2,
  Mail,
  Map as MapIcon,
  MapPin,
  Medal,
  Navigation,
  Phone,
  PlayCircle,
  Route,
  Search,
  Share2,
  ShieldCheck,
  Star,
  Stethoscope,
  X,
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import useSWR, { mutate } from 'swr'
import api from '../../api/axios'
import { useAuth } from '../../hooks/useAuth'
import type { Position, RouteStep, WayfindingMode } from '../../hooks/useWayfinding'
import {
  FACILITY_COLORS,
  FACILITY_TYPES,
  formatDistanceKm,
  formatDuration,
  formatRelativeDate,
  getEtablissementPhoto,
  getServicesList,
  getSpecialitesList,
  haversineKm,
  toGoogleMapsUrl,
  toWazeUrl,
  WAYFINDING_MODES,
  type Avis,
  type CarteCentre,
  type EtablissementMedia,
  type EtablissementType,
  type FicheCentre,
} from '../../lib/carte'
import { imgUrl } from '../../lib/config'
import { useToast } from '../ui/Toast'

// ─── Helpers UI ──────────────────────────────────────────────────────────────

function Stars({ value, onPick }: { value: number; onPick?: (note: number) => void }) {
  return (
    <div className="flex items-center gap-0.5" role="radiogroup" aria-label="Note">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={!onPick}
          onClick={() => onPick?.(star)}
          aria-label={`${star} étoile${star > 1 ? 's' : ''}`}
          className={onPick ? 'cursor-pointer transition hover:scale-110' : 'cursor-default'}
        >
          <Star
            className={`h-4 w-4 ${star <= value ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600'}`}
          />
        </button>
      ))}
    </div>
  )
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface EtablissementDrawerProps {
  open: boolean
  onClose: () => void
  // Exploration
  visibleCentres: CarteCentre[]
  loading: boolean
  searchQuery: string
  onSearchChange: (query: string) => void
  activeType: 'all' | EtablissementType
  onTypeChange: (type: 'all' | EtablissementType) => void
  onlyUrgence: boolean
  onUrgenceChange: (value: boolean) => void
  // Sélection
  selectedId: number | null
  onSelect: (id: number) => void
  onBackToList: () => void
  // Contexte
  position: Position | null
  favorites: number[]
  recentIds: number[]
  onToggleFavorite: (id: number) => void
  onSosClick: () => void
  onRequestDirections: () => void
  // Itinéraire
  mode: WayfindingMode
  onModeChange: (mode: WayfindingMode) => void
  distance: number | null
  duration: number | null
  steps: RouteStep[]
  routeLoading: boolean
  routeError: string | null
  isFallback: boolean
  routeActive: boolean
  onClearRoute: () => void
}

const TYPE_LABEL_KEYS: Record<'all' | EtablissementType, string> = {
  all: 'visitor.carte.type.all',
  hopital_general: 'visitor.carte.type.hopital_general',
  hopital_de_district: 'visitor.carte.type.hopital_de_district',
  chu: 'visitor.carte.type.chu',
  cma: 'visitor.carte.type.cma',
  csi: 'visitor.carte.type.csi',
  clinique_privee: 'visitor.carte.type.clinique_privee',
  pharmacie: 'visitor.carte.type.pharmacie',
  laboratoire: 'visitor.carte.type.laboratoire',
  centre_specialise: 'visitor.carte.type.centre_specialise',
}

const MODE_ICONS: Record<WayfindingMode, typeof Car> = {
  driving: Car,
  walking: Footprints,
  bicycling: Bike,
}

function mediaUrl(media: EtablissementMedia): string {
  return imgUrl(media.contentUrl) || media.contentUrl
}

function MediaGallery({
  centre,
  compact = false,
}: {
  centre: CarteCentre
  compact?: boolean
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const medias = centre.images?.filter((media) => media.contentUrl) ?? []
  const legacyPhoto = getEtablissementPhoto({ ...centre, images: [] })

  if (medias.length === 0 && !legacyPhoto) {
    return (
      <div className={`${compact ? 'h-40' : 'h-52'} flex w-full items-center justify-center bg-slate-100 text-slate-400 dark:bg-slate-800`}>
        <Building2 className="h-12 w-12" />
      </div>
    )
  }

  const preview = medias.length > 0
    ? medias.slice(0, compact ? 1 : 3)
    : [{ id: -1, contentUrl: legacyPhoto!, kind: 'image' as const }]

  return (
    <>
      <div className={`grid ${compact || preview.length === 1 ? 'grid-cols-1' : 'grid-cols-[2fr_1fr]'} gap-1 overflow-hidden bg-slate-200 dark:bg-slate-800`}>
        {preview.map((media, index) => {
          const isVideo = media.kind === 'video' || media.mimeType?.startsWith('video/')
          return (
            <button
              key={media.id}
              type="button"
              onClick={() => setActiveIndex(Math.max(0, medias.findIndex((item) => item.id === media.id)))}
              className={`relative overflow-hidden bg-slate-200 text-left dark:bg-slate-800 ${
                compact || preview.length === 1
                  ? 'h-40'
                  : index === 0
                    ? 'row-span-2 h-52'
                    : 'h-[102px]'
              }`}
            >
              {isVideo ? (
                <>
                  <video src={mediaUrl(media)} muted preload="metadata" className="h-full w-full object-cover" />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/20 text-white">
                    <PlayCircle className="h-10 w-10 drop-shadow" />
                  </span>
                </>
              ) : (
                <img
                  src={mediaUrl(media)}
                  alt={`${centre.nom} - media ${index + 1}`}
                  className="h-full w-full object-cover transition duration-300 hover:scale-[1.02]"
                />
              )}
              {!compact && index === preview.length - 1 && medias.length > preview.length && (
                <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-black/70 px-2 py-1 text-xs font-bold text-white">
                  <ImageIcon className="h-3.5 w-3.5" />
                  +{medias.length - preview.length}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <AnimatePresence>
        {activeIndex != null && medias[activeIndex] && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/95 p-4"
            role="dialog"
            aria-modal="true"
          >
            <button
              type="button"
              onClick={() => setActiveIndex(null)}
              className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
              aria-label="Fermer la galerie"
            >
              <X className="h-5 w-5" />
            </button>
            {medias[activeIndex].kind === 'video' || medias[activeIndex].mimeType?.startsWith('video/') ? (
              <video
                src={mediaUrl(medias[activeIndex])}
                controls
                autoPlay
                className="max-h-[86dvh] max-w-[92vw]"
              />
            ) : (
              <img
                src={mediaUrl(medias[activeIndex])}
                alt={medias[activeIndex].originalName || centre.nom}
                className="max-h-[86dvh] max-w-[92vw] object-contain"
              />
            )}
            {medias.length > 1 && (
              <div className="absolute bottom-5 flex gap-2">
                {medias.map((media, index) => (
                  <button
                    key={media.id}
                    type="button"
                    onClick={() => setActiveIndex(index)}
                    className={`h-2.5 w-2.5 rounded-full ${index === activeIndex ? 'bg-white' : 'bg-white/40'}`}
                    aria-label={`Media ${index + 1}`}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

function FicheInfos({
  fiche,
  isMedecin,
  medecinJoined,
  onJoin,
  joining,
}: {
  fiche: FicheCentre
  isMedecin: boolean
  medecinJoined: boolean
  onJoin: () => void
  joining: boolean
}) {
  const { t } = useTranslation()
  const services = getServicesList(fiche)
  const specialites = getSpecialitesList(fiche)

  const rows = [
    { key: 'address', icon: MapPin, value: fiche.adresse, extra: [fiche.quartier, fiche.ville, fiche.region].filter(Boolean).join(', ') },
    { key: 'hours', icon: Clock, value: fiche.horaires },
    { key: 'phone', icon: Phone, value: fiche.telephone, href: fiche.telephone ? `tel:${fiche.telephone}` : undefined },
    { key: 'email', icon: Mail, value: fiche.email, href: fiche.email ? `mailto:${fiche.email}` : undefined },
  ].filter((row) => row.value)

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.key} className="flex items-start gap-3">
            <row.icon className="mt-0.5 h-4.5 w-4.5 shrink-0 text-primary-500" />
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{t(`visitor.carte.info.${row.key}`)}</p>
              {row.href ? (
                <a href={row.href} className="text-sm font-semibold text-mint-700 hover:underline dark:text-mint-400">
                  {row.value}
                </a>
              ) : (
                <p className="text-sm text-slate-700 dark:text-slate-200">{row.value}</p>
              )}
              {row.extra && <p className="text-xs text-slate-500 dark:text-slate-400">{row.extra}</p>}
            </div>
          </div>
        ))}
      </div>

      {fiche.siteWeb && (
        <a
          href={fiche.siteWeb}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm font-semibold text-mint-700 hover:underline dark:text-mint-400"
        >
          <ExternalLink className="h-4 w-4" />
          {fiche.siteWeb}
        </a>
      )}

      {services.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-bold text-slate-800 dark:text-slate-100">{t('visitor.carte.info.services')}</p>
          <div className="flex flex-wrap gap-2">
            {services.map((service) => (
              <span key={service} className="rounded-full bg-primary-100 px-2.5 py-1 text-xs font-semibold text-primary-700 dark:bg-primary-500/15 dark:text-primary-200">
                {service}
              </span>
            ))}
          </div>
        </div>
      )}

      {specialites.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-bold text-slate-800 dark:text-slate-100">{t('visitor.carte.info.specialities')}</p>
          <div className="flex flex-wrap gap-2">
            {specialites.map((specialite) => (
              <span key={specialite} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300">
                {specialite}
              </span>
            ))}
          </div>
        </div>
      )}

      {fiche.description && (
        <div>
          <p className="mb-1 text-sm font-bold text-slate-800 dark:text-slate-100">{t('visitor.carte.info.description')}</p>
          <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{fiche.description}</p>
        </div>
      )}

      {/* Médecins affiliés */}
      <div>
        <p className="mb-2 text-sm font-bold text-slate-800 dark:text-slate-100">{t('visitor.carte.info.medecinsTitle')}</p>
        {fiche.medecins && fiche.medecins.length > 0 ? (
          <div className="space-y-2">
            {fiche.medecins.map((medecin) => (
              <div key={medecin.id} className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 dark:border-white/10">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-mint-100 text-mint-700 dark:bg-mint-500/15 dark:text-mint-300">
                  <Stethoscope className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    {medecin.prenom} {medecin.nom}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {medecin.fonction || medecin.specialite || t('visitor.carte.info.consultations')}
                    {medecin.salle ? ` · ${medecin.salle}` : ''}
                  </p>
                  {medecin.teleconsultation && (
                    <p className="mt-1 inline-flex rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-bold text-primary-700 dark:bg-primary-500/15 dark:text-primary-200">
                      {t('visitor.carte.info.consultations')}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('visitor.carte.info.noMedecins')}</p>
        )}

        {isMedecin && !medecinJoined && (
          <button
            type="button"
            onClick={onJoin}
            disabled={joining}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-mint-600 py-2.5 text-sm font-bold text-white transition hover:bg-mint-700 disabled:cursor-wait disabled:opacity-60"
          >
            {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : <Medal className="h-4 w-4" />}
            {joining ? t('visitor.carte.info.joinPending') : t('visitor.carte.info.joinCta')}
          </button>
        )}
        {isMedecin && medecinJoined && (
          <p className="mt-3 rounded-xl bg-mint-50 px-3 py-2 text-center text-xs font-bold text-mint-700 dark:bg-mint-500/10 dark:text-mint-300">
            {t('visitor.carte.info.joinSent')}
          </p>
        )}
      </div>
    </div>
  )
}

export default function EtablissementDrawer({
  open,
  onClose,
  visibleCentres,
  loading,
  searchQuery,
  onSearchChange,
  activeType,
  onTypeChange,
  onlyUrgence,
  onUrgenceChange,
  selectedId,
  onSelect,
  onBackToList,
  position,
  favorites,
  recentIds,
  onToggleFavorite,
  onSosClick,
  onRequestDirections,
  mode,
  onModeChange,
  distance,
  duration,
  steps,
  routeLoading,
  routeError,
  isFallback,
  routeActive,
  onClearRoute,
}: EtablissementDrawerProps) {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const { user, isMedecin, isAuthenticated, isAdmin } = useAuth()
  const [tab, setTab] = useState<'info' | 'directions' | 'reviews'>('info')
  const [note, setNote] = useState(0)
  const [commentaire, setCommentaire] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [joining, setJoining] = useState(false)
  const [joined, setJoined] = useState(false)
  const [view, setView] = useState<'explore' | 'saved' | 'recent'>('explore')

  const [prevSelectedId, setPrevSelectedId] = useState(selectedId)
  if (prevSelectedId !== selectedId) {
    setPrevSelectedId(selectedId)
    setTab('info')
    setNote(0)
    setCommentaire('')
  }

  const selectedCentre = useMemo(
    () => (selectedId != null ? visibleCentres.find((c) => c.id === selectedId) ?? null : null),
    [selectedId, visibleCentres],
  )

  const displayedCentres = useMemo(() => {
    if (view === 'saved') {
      return visibleCentres.filter((centre) => favorites.includes(centre.id))
    }
    if (view === 'recent') {
      const order = new Map(recentIds.map((id, index) => [id, index]))
      return visibleCentres
        .filter((centre) => order.has(centre.id))
        .sort((left, right) => (order.get(left.id) ?? 99) - (order.get(right.id) ?? 99))
    }
    return visibleCentres
  }, [favorites, recentIds, view, visibleCentres])

  const { data: ficheData } = useSWR<FicheCentre>(
    selectedId ? `/api/centre_de_santes/${selectedId}/fiche` : null,
  )

  const { data: avisData, isLoading: avisLoading, mutate: mutateAvis } = useSWR<Avis[]>(
    selectedId ? `/api/avis_etablissements?etablissement=${selectedId}` : null,
    { revalidateOnMount: true },
  )

  const fiche = useMemo(() => (ficheData ? { ...selectedCentre, ...ficheData } : selectedCentre), [ficheData, selectedCentre]) as FicheCentre | null

  const isFavorite = selectedCentre ? favorites.includes(selectedCentre.id) : false
  const medecinJoined = useMemo(() => {
    if (!isMedecin || !user?.id || !fiche?.medecins) return false
    return fiche.medecins.some((medecin) => String(medecin.medecinId) === String(user.id))
  }, [fiche, isMedecin, user])
  const joinShown = joined || medecinJoined

  const handleSubmitAvis = async () => {
    if (!selectedId || note < 1) {
      toast.error(t('visitor.carte.reviews.requiredNote'))
      return
    }
    setSubmitting(true)
    try {
      await api.post('/api/avis_etablissements', {
        etablissement: `/api/centre_de_santes/${selectedId}`,
        note,
        commentaire: commentaire.trim() || null,
      })
      setNote(0)
      setCommentaire('')
      mutateAvis()
      toast.success(t('visitor.carte.reviews.submit'))
      void mutate(`/api/centre_de_santes/${selectedId}/fiche`)
    } catch {
      toast.error(t('visitor.carte.reviews.submitError'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleJoin = async () => {
    if (!selectedId) return
    setJoining(true)
    try {
      await api.post('/api/affiliation_medecins', {
        etablissement: `/api/centre_de_santes/${selectedId}`,
        teleconsultation: false,
      })
      setJoined(true)
      toast.success(t('visitor.carte.info.joinSent'))
    } catch (requestError: any) {
      if (requestError?.response?.status === 409) {
        setJoined(true)
        toast.info(t('visitor.carte.info.joinConflict'))
      } else {
        toast.error(t('visitor.carte.info.joinError'))
      }
    } finally {
      setJoining(false)
    }
  }

  const sortedAvis = useMemo(() => {
    if (!avisData) return []
    return [...avisData].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
  }, [avisData])

  if (!open) return null

  return (
    <div className="pointer-events-none absolute inset-0 z-[800] flex justify-start">
      {/* Voile mobile */}
      <AnimatePresence>
        {selectedId && (
          <motion.button
            type="button"
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onBackToList}
            className="pointer-events-auto absolute inset-0 bg-slate-950/20 backdrop-blur-[1px] xl:hidden"
          />
        )}
      </AnimatePresence>

      <nav className="pointer-events-auto absolute bottom-3 left-3 top-3 hidden w-16 flex-col items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/95 px-1.5 py-3 shadow-2xl backdrop-blur xl:flex dark:border-white/10 dark:bg-slate-950/95">
        {([
          ['explore', MapIcon, 'Explorer'],
          ['saved', Bookmark, 'Enregistres'],
          ['recent', History, 'Recents'],
        ] as const).map(([key, Icon, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setView(key)
              onBackToList()
            }}
            className={`flex w-full flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-bold transition ${
              view === key
                ? 'bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-200'
                : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10'
            }`}
            aria-pressed={view === key}
          >
            <Icon className="h-5 w-5" />
            <span className="w-full truncate">{label}</span>
          </button>
        ))}
      </nav>

      {/* Interface commune a tous les fournisseurs cartographiques. */}
      <aside
        aria-label={t('visitor.carte.title')}
        className="pointer-events-auto absolute inset-x-2 bottom-2 flex min-h-0 max-h-[72dvh] flex-col overflow-hidden rounded-t-2xl border border-slate-200/70 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-950/95 xl:inset-x-auto xl:bottom-3 xl:left-20 xl:top-3 xl:w-[430px] xl:max-h-none xl:rounded-2xl"
      >

        {selectedCentre ? (
          /* ═══════════ DÉTAIL ═══════════ */
          <>
            <div className="relative shrink-0">
              <MediaGallery centre={fiche ?? selectedCentre} compact />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-transparent" />

              <button
                type="button"
                onClick={onBackToList}
                aria-label={t('visitor.carte.backToList')}
                className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-lg transition hover:bg-white"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-3">
                <div className="min-w-0 text-white">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                      style={{
                        backgroundColor: FACILITY_COLORS[selectedCentre.type] ?? '#64748B',
                      }}
                    >
                      {t(TYPE_LABEL_KEYS[selectedCentre.type] ?? 'visitor.carte.type.all')}
                    </span>
                    {selectedCentre.verificationStatut === 'VERIFIE' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-mint-700">
                        <ShieldCheck className="h-3 w-3" />
                        {t('visitor.carte.verified')}
                      </span>
                    )}
                    {selectedCentre.urgences24h && (
                      <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                        {t('visitor.carte.info.urgences24h')}
                      </span>
                    )}
                  </div>
                  <h2 className="mt-1 line-clamp-2 font-display text-xl font-bold leading-tight drop-shadow-md">
                    {selectedCentre.nom}
                  </h2>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="shrink-0 space-y-3 border-b border-slate-100 px-4 py-3 dark:border-white/10">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <Stars value={Math.round(selectedCentre.noteMoyenne ?? 0)} />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                      {(selectedCentre.noteMoyenne ?? 0).toFixed(1)}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {t('visitor.carte.reviews.count', { count: selectedCentre.totalAvis ?? 0 })}
                  </span>
                  {position && (
                    <span className="items-center gap-1 rounded-full bg-mint-100 px-2 py-0.5 text-[10px] font-bold text-mint-800 dark:bg-mint-500/15 dark:text-mint-300">
                      {formatDistanceKm(haversineKm(position, selectedCentre))}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onToggleFavorite(selectedCentre.id)}
                  aria-label={isFavorite ? t('visitor.carte.actions.favorited') : t('visitor.carte.actions.favorite')}
                  title={isFavorite ? t('visitor.carte.actions.favorited') : t('visitor.carte.actions.favorite')}
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition ${
                    isFavorite
                      ? 'border-amber-300 bg-amber-50 text-amber-500 dark:border-amber-500/30 dark:bg-amber-500/10'
                      : 'border-slate-200 text-slate-500 hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10'
                  }`}
                >
                  <Star className={`h-5 w-5 ${isFavorite ? 'fill-amber-400 text-amber-400' : ''}`} />
                </button>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={onRequestDirections}
                  className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-primary-600 px-2 text-xs font-bold text-white transition hover:bg-primary-700"
                >
                  <Navigation className="h-4 w-4" />
                  <span className="truncate">{t('visitor.carte.actions.directions')}</span>
                </button>
                <a
                  href={selectedCentre.telephone ? `tel:${selectedCentre.telephone}` : undefined}
                  aria-disabled={!selectedCentre.telephone}
                  className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border px-2 text-xs font-bold transition ${
                    selectedCentre.telephone
                      ? 'border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10'
                      : 'pointer-events-none border-slate-100 text-slate-300 dark:border-white/5 dark:text-slate-600'
                  }`}
                >
                  <Phone className="h-4 w-4" />
                  <span className="truncate">{t('visitor.carte.actions.call')}</span>
                </a>
                <button
                  type="button"
                  onClick={onSosClick}
                  className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-red-600 px-2 text-xs font-bold text-white transition hover:bg-red-700"
                >
                  <Phone className="h-4 w-4" />
                  <span className="truncate">{t('visitor.carte.sos.title')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const shareData = {
                      title: selectedCentre.nom,
                      text: selectedCentre.adresse,
                      url: window.location.href,
                    }
                    if (navigator.share) {
                      void navigator.share(shareData)
                    } else {
                      void navigator.clipboard?.writeText(window.location.href)
                      toast.success('Lien copie')
                    }
                  }}
                  className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
                  aria-label="Partager cet etablissement"
                >
                  <Share2 className="h-4 w-4" />
                  <span className="truncate">Partager</span>
                </button>
              </div>

              {/* Onglets */}
              <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-white/5">
                {(['info', 'directions', 'reviews'] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTab(key)}
                    className={`min-h-9 flex-1 rounded-lg text-xs font-bold transition ${
                      tab === key
                        ? 'bg-white text-primary-700 shadow-sm dark:bg-slate-800 dark:text-white'
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    {t(`visitor.carte.tabs.${key}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* Contenu */}
            <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-4 py-4 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] xl:pb-6">
              {tab === 'info' && (
                <div className="space-y-5">
                  {(fiche?.images?.length ?? 0) > 1 && <MediaGallery centre={fiche!} />}
                  <FicheInfos
                    fiche={fiche ?? (selectedCentre as FicheCentre)}
                    isMedecin={isMedecin}
                    medecinJoined={joinShown}
                    onJoin={handleJoin}
                    joining={joining}
                  />
                </div>
              )}

              {tab === 'directions' && (
                <div className="space-y-4">
                  {!position ? (
                    <div className="rounded-xl border border-slate-200 p-4 text-center dark:border-white/10">
                      <p className="text-sm text-slate-600 dark:text-slate-300">
                        {t('visitor.carte.directions.needPosition')}
                      </p>
                    </div>
                  ) : !routeActive ? (
                    <button
                      type="button"
                      onClick={onRequestDirections}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 py-3 text-sm font-bold text-white transition hover:bg-primary-700"
                    >
                      <Navigation className="h-4 w-4" />
                      {t('visitor.carte.actions.directions')}
                    </button>
                  ) : (
                    <>
                      {/* Modes de déplacement */}
                      <div className="grid grid-cols-3 gap-2">
                        {WAYFINDING_MODES.map((m) => {
                          const Icon = MODE_ICONS[m]
                          return (
                            <button
                              key={m}
                              type="button"
                              onClick={() => onModeChange(m)}
                              aria-pressed={mode === m}
                              className={`flex min-h-10 items-center justify-center gap-1.5 rounded-xl border text-xs font-bold transition ${
                                mode === m
                                  ? 'border-primary-600 bg-primary-600 text-white'
                                  : 'border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10'
                              }`}
                            >
                              <Icon className="h-4 w-4" />
                              {t(`visitor.carte.directions.${m}`)}
                            </button>
                          )
                        })}
                      </div>

                      {routeLoading ? (
                        <p className="flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:bg-white/5 dark:text-slate-300">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {t('visitor.carte.directions.calculating')}
                        </p>
                      ) : routeError && routeActive ? (
                        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
                          {routeError}
                        </p>
                      ) : (
                        <>
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
                            <div className="flex flex-wrap items-center gap-4">
                              <p className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
                                <Route className="h-4 w-4 text-primary-500" />
                                {formatDistanceKm(distance ? distance / 1000 : null)}
                              </p>
                              <p className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
                                <Clock className="h-4 w-4 text-primary-500" />
                                {formatDuration(duration)}
                              </p>
                              {isFallback && (
                                <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                                  {t('visitor.carte.directions.approx')}
                                </span>
                              )}
                            </div>
                            <div className="mt-3 flex gap-2">
                              <a
                                href={toGoogleMapsUrl(selectedCentre)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                {t('visitor.carte.directions.openGmaps')}
                              </a>
                              <a
                                href={toWazeUrl(selectedCentre)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                              >
                                <Navigation className="h-3.5 w-3.5" />
                                {t('visitor.carte.directions.openWaze')}
                              </a>
                            </div>
                          </div>

                          {steps.length > 0 && (
                            <div>
                              <p className="mb-2 text-sm font-bold text-slate-800 dark:text-slate-100">
                                {t('visitor.carte.directions.steps')}
                              </p>
                              <ol className="space-y-2">
                                {steps.map((step, index) => (
                                  <li key={index} className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 dark:border-white/10">
                                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-[10px] font-bold text-primary-700 dark:bg-primary-500/15 dark:text-primary-200">
                                      {index + 1}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm leading-5 text-slate-700 dark:text-slate-200">{step.instruction}</p>
                                      {step.name && <p className="text-xs text-slate-500 dark:text-slate-400">{step.name}</p>}
                                    </div>
                                    <span className="shrink-0 text-xs font-semibold text-slate-500 dark:text-slate-400">
                                      {step.distance < 1000 ? `${Math.round(step.distance)} m` : `${(step.distance / 1000).toFixed(1)} km`}
                                    </span>
                                  </li>
                                ))}
                              </ol>
                            </div>
                          )}
</>
                        )}
                    </>
                  )}
                </div>
              )}

              {tab === 'reviews' && (
                <div className="space-y-4">
                  {/* Écrire un avis */}
                  {isAuthenticated ? (
                    <div className="rounded-xl border border-slate-200 p-3 dark:border-white/10">
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{t('visitor.carte.reviews.writeTitle')}</p>
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <Stars value={note} onPick={setNote} />
                        <span className="text-xs font-bold text-slate-500">{note > 0 ? `${note}/5` : '–'}</span>
                      </div>
                      <textarea
                        value={commentaire}
                        onChange={(event) => setCommentaire(event.target.value)}
                        placeholder={t('visitor.carte.reviews.commentPlaceholder')}
                        rows={3}
                        className="mt-3 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 dark:border-white/10 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500"
                      />
                      <button
                        type="button"
                        onClick={handleSubmitAvis}
                        disabled={submitting}
                        className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 py-2.5 text-sm font-bold text-white transition hover:bg-primary-700 disabled:cursor-wait disabled:opacity-60"
                      >
                        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                        {t('visitor.carte.reviews.submit')}
                      </button>
                    </div>
                  ) : (
                    <p className="rounded-xl bg-primary-50 px-4 py-3 text-center text-sm font-semibold text-primary-700 dark:bg-primary-500/10 dark:text-primary-200">
                      {t('visitor.carte.reviews.loginCta')}
                    </p>
                  )}

                  {/* Liste des avis */}
                  {avisLoading ? (
                    <div className="flex justify-center py-6">
                      <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
                    </div>
                  ) : sortedAvis.length === 0 ? (
                    <p className="text-center text-sm text-slate-500 dark:text-slate-400">{t('visitor.carte.reviews.noReviews')}</p>
                  ) : (
                    <div className="space-y-3">
                      {sortedAvis
                        .filter((avis) => avis.statut === 'PUBLIE' || isAdmin)
                        .map((avis) => (
                          <div key={avis.id} className="rounded-xl border border-slate-200 p-3 dark:border-white/10">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500 dark:bg-white/10 dark:text-slate-300">
                                  {(avis.auteurNom || 'A')[0]?.toUpperCase()}
                                </span>
                                <div>
                                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                    {avis.auteurNom || t('visitor.carte.reviews.anonymousAuthor')}
                                  </p>
                                  <p className="text-[11px] text-slate-400">{formatRelativeDate(avis.createdAt, i18n.language)}</p>
                                </div>
                              </div>
                              <Stars value={avis.note} />
                            </div>
                            {avis.commentaire && (
                              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{avis.commentaire}</p>
                            )}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          /* ═══════════ LISTE (exploration) ═══════════ */
          <>
            <div className="shrink-0 border-b border-slate-100 px-4 pb-3 pt-4 dark:border-white/10">
              <div className="flex items-center justify-between gap-2">
                <h1 className="font-display text-lg font-bold text-slate-950 dark:text-white">{t('visitor.carte.title')}</h1>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label={t('visitor.carte.close')}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 xl:hidden dark:bg-white/5">
                {([
                  ['explore', MapIcon, 'Explorer'],
                  ['saved', Bookmark, 'Enregistres'],
                  ['recent', History, 'Recents'],
                ] as const).map(([key, Icon, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setView(key)}
                    className={`flex min-h-9 items-center justify-center gap-1 rounded-lg text-[11px] font-bold ${
                      view === key
                        ? 'bg-white text-primary-700 shadow-sm dark:bg-slate-800 dark:text-white'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </div>

              <label className="relative mt-3 block">
                <span className="sr-only">{t('visitor.carte.searchSrOnly')}</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchQuery}
                  onChange={(event) => onSearchChange(event.target.value)}
                  type="search"
                  placeholder={t('visitor.carte.searchPlaceholder')}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-9 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 dark:border-white/10 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => onSearchChange('')}
                    aria-label={t('visitor.carte.clearSearch')}
                    className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </label>

              {/* Filtres catégorie */}
              <div className="mt-3 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label={t('visitor.carte.filterAll')}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeType === 'all'}
                  onClick={() => onTypeChange('all')}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition ${
                    activeType === 'all'
                      ? 'bg-primary-600 text-white'
                      : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-white/10'
                  }`}
                >
                  {t('visitor.carte.filterAll')}
                </button>
                {FACILITY_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    role="tab"
                    aria-selected={activeType === type}
                    onClick={() => onTypeChange(type)}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition ${
                      activeType === type
                        ? 'bg-primary-600 text-white'
                        : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-white/10'
                    }`}
                  >
                    {t(TYPE_LABEL_KEYS[type])}
                  </button>
                ))}
              </div>

              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onUrgenceChange(!onlyUrgence)}
                  aria-pressed={onlyUrgence}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${
                    onlyUrgence
                      ? 'bg-red-600 text-white'
                      : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-white/10'
                  }`}
                >
                  <Phone className="h-3.5 w-3.5" />
                  {t('visitor.carte.filterUrgence')}
                </button>
                <span className="text-[11px] font-semibold text-slate-400">
                  {t('visitor.carte.resultsCount', { count: displayedCentres.length })}
                </span>
              </div>
            </div>

            <div className="min-h-0 flex-1 touch-pan-y space-y-2.5 overflow-y-auto overscroll-contain px-4 py-3 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] xl:pb-4">
              {loading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
                </div>
              ) : displayedCentres.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="font-bold text-slate-800 dark:text-slate-100">
                    {t('visitor.carte.noResultTitle')}
                  </p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('visitor.carte.noResultDesc')}</p>
                </div>
              ) : (
                displayedCentres.map((centre) => {
                  const centreDistance = position ? haversineKm(position, centre) : null
                  return (
                    <button
                      key={centre.id}
                      type="button"
                      onClick={() => onSelect(centre.id)}
                      className="flex w-full items-start gap-3 rounded-xl border border-slate-200 p-3 text-left transition hover:border-primary-300 hover:shadow-md dark:border-white/10 dark:hover:border-primary-500/50"
                    >
                      <span
                        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                        style={{ backgroundColor: `${FACILITY_COLORS[centre.type] ?? '#64748B'}22` }}
                      >
                        <MapPin className="h-4 w-4" style={{ color: FACILITY_COLORS[centre.type] ?? '#64748B' }} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="line-clamp-2 text-sm font-bold text-slate-900 dark:text-white">{centre.nom}</p>
                          {centreDistance != null && (
                            <span className="shrink-0 rounded-full bg-mint-100 px-2 py-0.5 text-[10px] font-bold text-mint-800 dark:bg-mint-500/15 dark:text-mint-300">
                              {formatDistanceKm(centreDistance)}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
                          {centre.adresse || centre.ville || t('visitor.carte.info.addressUnknown')}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ backgroundColor: `${FACILITY_COLORS[centre.type] ?? '#64748B'}1A`, color: FACILITY_COLORS[centre.type] ?? '#64748B' }}>
                            {t(TYPE_LABEL_KEYS[centre.type] ?? 'visitor.carte.type.all')}
                          </span>
                          {(centre.noteMoyenne ?? 0) > 0 && (
                            <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                              {centre.noteMoyenne!.toFixed(1)}
                            </span>
                          )}
                          {centre.urgences24h && (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-500/15 dark:text-red-300">
                              {t('visitor.carte.info.open24h')}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </>
        )}
      </aside>
    </div>
  )
}
