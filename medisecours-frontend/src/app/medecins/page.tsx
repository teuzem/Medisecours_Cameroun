'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import useSWR from 'swr'
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  LoaderCircle,
  MessageSquareText,
  PhoneCall,
  RotateCcw,
  Search,
  Star,
  Stethoscope,
  UserRoundSearch,
} from 'lucide-react'
import api from '@/api/axios'
import { emergencyCallHref, EMERGENCY_NUMBER, EMERGENCY_NUMBER_LABEL } from '@/config/firstAid'
import { useAuth } from '@/hooks/useAuth'
import { useDebounce } from '@/hooks/useDebounce'
import { resolveImgPath } from '@/lib/config'
import { useTranslation } from 'react-i18next'
import CertifiedBadge from '@/components/ui/CertifiedBadge'
import type { PublicMedecin, PublicMedecinListResponse } from '@/types/api'

const ITEMS_PER_PAGE = 12

function initialsFor(medecin: PublicMedecin): string {
  return `${medecin.prenom?.[0] ?? ''}${medecin.nom?.[0] ?? ''}`.toUpperCase() || 'DR'
}

function doctorName(medecin: PublicMedecin): string {
  return `Dr ${medecin.prenom ?? ''} ${medecin.nom ?? ''}`.replace(/\s+/g, ' ').trim()
}

function Rating({ value, total }: { value: number; total: number }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label={total > 0 ? t('visitor.doctors.ratingAria', { value: value.toFixed(1) }) : t('visitor.doctors.noReviewAria')}>
      <span className="flex items-center gap-0.5" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600'
            }`}
          />
        ))}
      </span>
      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
        {total > 0 ? `${value.toFixed(1)} (${t('visitor.doctors.reviewsCount', { count: total })})` : t('visitor.doctors.noReviewPublished')}
      </span>
    </div>
  )
}

function DoctorCard({
  medecin,
  contactHref,
  contactLabel,
}: {
  medecin: PublicMedecin
  contactHref: string
  contactLabel: string
}) {
  const { t } = useTranslation()
  const photo = medecin.photoProfil ? resolveImgPath(medecin.photoProfil) : null

  return (
    <article className="flex min-h-[260px] flex-col border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900">
      <div className="flex min-w-0 items-start gap-4">
        <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden bg-emerald-100 text-base font-black text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200">
          {photo ? (
            <Image
              src={photo}
              alt={t('visitor.doctors.photoAlt', { name: doctorName(medecin) })}
              width={64}
              height={64}
              unoptimized
              className="h-full w-full object-cover"
            />
          ) : (
            initialsFor(medecin)
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="break-words font-display text-lg font-bold text-slate-950 dark:text-white">
                  {doctorName(medecin)}
                </h2>
                {medecin.estValide && <CertifiedBadge className="h-5 w-5" />}
              </div>
              <p className="mt-1 break-words text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                {medecin.specialite || t('visitor.doctors.generalMedicine')}
              </p>
            </div>
            <span
              className={`inline-flex shrink-0 items-center gap-1.5 px-2 py-1 text-[11px] font-bold ${
                medecin.isDisponibleMaintenant
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200'
                  : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300'
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  medecin.isDisponibleMaintenant ? 'bg-emerald-500' : 'bg-slate-400'
                }`}
                aria-hidden="true"
              />
              {medecin.isDisponibleMaintenant ? t('visitor.doctors.available') : t('visitor.doctors.bySchedule')}
            </span>
          </div>

          <div className="mt-3">
            <Rating value={medecin.noteMoyenne || 0} total={medecin.totalAvis || 0} />
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-start gap-2 border-t border-slate-100 pt-4 text-sm text-slate-600 dark:border-white/10 dark:text-slate-300">
        <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
        <p className="line-clamp-2 leading-6">
          {medecin.disponibilitesLabel || medecin.disponibilitesTexte || t('visitor.doctors.hoursUnknown')}
        </p>
      </div>

      <div className="mt-auto grid grid-cols-1 gap-2 pt-5 sm:grid-cols-2">
        <Link
          href={`/medecins/${medecin.id}`}
          className="inline-flex min-h-11 items-center justify-center gap-2 border border-slate-300 px-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:border-white/15 dark:text-white dark:hover:bg-white/5"
        >
          {t('visitor.doctors.viewProfile')}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
        <Link
          href={contactHref}
          className="inline-flex min-h-11 items-center justify-center gap-2 bg-emerald-700 px-3 text-center text-sm font-bold text-white transition hover:bg-emerald-600"
        >
          <MessageSquareText className="h-4 w-4" aria-hidden="true" />
          {contactLabel}
        </Link>
      </div>
    </article>
  )
}

export default function MedecinsPage() {
  const { mounted, isAuthenticated, isMedecin } = useAuth()
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [specialite, setSpecialite] = useState('')
  const [availableOnly, setAvailableOnly] = useState(false)
  const [page, setPage] = useState(1)
  const debouncedSearch = useDebounce(search.trim(), 350)

  const swrKey = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(ITEMS_PER_PAGE),
    })
    if (debouncedSearch) params.set('q', debouncedSearch)
    if (specialite) params.set('specialite', specialite)
    if (availableOnly) params.set('disponible', '1')

    return `/api/medecins-publics?${params.toString()}`
  }, [availableOnly, debouncedSearch, page, specialite])

  const { data, error, isLoading, mutate } = useSWR<PublicMedecinListResponse>(
    swrKey,
    async (url: string) => {
      const response = await api.get(url)
      return response.data as PublicMedecinListResponse
    },
    {
      keepPreviousData: true,
      revalidateOnFocus: false,
    },
  )

  const medecins = data?.['hydra:member'] ?? []
  const total = data?.['hydra:totalItems'] ?? 0
  const totalPages = data?.totalPages ?? 1
  const specialites = data?.specialites ?? []
  const hasFilters = search !== '' || specialite !== '' || availableOnly

  const resetFilters = () => {
    setSearch('')
    setSpecialite('')
    setAvailableOnly(false)
    setPage(1)
  }

  const changePage = (nextPage: number) => {
    setPage(nextPage)
    window.requestAnimationFrame(() => {
      document.getElementById('doctor-directory')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const contactDestination = (medecin: PublicMedecin) => {
    const messagesPath = `/messages?medecin=${encodeURIComponent(medecin.id)}`
    if (!mounted || !isAuthenticated) {
      return `/login?from=${encodeURIComponent(messagesPath)}`
    }
    if (isMedecin) return '/medecin'
    return messagesPath
  }

  const contactLabel = !mounted || !isAuthenticated
    ? t('visitor.doctors.login')
    : isMedecin
      ? t('visitor.doctors.mySpace')
      : t('visitor.doctors.write')

  return (
    <main
      id="doctor-directory"
      className="scroll-mt-24 mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10"
    >
      <header className="border-b border-slate-200 pb-7 dark:border-white/10">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
              {t('visitor.doctors.eyebrow')}
            </p>
            <h1 className="mt-2 font-display text-3xl font-bold text-slate-950 dark:text-white sm:text-4xl">
              {t('visitor.doctors.title')}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              {t('visitor.doctors.intro')}
            </p>
          </div>

          <div className="border border-red-200 bg-red-50 p-4 text-red-950 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-100">
            <div className="flex gap-3">
              <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <div>
                <p className="text-sm font-bold">{t('visitor.doctors.dangerTitle')}</p>
                <p className="mt-1 text-xs leading-5">
                  {t('visitor.doctors.dangerDesc')}
                </p>
                <a
                  href={emergencyCallHref()}
                  className="mt-3 inline-flex min-h-10 items-center gap-2 bg-red-600 px-3 text-xs font-bold text-white hover:bg-red-500"
                >
                  <PhoneCall className="h-4 w-4" aria-hidden="true" />
                  {t('visitor.doctors.callEmergency', { label: EMERGENCY_NUMBER_LABEL, number: EMERGENCY_NUMBER })}
                </a>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="mt-6 border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-900/60">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px_auto]">
          <label className="flex min-h-12 items-center gap-3 border border-slate-300 bg-white px-4 dark:border-white/10 dark:bg-slate-900">
            <Search className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
            <span className="sr-only">{t('visitor.doctors.searchSrOnly')}</span>
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
              placeholder={t('visitor.doctors.searchPlaceholder')}
              className="min-w-0 flex-1 bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400 dark:text-white"
            />
          </label>

          <label className="min-w-0">
            <span className="sr-only">{t('visitor.doctors.filterSpecialitySrOnly')}</span>
            <select
              value={specialite}
              onChange={(event) => {
                setSpecialite(event.target.value)
                setPage(1)
              }}
              className="min-h-12 w-full border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-slate-900 dark:text-white"
            >
              <option value="">{t('visitor.doctors.allSpecialities')}</option>
              {specialites.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>

          <label className="flex min-h-12 cursor-pointer items-center gap-3 border border-slate-300 bg-white px-4 dark:border-white/10 dark:bg-slate-900">
            <input
              type="checkbox"
              checked={availableOnly}
              onChange={(event) => {
                setAvailableOnly(event.target.checked)
                setPage(1)
              }}
              className="h-4 w-4 accent-emerald-700"
            />
            <span className="whitespace-nowrap text-sm font-bold text-slate-700 dark:text-white">
              {t('visitor.doctors.availableNow')}
            </span>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600 dark:text-slate-300" role="status">
            {isLoading && !data
              ? t('visitor.doctors.searching')
              : t('visitor.doctors.professionalsFound', { count: total })}
          </p>
          {hasFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex min-h-10 items-center gap-2 px-2 text-sm font-bold text-emerald-700 hover:text-emerald-600 dark:text-emerald-300"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              {t('visitor.doctors.resetFilters')}
            </button>
          )}
        </div>
      </section>

      {isLoading && !data ? (
        <div className="flex min-h-[340px] items-center justify-center text-sm text-slate-500" role="status">
          <LoaderCircle className="mr-3 h-5 w-5 animate-spin" aria-hidden="true" />
          {t('visitor.doctors.loadingDoctors')}
        </div>
      ) : error ? (
        <div className="mt-6 border border-red-200 bg-red-50 p-5 text-sm text-red-900" role="alert">
          <p className="font-bold">{t('visitor.doctors.loadErrorTitle')}</p>
          <p className="mt-1">{t('visitor.doctors.loadErrorDesc')}</p>
          <button
            type="button"
            onClick={() => mutate()}
            className="mt-4 inline-flex min-h-10 items-center gap-2 bg-red-700 px-4 font-bold text-white hover:bg-red-600"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            {t('visitor.doctors.retry')}
          </button>
        </div>
      ) : medecins.length === 0 ? (
        <div className="mt-6 border border-slate-200 bg-white px-5 py-12 text-center dark:border-white/10 dark:bg-slate-900">
          <UserRoundSearch className="mx-auto h-10 w-10 text-slate-400" aria-hidden="true" />
          <h2 className="mt-4 font-display text-xl font-bold text-slate-950 dark:text-white">
            {t('visitor.doctors.emptyTitle')}
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500 dark:text-slate-400">
            {t('visitor.doctors.emptyDesc')}
          </p>
          {hasFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="mt-5 inline-flex min-h-11 items-center gap-2 bg-slate-950 px-4 text-sm font-bold text-white dark:bg-white dark:text-slate-950"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              {t('visitor.doctors.showAll')}
            </button>
          )}
        </div>
      ) : (
        <section className="mt-6" aria-labelledby="doctor-results-title">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="doctor-results-title" className="font-display text-xl font-bold text-slate-950 dark:text-white">
                {t('visitor.doctors.resultsTitle')}
              </h2>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                {t('visitor.doctors.resultsDesc')}
              </p>
            </div>
            <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <CheckCircle2 className="h-4 w-4 text-[#1DA1F2]" aria-hidden="true" />
              {t('visitor.doctors.certifiedProfiles')}
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {medecins.map((medecin) => (
              <DoctorCard
                key={medecin.id}
                medecin={medecin}
                contactHref={contactDestination(medecin)}
                contactLabel={contactLabel}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <nav className="mt-7 flex flex-wrap items-center justify-center gap-2" aria-label={t('visitor.doctors.paginationAria')}>
              <button
                type="button"
                onClick={() => changePage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="inline-flex min-h-11 items-center gap-2 border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-slate-900 dark:text-white"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                {t('visitor.doctors.previous')}
              </button>
              <span className="px-3 text-sm font-semibold text-slate-600 dark:text-slate-300">
                {t('visitor.doctors.pageOf', { page: data?.page ?? page, total: totalPages })}
              </span>
              <button
                type="button"
                onClick={() => changePage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                className="inline-flex min-h-11 items-center gap-2 border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-slate-900 dark:text-white"
              >
                {t('visitor.doctors.next')}
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </nav>
          )}
        </section>
      )}

      <section className="mt-10 grid gap-4 border-t border-slate-200 pt-8 dark:border-white/10 md:grid-cols-3">
        <div className="flex gap-3">
          <Stethoscope className="h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-bold text-slate-950 dark:text-white">{t('visitor.doctors.stepProfileTitle')}</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
              {t('visitor.doctors.stepProfileDesc')}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <MessageSquareText className="h-5 w-5 shrink-0 text-blue-700 dark:text-blue-300" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-bold text-slate-950 dark:text-white">{t('visitor.doctors.stepRequestTitle')}</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
              {t('visitor.doctors.stepRequestDesc')}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <CalendarDays className="h-5 w-5 shrink-0 text-violet-700 dark:text-violet-300" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-bold text-slate-950 dark:text-white">{t('visitor.doctors.stepOrganizeTitle')}</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
              {t('visitor.doctors.stepOrganizeDesc')}
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
