'use client'

import { use, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import useSWR from 'swr'
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Flag,
  LoaderCircle,
  MessageSquareText,
  PhoneCall,
  ShieldCheck,
  Star,
  Stethoscope,
  UserRound,
} from 'lucide-react'
import api from '@/api/axios'
import { emergencyCallHref, EMERGENCY_NUMBER } from '@/config/firstAid'
import { useAuth } from '@/hooks/useAuth'
import { resolveImgPath } from '@/lib/config'
import CertifiedBadge from '@/components/ui/CertifiedBadge'
import Modal from '@/components/ui/Modal'
import {
  idFromRelation,
  type Consultation,
  type PublicMedecinAvis,
  type PublicMedecinDetail,
} from '@/types/api'
import { useToast } from '@/components/ui/Toast'
import { useTranslation } from 'react-i18next'

const REPORT_REASONS = [
  'COMPORTEMENT_INAPPROPRIE',
  'FAUSSE_INFORMATION',
  'HARCELEMENT',
  'NEGLIGENCE',
  'FRAUDE',
  'AUTRE',
]

function fullName(medecin: PublicMedecinDetail): string {
  return `Dr ${medecin.prenom ?? ''} ${medecin.nom ?? ''}`.replace(/\s+/g, ' ').trim()
}

function Stars({ note, size = 'h-4 w-4' }: { note: number; size?: string }) {
  const { t } = useTranslation()
  return (
    <span className="flex gap-0.5" aria-label={t('visitor.medecinDetail.ratingAria', { note })}>
      {[1, 2, 3, 4, 5].map((value) => (
        <Star
          key={value}
          className={`${size} ${
            value <= Math.round(note)
              ? 'fill-amber-400 text-amber-400'
              : 'text-slate-300 dark:text-slate-600'
          }`}
          aria-hidden="true"
        />
      ))}
    </span>
  )
}

function Review({ review }: { review: PublicMedecinAvis }) {
  const { t, i18n } = useTranslation()
  const patient = `${review.patient.prenom ?? ''} ${review.patient.nom ?? ''}`.trim() || t('visitor.medecinDetail.anonymousPatient')
  const date = new Intl.DateTimeFormat(i18n.language.startsWith('en') ? 'en-GB' : 'fr-CM', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(review.createdAt))

  return (
    <article className="border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-slate-100 dark:bg-white/10">
          <UserRound className="h-4 w-4 text-slate-500" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap justify-between gap-2">
            <p className="font-bold text-slate-900 dark:text-white">{patient}</p>
            <time dateTime={review.createdAt} className="text-xs text-slate-500">{date}</time>
          </div>
          <div className="mt-1"><Stars note={review.note} size="h-3.5 w-3.5" /></div>
          {review.commentaire && (
            <p className="mt-3 break-words text-sm leading-6 text-slate-600 dark:text-slate-300">
              {review.commentaire}
            </p>
          )}
        </div>
      </div>
    </article>
  )
}

export default function MedecinDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { mounted, isAuthenticated, isMedecin, user } = useAuth()
  const { t } = useTranslation()
  const toast = useToast()
  const [note, setNote] = useState(0)
  const [commentaire, setCommentaire] = useState('')
  const [sending, setSending] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [reportDescription, setReportDescription] = useState('')
  const [reportSending, setReportSending] = useState(false)

  const { data: medecin, error, isLoading, mutate } = useSWR<PublicMedecinDetail>(
    `/api/medecins-publics/${encodeURIComponent(id)}`,
    async (url: string) => {
      const response = await api.get(url)
      return response.data as PublicMedecinDetail
    },
    { revalidateOnFocus: false },
  )

  const isPatient = mounted && Boolean(user?.roles?.includes('ROLE_PATIENT'))
  const { data: consultations = [] } = useSWR<Consultation[]>(
    isPatient ? '/api/consultations?itemsPerPage=100' : null,
    async (url: string) => {
      const response = await api.get(url)
      const payload = response.data
      return (Array.isArray(payload) ? payload : payload?.member ?? payload?.['hydra:member'] ?? []) as Consultation[]
    },
    { revalidateOnFocus: false },
  )
  const canReview = consultations.some((consultation) => (
    consultation.statut === 'TERMINEE'
    && String(idFromRelation(consultation.medecin)) === String(id)
  ))
  const submitReview = async (event: React.FormEvent) => {
    event.preventDefault()
    const text = commentaire.trim()
    if (!note) {
      toast.error(t('visitor.medecinDetail.toastNoNote'))
      return
    }
    if (text && text.length < 10) {
      toast.error(t('visitor.medecinDetail.toastCommentTooShort'))
      return
    }

    setSending(true)
    try {
      await api.post('/api/avis', {
        medecin: `/api/users/${id}`,
        note,
        commentaire: text || null,
      })
      setNote(0)
      setCommentaire('')
      await mutate()
      toast.success(t('visitor.medecinDetail.toastReviewSuccess'))
    } catch (requestError: unknown) {
      const status = (requestError as { response?: { status?: number } }).response?.status
      if (status === 403) {
        toast.error(t('visitor.medecinDetail.toastReview403'))
      } else if (status === 422) {
        toast.error(t('visitor.medecinDetail.toastReview422'))
      } else {
        toast.error(t('visitor.medecinDetail.toastReviewError'))
      }
    } finally {
      setSending(false)
    }
  }

  const submitReport = async (event: React.FormEvent) => {
    event.preventDefault()
    const description = reportDescription.trim()
    if (!reportReason) {
      toast.error(t('visitor.medecinDetail.reportReasonEmpty'))
      return
    }
    if (description.length < 20) {
      toast.error(t('visitor.medecinDetail.reportDescriptionTooShort'))
      return
    }

    setReportSending(true)
    try {
      await api.post('/api/signalements-medecins', {
        medecin: `/api/users/${id}`,
        motif: reportReason,
        description,
      })
      setReportOpen(false)
      setReportReason('')
      setReportDescription('')
      toast.success(t('visitor.medecinDetail.reportSuccess'))
    } catch (requestError: unknown) {
      const response = (requestError as {
        response?: { status?: number; data?: { error?: string } }
      }).response
      toast.error(response?.data?.error || t('visitor.medecinDetail.reportError'))
    } finally {
      setReportSending(false)
    }
  }

  if (isLoading) {
    return (
      <main className="flex min-h-[440px] items-center justify-center text-sm text-slate-500" role="status">
        <LoaderCircle className="mr-3 h-5 w-5 animate-spin" aria-hidden="true" />
        {t('visitor.medecinDetail.loadingProfile')}
      </main>
    )
  }

  if (error || !medecin) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <Stethoscope className="mx-auto h-12 w-12 text-slate-400" aria-hidden="true" />
        <h1 className="mt-4 font-display text-2xl font-bold text-slate-950 dark:text-white">
          {t('visitor.medecinDetail.notFoundTitle')}
        </h1>
        <p className="mt-2 text-sm text-slate-500">{t('visitor.medecinDetail.notFoundDesc')}</p>
        <Link
          href="/medecins"
          className="mt-6 inline-flex min-h-11 items-center gap-2 bg-slate-950 px-4 text-sm font-bold text-white"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t('visitor.medecinDetail.backToDoctors')}
        </Link>
      </main>
    )
  }

  const messagesPath = `/messages?medecin=${encodeURIComponent(id)}`
  const contactHref = !mounted || !isAuthenticated
    ? `/login?from=${encodeURIComponent(messagesPath)}`
    : isMedecin
      ? '/medecin'
      : messagesPath
  const contactLabel = !mounted || !isAuthenticated
    ? t('visitor.medecinDetail.loginContact')
    : isMedecin
      ? t('visitor.medecinDetail.mySpace')
      : t('visitor.medecinDetail.contactDoctor')
  const photo = medecin.photoProfil ? resolveImgPath(medecin.photoProfil) : null
  const initials = `${medecin.prenom?.[0] ?? ''}${medecin.nom?.[0] ?? ''}`.toUpperCase() || 'DR'

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <Modal
        isOpen={reportOpen}
        onClose={() => {
          if (!reportSending) setReportOpen(false)
        }}
        title={t('visitor.medecinDetail.reportModalTitle', { name: fullName(medecin) })}
        size="md"
      >
        <form onSubmit={submitReport} className="space-y-4">
          <div className="border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-900 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-100">
            {t('visitor.medecinDetail.reportPrivateNote')}
          </div>
          <div>
            <label htmlFor="report-reason" className="text-sm font-bold text-slate-900 dark:text-white">
              {t('visitor.medecinDetail.reportReasonLabel')}
            </label>
            <select
              id="report-reason"
              value={reportReason}
              onChange={(event) => setReportReason(event.target.value)}
              className="mt-2 min-h-11 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-red-500 dark:border-white/10 dark:bg-slate-950 dark:text-white"
              required
            >
              <option value="">{t('visitor.medecinDetail.reportReasonPlaceholder')}</option>
              {REPORT_REASONS.map((reason) => (
                <option key={reason} value={reason}>{t(`visitor.medecinDetail.reportReasons.${reason}`)}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="report-description" className="text-sm font-bold text-slate-900 dark:text-white">
              {t('visitor.medecinDetail.reportDescriptionLabel')}
            </label>
            <textarea
              id="report-description"
              value={reportDescription}
              onChange={(event) => setReportDescription(event.target.value)}
              rows={6}
              minLength={20}
              maxLength={2000}
              placeholder={t('visitor.medecinDetail.reportDescriptionPlaceholder')}
              className="mt-2 w-full resize-y border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-red-500 dark:border-white/10 dark:bg-slate-950 dark:text-white"
              required
            />
            <p className="mt-1 text-right text-xs text-slate-500">
              {reportDescription.length}/2000
            </p>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setReportOpen(false)}
              disabled={reportSending}
              className="min-h-11 border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 disabled:opacity-50 dark:border-white/15 dark:bg-slate-900 dark:text-white"
            >
              {t('visitor.medecinDetail.reportCancel')}
            </button>
            <button
              type="submit"
              disabled={reportSending || !reportReason || reportDescription.trim().length < 20}
              className="min-h-11 bg-red-700 px-4 text-sm font-bold text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {reportSending ? t('visitor.medecinDetail.reportSending') : t('visitor.medecinDetail.reportSubmit')}
            </button>
          </div>
        </form>
      </Modal>

      <Link
        href="/medecins"
        className="inline-flex min-h-10 items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-950 dark:text-slate-300"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t('visitor.medecinDetail.allDoctors')}
      </Link>

      <section className="mt-4 border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900">
        <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="flex min-w-0 flex-col gap-5 sm:flex-row">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden bg-emerald-100 text-xl font-black text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200">
              {photo ? (
                <Image
                  src={photo}
                  alt={t('visitor.medecinDetail.photoAlt', { name: fullName(medecin) })}
                  width={96}
                  height={96}
                  unoptimized
                  className="h-full w-full object-cover"
                />
              ) : initials}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="break-words font-display text-2xl font-bold text-slate-950 dark:text-white sm:text-3xl">
                  {fullName(medecin)}
                </h1>
                {medecin.estValide && <CertifiedBadge className="h-6 w-6" />}
                <span className="inline-flex items-center gap-1.5 bg-blue-100 px-2 py-1 text-[11px] font-bold text-blue-800 dark:bg-[#1DA1F2]/15 dark:text-[#60A5FA]">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  {t('visitor.medecinDetail.certifiedAccount')}
                </span>
              </div>
              <p className="mt-2 font-semibold text-emerald-700 dark:text-emerald-300">
                {medecin.specialite || t('visitor.medecinDetail.generalMedicine')}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Stars note={medecin.noteMoyenne || 0} />
                <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                  {medecin.totalAvis > 0
                    ? `${medecin.noteMoyenne.toFixed(1)} · ${t('visitor.medecinDetail.reviewsCount', { count: medecin.totalAvis })}`
                    : t('visitor.medecinDetail.noReviewPublished')}
                </span>
              </div>
              <div className="mt-4 flex items-start gap-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                <Clock3 className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{medecin.disponibilitesLabel || t('visitor.medecinDetail.hoursUnknown')}</span>
              </div>
            </div>
          </div>

          <aside className="border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950">
            <p className={`inline-flex items-center gap-2 text-sm font-bold ${
              medecin.isDisponibleMaintenant
                ? 'text-emerald-700 dark:text-emerald-300'
                : 'text-slate-600 dark:text-slate-300'
            }`}>
              <span className={`h-2.5 w-2.5 rounded-full ${
                medecin.isDisponibleMaintenant ? 'bg-emerald-500' : 'bg-slate-400'
              }`} aria-hidden="true" />
              {medecin.isDisponibleMaintenant ? t('visitor.medecinDetail.availableNow') : t('visitor.medecinDetail.unavailableNow')}
            </p>
            <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
              {t('visitor.medecinDetail.availabilityHint')}
            </p>
            <Link
              href={contactHref}
              className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 bg-emerald-700 px-4 text-center text-sm font-bold text-white hover:bg-emerald-600"
            >
              <MessageSquareText className="h-4 w-4" aria-hidden="true" />
              {contactLabel}
            </Link>
            {isPatient && (
              <>
                <Link
                  href="/patient/consultations?new=1"
                  className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 dark:border-white/15 dark:bg-slate-900 dark:text-white"
                >
                  <CalendarDays className="h-4 w-4" aria-hidden="true" />
                  {t('visitor.medecinDetail.newConsultation')}
                </Link>
                {canReview && (
                  <button
                    type="button"
                    onClick={() => setReportOpen(true)}
                    className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 border border-red-200 bg-red-50 px-4 text-sm font-bold text-red-700 hover:bg-red-100 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-200"
                  >
                    <Flag className="h-4 w-4" aria-hidden="true" />
                    {t('visitor.medecinDetail.reportDoctor')}
                  </button>
                )}
              </>
            )}
          </aside>
        </div>

        <div className="grid gap-4 border-t border-slate-200 p-5 dark:border-white/10 sm:grid-cols-2 sm:p-7">
          <div className="flex gap-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
            <p className="text-xs leading-5 text-slate-600 dark:text-slate-300">
              {t('visitor.medecinDetail.messageHint')}
            </p>
          </div>
          <div className="flex gap-3">
            <PhoneCall className="h-5 w-5 shrink-0 text-red-700" aria-hidden="true" />
            <p className="text-xs leading-5 text-slate-600 dark:text-slate-300">
              {t('visitor.medecinDetail.emergencyHint')}{' '}
              <a href={emergencyCallHref()} className="font-bold text-red-700 underline">{EMERGENCY_NUMBER}</a>.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-8" aria-labelledby="reviews-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="reviews-title" className="font-display text-xl font-bold text-slate-950 dark:text-white">
              {t('visitor.medecinDetail.reviewsTitle')}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {t('visitor.medecinDetail.reviewsNote')}
            </p>
          </div>
          <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
            {t('visitor.medecinDetail.reviewsCount', { count: medecin.avis.length })}
          </span>
        </div>

        {isPatient && canReview && (
          <form
            onSubmit={submitReview}
            className="mt-5 border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-slate-900"
          >
            <h3 className="text-sm font-bold text-slate-950 dark:text-white">{t('visitor.medecinDetail.shareExperience')}</h3>
            <div className="mt-3 flex gap-1" role="group" aria-label={t('visitor.medecinDetail.chooseRatingAria')}>
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setNote(value)}
                  aria-label={t('visitor.medecinDetail.starAria', { value })}
                  aria-pressed={note === value}
                  className="p-1 focus-visible:outline-2 focus-visible:outline-emerald-600"
                >
                  <Star
                    className={`h-6 w-6 ${
                      value <= note ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600'
                    }`}
                    aria-hidden="true"
                  />
                </button>
              ))}
            </div>
            <textarea
              value={commentaire}
              onChange={(event) => setCommentaire(event.target.value)}
              rows={4}
              maxLength={2000}
              placeholder={t('visitor.medecinDetail.commentPlaceholder')}
              className="mt-4 w-full resize-y border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-slate-950 dark:text-white"
            />
            <button
              type="submit"
              disabled={sending || note === 0}
              className="mt-3 min-h-11 bg-emerald-700 px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sending ? t('visitor.medecinDetail.publishing') : t('visitor.medecinDetail.publishReview')}
            </button>
          </form>
        )}

        {isPatient && !canReview && (
          <div className="mt-5 border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900 dark:border-blue-500/25 dark:bg-blue-500/10 dark:text-blue-100">
            {t('visitor.medecinDetail.reviewUnavailable')}
          </div>
        )}

        {medecin.avis.length === 0 ? (
          <div className="mt-5 border border-slate-200 bg-white p-7 text-center text-sm text-slate-500 dark:border-white/10 dark:bg-slate-900">
            {t('visitor.medecinDetail.noReviewsYet')}
          </div>
        ) : (
          <div className="mt-5 grid gap-3">
            {medecin.avis.map((review) => <Review key={review.id} review={review} />)}
          </div>
        )}
      </section>
    </main>
  )
}
