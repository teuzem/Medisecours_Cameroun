'use client'

import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Building2,
  Clock,
  Copy,
  Globe,
  Heart,
  Loader2,
  Mail,
  MapPin,
  Navigation,
  Phone,
  Send,
  Share2,
  Star,
  Stethoscope,
  Users,
} from 'lucide-react'
import useSWR from 'swr'
import { mutate as globalMutate } from 'swr'
import api from '../../../../api/axios'
import { useAuth } from '../../../../hooks/useAuth'
import { fetcher, fetcherIds } from '../../../../lib/fetcher'
import { FAVORIS_KEY } from '../../../../lib/keys'
import {
  FACILITY_COLORS,
  getEtablissementPhoto,
  getServicesList,
  getSpecialitesList,
  toGoogleMapsUrl,
  type Avis,
  type FicheCentre,
} from '../../../../lib/carte'
import { trackInteraction } from '../../../../lib/track'
import GlassCard from '../../../../components/ui/GlassCard'
import SectionHeader from '../../../../components/ui/SectionHeader'
import LoadingSpinner from '../../../../components/ui/LoadingSpinner'
import { useToast } from '../../../../components/ui/Toast'

const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

export default function PatientEtablissementDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'en' ? 'en-GB' : 'fr-FR'
  const { user, isAuthenticated } = useAuth()
  const toast = useToast()
  const centreId = Number(params?.id)

  const [reviewNote, setReviewNote] = useState(5)
  const [reviewComment, setReviewComment] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)
  const [showReviewForm, setShowReviewForm] = useState(false)

  const { data: fiche, isLoading, error } = useSWR(
    Number.isFinite(centreId) && centreId > 0 ? `/api/centre_de_santes/${centreId}/fiche` : null,
    fetcher,
  )
  const centre = fiche as FicheCentre | undefined

  const { data: avisData } = useSWR(
    centreId ? `/api/etablissements/${centreId}/avis?itemsPerPage=100` : null,
    fetcher,
  )
  const avisList = useMemo<Avis[]>(() => {
    if (!avisData) return []
    const raw = (avisData as any)?.items ?? (avisData as any)['hydra:member'] ?? avisData
    return Array.isArray(raw) ? raw : []
  }, [avisData])

  const { data: favoris, mutate: mutateFavoris } = useSWR<number[]>(isAuthenticated ? FAVORIS_KEY : null, fetcherIds)
  const favoriteIds = Array.isArray(favoris) ? favoris : []
  const isFavorite = favoriteIds.includes(centreId)

  const { data: medecinsData } = useSWR(
    centreId ? `/api/affiliation_medecins?etablissement=${centreId}&statut=ACCEPTEE` : null,
    (url: string) => fetcher(url).catch(() => null),
  )
  const medecins = useMemo(() => {
    if (!medecinsData) return []
    const raw = (medecinsData as any)['hydra:member'] ?? medecinsData
    if (!Array.isArray(raw)) return []
    return raw
      .map((a: any) => a.medecin)
      .filter(Boolean)
      .slice(0, 8)
  }, [medecinsData])

  const myExistingReview = useMemo(() => {
    const uid = (user as any)?.id
    if (!uid) return null
    return avisList.find((a: any) => a.user?.id === uid || a.userId === uid) ?? null
  }, [avisList, user])

  const photo = centre ? getEtablissementPhoto(centre) : null
  const accent = centre ? FACILITY_COLORS[centre.type] ?? '#1E3A5F' : '#1E3A5F'
  const services = centre ? getServicesList(centre) : []
  const specialites = centre ? getSpecialitesList(centre) : []

  const toggleFavorite = useCallback(async () => {
    if (!isAuthenticated || !centre) return
    try {
      if (isFavorite) {
        await api.delete(`/api/carte/saved/${centreId}`)
      } else {
        await api.put(`/api/carte/saved/${centreId}`)
        trackInteraction(centreId, 'sauvegarde')
      }
      await mutateFavoris()
    } catch {
      // silencieux
    }
  }, [isAuthenticated, centre, centreId, isFavorite, mutateFavoris])

  const share = useCallback(async () => {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    try {
      if (navigator.share) {
        await navigator.share({ title: centre?.nom, url })
      } else {
        await navigator.clipboard.writeText(url)
        toast.success(t('patient.fiche.shared'))
      }
      trackInteraction(centreId, 'partage')
    } catch {
      // annulé
    }
  }, [centre, centreId, toast, t])

  const submitReview = useCallback(async () => {
    if (!isAuthenticated || !centre || submittingReview) return
    if (reviewComment.trim().length < 5) {
      toast.error(t('patient.fiche.reviewError'))
      return
    }
    setSubmittingReview(true)
    try {
      await api.post('/api/avis_etablissements', {
        etablissement: `/api/centre_de_santes/${centreId}`,
        note: reviewNote,
        commentaire: reviewComment.trim(),
      })
      trackInteraction(centreId, 'avis', { note: reviewNote })
      toast.success(t('patient.fiche.reviewPublished'))
      setShowReviewForm(false)
      setReviewComment('')
      await globalMutate((key) => typeof key === 'string' && key.includes('/api/avis_etablissements'))
    } catch {
      toast.error(t('patient.fiche.reviewError'))
    } finally {
      setSubmittingReview(false)
    }
  }, [isAuthenticated, centre, centreId, reviewNote, reviewComment, submittingReview, toast, t])

  const requestConsultation = useCallback(() => {
    if (!centre) return
    router.push(`/patient/consultations?new=1&etablissement=${centreId}`)
  }, [centre, centreId, router])

  if (isLoading) {
    return <LoadingSpinner label={t('patient.fiche.loadError')} />
  }

  if (error || !centre) {
    return (
      <div className="mx-auto w-full max-w-3xl min-w-0 px-3 py-10 sm:px-6">
        <GlassCard className="p-8 text-center">
          <Building2 className="mx-auto h-6 w-6 text-slate-300 dark:text-slate-600" aria-hidden="true" />
          <p className="mt-2 text-xs font-bold text-slate-600 dark:text-slate-300">{t('patient.fiche.notFound')}</p>
          <Link href="/patient/etablissements" className="mt-3 inline-flex min-h-8 items-center rounded-lg bg-primary-900 px-3 text-xs font-bold text-white dark:bg-white dark:text-primary-900">
            {t('patient.fiche.backToList')}
          </Link>
        </GlassCard>
      </div>
    )
  }

  const hours = centre.horairesDetails?.weekly

  return (
    <div className="mx-auto w-full max-w-4xl min-w-0 px-3 py-6 sm:px-6">
      <button
        type="button"
        onClick={() => router.back()}
        className="inline-flex min-h-8 items-center gap-1.5 text-xs font-bold text-slate-500 transition hover:text-primary-600 dark:text-slate-400 dark:hover:text-mint-200"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        {t('patient.fiche.backToList')}
      </button>

      {/* Hero */}
      <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="relative h-40 w-full bg-slate-100 dark:bg-slate-800 sm:h-48">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt={centre.nom} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center" style={{ backgroundColor: `${accent}18` }}>
              <Building2 className="h-12 w-12" style={{ color: accent }} aria-hidden="true" />
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-slate-900/70 to-transparent" aria-hidden="true" />
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
            <div className="min-w-0">
              <span className="rounded-md px-2 py-0.5 text-[10px] font-bold text-white" style={{ backgroundColor: accent }}>
                {t(`visitor.carte.type.${centre.type}`)}
              </span>
              <h1 className="mt-1.5 truncate text-lg font-display font-bold text-white sm:text-xl">{centre.nom}</h1>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => void toggleFavorite()}
                disabled={!isAuthenticated}
                aria-label={isFavorite ? t('patient.etablissements.favoriteRemove') : t('patient.etablissements.favoriteAdd')}
                aria-pressed={isFavorite}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/90 text-slate-600 transition hover:bg-white disabled:opacity-50 dark:bg-slate-900/90 dark:text-slate-300"
              >
                <Heart className={`h-4 w-4 ${isFavorite ? 'fill-red-500 text-red-500' : ''}`} />
              </button>
              <button
                type="button"
                onClick={() => void share()}
                aria-label={t('patient.fiche.share')}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/90 text-slate-600 transition hover:bg-white dark:bg-slate-900/90 dark:text-slate-300"
              >
                <Share2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Action row */}
        <div className="flex flex-wrap gap-1.5 border-b border-slate-100 p-3 dark:border-slate-800">
          {centre.telephone && (
            <a
              href={`tel:${centre.telephone}`}
              onClick={() => trackInteraction(centreId, 'telephone')}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-primary-900 px-3 text-xs font-bold text-white transition hover:bg-primary-800 dark:bg-white dark:text-primary-900"
            >
              <Phone className="h-3.5 w-3.5" aria-hidden="true" />
              {t('patient.etablissements.call')}
            </a>
          )}
          {centre.latitude != null && centre.longitude != null && (
            <a
              href={toGoogleMapsUrl(centre)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackInteraction(centreId, 'itineraire')}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              <Navigation className="h-3.5 w-3.5" aria-hidden="true" />
              {t('patient.etablissements.directions')}
            </a>
          )}
          {centre.siteWeb && (
            <a
              href={centre.siteWeb}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackInteraction(centreId, 'site_web')}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              <Globe className="h-3.5 w-3.5" aria-hidden="true" />
              {t('patient.etablissements.website')}
            </a>
          )}
          <button
            type="button"
            onClick={() => void share()}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
          >
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            {t('patient.fiche.share')}
          </button>
        </div>

        {/* Meta chips */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3 text-xs text-slate-500 dark:text-slate-400">
          {centre.noteMoyenne != null && (
            <span className="inline-flex items-center gap-1 font-bold text-slate-700 dark:text-slate-200">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden="true" />
              <span className="tabular-nums">{(Math.round(centre.noteMoyenne * 10) / 10).toLocaleString(locale)}</span>
              <span className="font-normal text-slate-400">{t('patient.etablissements.reviewsCount', { count: centre.totalAvis ?? avisList.length })}</span>
            </span>
          )}
          {centre.urgences24h && (
            <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-500/10 dark:text-red-300">
              <Clock className="h-3 w-3" aria-hidden="true" />
              {t('patient.etablissements.urgencies24h')}
            </span>
          )}
          {centre.teleconsultation && (
            <span className="rounded-md bg-mint-50 px-1.5 py-0.5 text-[10px] font-bold text-primary-700 dark:bg-primary-500/10 dark:text-mint-200">
              {t('patient.etablissements.teleconsultation')}
            </span>
          )}
          {centre.adresse && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" aria-hidden="true" />
              <span className="truncate">{centre.adresse}{centre.ville ? `, ${centre.ville}` : ''}</span>
            </span>
          )}
          {centre.email && (
            <a href={`mailto:${centre.email}`} onClick={() => trackInteraction(centreId, 'email')} className="inline-flex items-center gap-1 hover:text-primary-600 dark:hover:text-mint-200">
              <Mail className="h-3 w-3" aria-hidden="true" />
              {centre.email}
            </a>
          )}
        </div>
      </div>

      {/* Targeted consultation CTA */}
      <GlassCard className="mt-4 flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{t('patient.fiche.requestConsultation')}</p>
          <p className="mt-0.5 text-xs text-slate-400">{t('patient.fiche.requestConsultationDesc')}</p>
        </div>
        <button
          type="button"
          onClick={requestConsultation}
          className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg bg-mint-500 px-4 text-xs font-bold text-primary-900 transition hover:bg-mint-400"
        >
          <Send className="h-3.5 w-3.5" aria-hidden="true" />
          {t('patient.fiche.requestConsultation')}
        </button>
      </GlassCard>

      {/* Description + services */}
      {(centre.description || services.length > 0 || specialites.length > 0) && (
        <GlassCard className="mt-4 p-5">
          {centre.description && <p className="text-xs leading-5 text-slate-600 dark:text-slate-300">{centre.description}</p>}
          {specialites.length > 0 && (
            <div className="mt-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.04em] text-slate-400">{t('patient.fiche.specialites')}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {specialites.map((s) => (
                  <span key={s} className="rounded-md bg-primary-50 px-2 py-0.5 text-[11px] font-bold text-primary-700 dark:bg-primary-500/10 dark:text-mint-200">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
          {services.length > 0 && (
            <div className="mt-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.04em] text-slate-400">{t('patient.fiche.services')}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {services.map((s) => (
                  <span key={s} className="rounded-md border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600 dark:border-slate-700 dark:text-slate-300">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
        </GlassCard>
      )}

      {/* Hours */}
      {hours && (
        <GlassCard className="mt-4 p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.04em] text-slate-400">{t('patient.fiche.hours')}</p>
          <dl className="mt-2 space-y-1">
            {WEEKDAYS.map((day) => {
              const entry = hours[day]
              if (!entry) return null
              const label = new Date(2026, 0, 5 + WEEKDAYS.indexOf(day)).toLocaleDateString(locale, { weekday: 'long' })
              return (
                <div key={day} className="flex items-center justify-between gap-3 text-xs">
                  <dt className="capitalize text-slate-600 dark:text-slate-300">{label}</dt>
                  <dd className="tabular-nums text-slate-500 dark:text-slate-400">
                    {entry.closed ? '—' : entry.open && entry.close ? `${entry.open} – ${entry.close}` : '–'}
                  </dd>
                </div>
              )
            })}
          </dl>
        </GlassCard>
      )}

      {/* Team */}
      <GlassCard className="mt-4 p-5">
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.04em] text-slate-400">
          <Users className="h-3.5 w-3.5" aria-hidden="true" />
          {t('patient.fiche.team')}
        </p>
        {medecins.length === 0 ? (
          <p className="mt-2 text-xs text-slate-400">{t('patient.fiche.teamEmpty')}</p>
        ) : (
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {medecins.map((m: any) => (
              <li key={m.id} className="flex items-center gap-2.5 rounded-lg border border-slate-100 p-2.5 dark:border-slate-800">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-mint-200">
                  <Stethoscope className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-slate-800 dark:text-slate-100">{`${m.prenom ?? ''} ${m.nom ?? ''}`.trim() || '—'}</p>
                  {m.specialite && <p className="truncate text-[11px] text-slate-400">{m.specialite}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>

      {/* Reviews */}
      <GlassCard className="mt-4 p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.04em] text-slate-400">{t('patient.fiche.reviews')}</p>
          {isAuthenticated && !myExistingReview && (
            <button
              type="button"
              onClick={() => setShowReviewForm((v) => !v)}
              className="text-xs font-bold text-primary-600 hover:text-primary-500 dark:text-mint-200"
            >
              {showReviewForm ? (
                <span className="inline-flex items-center gap-1"><Copy className="h-3 w-3" aria-hidden="true" />{t('patient.fiche.reviews')}</span>
              ) : (
                t('patient.fiche.writeReview')
              )}
            </button>
          )}
        </div>

        {showReviewForm && !myExistingReview && (
          <div className="mt-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{t('patient.fiche.reviewNote')}</p>
            <div className="mt-1.5 flex items-center gap-1" role="radiogroup" aria-label={t('patient.fiche.reviewNote')}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={reviewNote === n}
                  onClick={() => setReviewNote(n)}
                  className="p-0.5"
                >
                  <Star className={`h-6 w-6 transition ${n <= reviewNote ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600'}`} />
                </button>
              ))}
            </div>
            <textarea
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              placeholder={t('patient.fiche.reviewCommentPlaceholder')}
              rows={3}
              maxLength={2000}
              className="mt-2 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-800 outline-none focus:border-primary-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            <button
              type="button"
              onClick={() => void submitReview()}
              disabled={submittingReview}
              className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-mint-500 px-3 text-xs font-bold text-primary-900 transition hover:bg-mint-400 disabled:opacity-60"
            >
              {submittingReview ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              {submittingReview ? t('patient.fiche.reviewSubmitting') : t('patient.fiche.reviewSubmit')}
            </button>
          </div>
        )}

        {myExistingReview && <p className="mt-2 text-[11px] text-slate-400">{t('patient.fiche.alreadyReviewed')}</p>}

        {avisList.length === 0 ? (
          <p className="mt-2 text-xs text-slate-400">{t('patient.fiche.reviewsEmpty')}</p>
        ) : (
          <ul className="mt-3 space-y-2.5">
            {avisList.slice(0, 12).map((a) => (
              <li key={a.id} className="rounded-lg border border-slate-100 p-3 dark:border-slate-800">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{a.auteurNom || '—'}</p>
                  <span className="flex items-center gap-0.5" aria-label={`${a.note}/5`}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} className={`h-3 w-3 ${n <= a.note ? 'fill-amber-400 text-amber-400' : 'text-slate-200 dark:text-slate-700'}`} />
                    ))}
                  </span>
                </div>
                {a.commentaire && <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{a.commentaire}</p>}
                <p className="mt-1 text-[10px] text-slate-400">
                  {new Date(a.createdAt).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>
    </div>
  )
}
