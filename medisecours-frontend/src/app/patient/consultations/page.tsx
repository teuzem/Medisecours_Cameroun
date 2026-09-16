'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  CheckCircle,
  ClipboardList,
  Clock,
  Inbox,
  MessageSquare,
  Pill,
  Plus,
  Search,
  Stethoscope,
  Trash2,
  X,
} from 'lucide-react'
import useSWR from 'swr'
import useSWRInfinite from 'swr/infinite'
import api from '../../../api/axios'
import { useAuth } from '../../../hooks/useAuth'
import { useWebSocket } from '../../../hooks/useWebSocket'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { useToast } from '../../../components/ui/Toast'
import ConsultationDetailModal from '../../../components/consultations/ConsultationDetailModal'
import PrescriptionsModal from '../../../components/consultations/PrescriptionsModal'
import PrescriptionDetailModal from '../../../components/admin/PrescriptionDetailModal'
import ConfirmModal from '../../../components/ui/ConfirmModal'
import type { Prescription } from '../../../types/api'

const CONSULTATIONS_PAGE_SIZE = 5

type ConsultationPage = {
  items: any[]
  totalItems: number
  page: number
  hasNext: boolean
}

type ConsultationStats = {
  total: number
  pending: number
  inProgress: number
  finished: number
  cancelled: number
}

const STATUT_STYLES = {
  OUVERTE: {
    badge: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200',
    icon: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200',
    labelKey: 'consultations.pending',
  },
  EN_COURS: {
    badge: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-500/25 dark:bg-blue-500/10 dark:text-blue-200',
    icon: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-200',
    labelKey: 'consultations.inProgress',
  },
  TERMINEE: {
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-200',
    icon: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200',
    labelKey: 'consultations.finished',
  },
  ANNULEE: {
    badge: 'border-slate-200 bg-slate-100 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300',
    icon: 'bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-300',
    labelKey: 'consultations.cancelled',
  },
}

const STATUT_ICON = {
  OUVERTE: Clock,
  EN_COURS: MessageSquare,
  TERMINEE: CheckCircle,
  ANNULEE: X,
}

const PRIORITE_CONFIG = {
  NORMALE: {
    labelKey: 'consultations.priorityNormal',
    className: 'border-slate-950 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950',
  },
  URGENTE: {
    labelKey: 'consultations.priorityUrgent',
    className: 'border-amber-600 bg-amber-600 text-white dark:border-amber-400 dark:bg-amber-400 dark:text-slate-950',
  },
  CRITIQUE: {
    labelKey: 'consultations.priorityCritical',
    className: 'border-red-600 bg-red-600 text-white dark:border-red-400 dark:bg-red-400 dark:text-slate-950',
  },
}

type FilterTab = 'TOUTES' | 'OUVERTE' | 'EN_COURS' | 'TERMINEE'

const FILTER_TABS: { key: FilterTab; labelKey: string }[] = [
  { key: 'TOUTES', labelKey: 'consultations.tab_all' },
  { key: 'OUVERTE', labelKey: 'consultations.tab_pending' },
  { key: 'EN_COURS', labelKey: 'consultations.tab_inProgress' },
  { key: 'TERMINEE', labelKey: 'consultations.tab_finished' },
]

export default function PatientConsultationsPage() {
  const { user, token } = useAuth()
  const router = useRouter()
  const toast = useToast()
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'en' ? 'en-GB' : 'fr-FR'
  const [showForm, setShowForm] = useState(false)
  const [detailFor, setDetailFor] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null)
  const [motif, setMotif] = useState('')
  const [priorite, setPriorite] = useState('NORMALE')
  const [submitting, setSubmitting] = useState(false)
  const [filter, setFilter] = useState<FilterTab>('TOUTES')
  const [searchQuery, setSearchQuery] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [showPrescriptions, setShowPrescriptions] = useState(false)
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null)

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('new') !== '1') return

    const timer = window.setTimeout(() => {
      setShowForm(true)
      router.replace('/patient/consultations', { scroll: false })
    }, 0)

    return () => window.clearTimeout(timer)
  }, [router])

  const {
    data: pages,
    isLoading,
    isValidating,
    error,
    mutate,
    size,
    setSize,
  } = useSWRInfinite<ConsultationPage>(
    (pageIndex, previousPage) => {
      if (previousPage && !previousPage.hasNext) return null
      const params = new URLSearchParams({
        page: String(pageIndex + 1),
        itemsPerPage: String(CONSULTATIONS_PAGE_SIZE),
        'order[createdAt]': 'desc',
      })
      return user ? `/api/consultations?${params.toString()}` : null
    },
    async (url) => {
      const response = await api.get(url)
      const payload = response.data ?? {}
      const items = payload['hydra:member'] ?? payload.member ?? (Array.isArray(payload) ? payload : [])
      const totalItems = Number(payload['hydra:totalItems'] ?? payload.totalItems ?? items.length)
      const currentPage = Number(payload.page ?? new URL(url, window.location.origin).searchParams.get('page') ?? 1)
      const nextLink = payload['hydra:view']?.['hydra:next']

      return {
        items: [...items].sort(
          (first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime(),
        ),
        totalItems,
        page: currentPage,
        hasNext: Boolean(nextLink) || currentPage * CONSULTATIONS_PAGE_SIZE < totalItems,
      }
    },
    {
      revalidateOnFocus: false,
      revalidateFirstPage: false,
      persistSize: true,
    },
  )
  const {
    data: consultationStats,
    mutate: mutateConsultationStats,
  } = useSWR<ConsultationStats>(
    user ? '/api/patient/consultations/stats' : null,
    async (url) => (await api.get(url)).data,
    { revalidateOnFocus: false },
  )

  const loadedConsultations = useMemo(
    () => (pages ?? []).flatMap((page) => page.items),
    [pages],
  )
  const totalConsultations = pages?.[0]?.totalItems ?? loadedConsultations.length
  const hasMore = pages?.at(-1)?.hasNext ?? false
  const loadingMore = isValidating && pages !== undefined && pages.length > 0
  const historySentinelRef = useRef<HTMLDivElement | null>(null)
  const loadingMoreRef = useRef(false)

  useEffect(() => {
    const sentinel = historySentinelRef.current
    if (!sentinel || !showHistory || !hasMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loadingMore && !loadingMoreRef.current) {
          loadingMoreRef.current = true
          void setSize((currentSize) => currentSize + 1)
        }
      },
      { rootMargin: '320px 0px' },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [showHistory, hasMore, loadingMore, setSize, size])

  useEffect(() => {
    if (!isValidating) loadingMoreRef.current = false
  }, [isValidating])

  const consultations = useMemo(() => {
    const unique = new Map<number, any>()
    loadedConsultations.forEach((consultation) => unique.set(consultation.id, consultation))
    return [...unique.values()].sort(
      (first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime(),
    )
  }, [loadedConsultations])
  const recentConsultations = consultations.slice(0, CONSULTATIONS_PAGE_SIZE)

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase(locale)

    return consultations.filter((consultation) => {
      const matchesStatus = filter === 'TOUTES' || consultation.statut === filter
      if (!matchesStatus || !query) return matchesStatus

      const doctorName = consultation.medecin
        ? `${consultation.medecin.prenom ?? ''} ${consultation.medecin.nom ?? ''}`
        : ''
      const searchable = [
        consultation.motif,
        doctorName,
        consultation.statut,
        consultation.priorite,
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase(locale)

      return searchable.includes(query)
    })
  }, [consultations, filter, locale, searchQuery])

  const recentIds = useMemo(
    () => new Set(recentConsultations.map((consultation) => consultation.id)),
    [recentConsultations],
  )
  const filteredRecent = useMemo(
    () => filtered.filter((consultation) => recentIds.has(consultation.id)),
    [filtered, recentIds],
  )
  const displayedConsultations = showHistory ? filtered : filteredRecent

  const stats = useMemo(
    () => ({
      total: consultationStats?.total ?? totalConsultations,
      enAttente: consultationStats?.pending,
      enCours: consultationStats?.inProgress,
      terminees: consultationStats?.finished,
    }),
    [consultationStats, totalConsultations],
  )

  useWebSocket(user?.id || '', token || '', {
    onConsultationAccepted: useCallback(
      (payload) => {
        mutate(
          (current) => current?.map((page) => ({
            ...page,
            items: page.items.map((consultation) =>
              consultation.id === payload.id
                ? { ...consultation, statut: 'EN_COURS', medecin: payload.medecin }
                : consultation,
            ),
          })),
          { revalidate: false },
        )
        void mutateConsultationStats()
        const medecin = payload.medecin
        if (medecin) {
          toast.success(
            t('patient.consultations.acceptedToast', {
              medecin: `${medecin.prenom} ${medecin.nom}`,
            }),
          )
        }
      },
      [mutate, mutateConsultationStats, toast, t],
    ),
    onConsultationClosed: useCallback(
      (payload) => {
        mutate(
          (current) => current?.map((page) => ({
            ...page,
            items: page.items.map((consultation) =>
              consultation.id === payload.id
                ? { ...consultation, statut: 'TERMINEE' }
                : consultation,
            ),
          })),
          { revalidate: false },
        )
        void mutateConsultationStats()
        toast.success(t('patient.consultations.closedToast'))
      },
      [mutate, mutateConsultationStats, toast, t],
    ),
  })

  const createConsultation = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!motif.trim()) return

    setSubmitting(true)
    try {
      await api.post('/api/consultations', { motif: motif.trim(), priorite })
      setShowForm(false)
      setMotif('')
      setPriorite('NORMALE')
      await Promise.all([mutate(), mutateConsultationStats()])
      toast.success(t('patient.consultations.sentToast'))
    } catch {
      toast.error(t('patient.consultations.sendError'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/api/consultations/${id}`)
      mutate(
        (current) => current?.map((page) => ({
          ...page,
          items: page.items.filter((consultation) => consultation.id !== id),
          totalItems: Math.max(0, page.totalItems - 1),
        })),
        { revalidate: false },
      )
      void mutateConsultationStats()
      toast.success(t('consultations.deleted'))
    } catch {
      toast.error(t('consultations.deleteError'))
    }
  }

  const openChat = (consultation: any) => {
    if (consultation.statut !== 'EN_COURS') return
    router.push(`/messages?consultation=${consultation.id}`)
  }

  if (!user) return <LoadingSpinner label={t('common.loading')} />

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="border-b border-slate-200 pb-6 dark:border-white/10">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
              {t('consultations.eyebrow')}
            </p>
            <h1 className="mt-2 font-display text-3xl font-bold text-slate-950 dark:text-white">
              {t('patient.consultations.title')}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              {t('patient.consultations.subtitle')}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => setShowPrescriptions(true)}
              className="inline-flex h-11 items-center justify-center gap-2 border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-white dark:hover:bg-white/5"
            >
              <Pill className="h-4 w-4" aria-hidden="true" />
              {t('visitor.nav.prescriptions')}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="inline-flex h-11 items-center justify-center gap-2 bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t('patient.consultations.new')}
            </button>
          </div>
        </div>
      </header>

      <section
        className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4"
        aria-label={t('patient.consultations.history')}
      >
        {[
          {
            labelKey: 'consultations.total',
            value: stats.total,
            icon: ClipboardList,
            tone: 'bg-slate-100 text-slate-700 dark:bg-white/5 dark:text-slate-200',
          },
          {
            labelKey: 'consultations.pending',
            value: stats.enAttente,
            icon: Clock,
            tone: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200',
          },
          {
            labelKey: 'consultations.inProgress',
            value: stats.enCours,
            icon: Activity,
            tone: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-200',
          },
          {
            labelKey: 'consultations.finished',
            value: stats.terminees,
            icon: CheckCircle,
            tone: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200',
          },
        ].map((stat, index) => (
          <motion.article
            key={stat.labelKey}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
            className="flex min-h-24 items-center gap-3 border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900"
          >
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center ${stat.tone}`}>
              <stat.icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <strong className="block font-display text-2xl font-bold text-slate-950 dark:text-white">
                {stat.value ?? '—'}
              </strong>
              <span className="block truncate text-xs font-semibold text-slate-500 dark:text-slate-300">
                {t(stat.labelKey)}
              </span>
            </span>
          </motion.article>
        ))}
      </section>

      <AnimatePresence>
        {showForm && (
          <motion.form
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            onSubmit={createConsultation}
            className="mt-6 border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900 sm:p-6"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-5 dark:border-white/10">
              <div className="flex gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                  <Stethoscope className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="font-display text-xl font-bold text-slate-950 dark:text-white">
                    {t('patient.consultations.formTitle')}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
                    {t('patient.consultations.formSubtitle')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
                aria-label={t('common.close')}
                title={t('common.close')}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-[1.4fr_0.6fr]">
              <label className="block">
                <span className="text-xs font-bold uppercase text-slate-500">
                  {t('patient.consultations.symptomsLabel')}
                </span>
                <textarea
                  value={motif}
                  onChange={(event) => setMotif(event.target.value)}
                  placeholder={t('patient.consultations.symptomsPlaceholder')}
                  rows={5}
                  className="mt-2 w-full resize-none border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 dark:border-white/10 dark:bg-slate-950 dark:text-white dark:focus:ring-emerald-500/15"
                  required
                />
              </label>

              <fieldset>
                <legend className="text-xs font-bold uppercase text-slate-500">
                  {t('patient.consultations.severityLabel')}
                </legend>
                <div className="mt-2 grid gap-2">
                  {(Object.keys(PRIORITE_CONFIG) as Array<keyof typeof PRIORITE_CONFIG>).map((value) => {
                    const config = PRIORITE_CONFIG[value]
                    return (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={priorite === value}
                        onClick={() => setPriorite(value)}
                        className={`h-11 border px-4 text-left text-sm font-bold transition ${
                          priorite === value
                            ? config.className
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-white/5'
                        }`}
                      >
                        {t(config.labelKey)}
                      </button>
                    )
                  })}
                </div>
              </fieldset>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 border-t border-slate-100 pt-5 dark:border-white/10 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="inline-flex h-11 items-center justify-center border border-slate-300 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-white dark:hover:bg-white/5"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={submitting || !motif.trim()}
                className="inline-flex h-11 items-center justify-center gap-2 bg-emerald-700 px-5 text-sm font-bold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-500"
              >
                <Stethoscope className="h-4 w-4" aria-hidden="true" />
                {submitting ? t('patient.consultations.sending') : t('patient.consultations.send')}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <section className="mt-8 border-t border-slate-200 pt-8 dark:border-white/10">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
              {t('consultations.title')}
            </p>
          <h2 className="mt-1 font-display text-2xl font-bold text-slate-950 dark:text-white">
              {showHistory
                ? t('patient.consultations.historyTitle')
                : t('patient.consultations.recentTitle')}
            </h2>
          </div>
          <span className="text-sm font-semibold text-slate-500 dark:text-slate-300">
            {t('patient.consultations.count', {
              count: showHistory ? filtered.length : displayedConsultations.length,
            })}
          </span>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(260px,1fr)_auto]">
          <label className="flex h-12 items-center gap-3 border border-slate-300 bg-white px-4 dark:border-white/10 dark:bg-slate-900">
            <Search className="h-5 w-5 text-slate-400" aria-hidden="true" />
            <span className="sr-only">{t('common.search')}</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t('patient.consultations.searchPlaceholder')}
              className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-white"
            />
          </label>
          <div
            className="flex gap-1.5 overflow-x-auto pb-1"
            role="group"
            aria-label={t('patient.consultations.history')}
          >
            {FILTER_TABS.map((tab) => {
              const count = tab.key === 'TOUTES'
                ? stats.total
                : stats[
                    tab.key === 'OUVERTE'
                      ? 'enAttente'
                      : tab.key === 'EN_COURS'
                        ? 'enCours'
                        : 'terminees'
                  ]

              return (
                <button
                  key={tab.key}
                  type="button"
                  aria-pressed={filter === tab.key}
                  onClick={() => setFilter(tab.key)}
                  className={`h-12 whitespace-nowrap px-3 text-xs font-bold transition ${
                    filter === tab.key
                      ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950'
                      : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-white/5'
                  }`}
                >
                  {t(tab.labelKey)}
                  {count !== undefined && (
                    <span className="ml-1.5 opacity-70">({count})</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {isLoading ? (
          <div className="mt-6">
            <LoadingSpinner label={t('patient.consultations.loading')} />
          </div>
        ) : error ? (
          <div
            role="alert"
            className="mt-6 border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-100"
          >
            {t('common.error')}
          </div>
        ) : displayedConsultations.length === 0 ? (
          <div className="mt-6 border border-slate-200 bg-white px-5 py-12 text-center dark:border-white/10 dark:bg-slate-900">
            {filter === 'TOUTES' && !searchQuery ? (
              <ClipboardList className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" />
            ) : (
              <Inbox className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" />
            )}
            <h3 className="mt-3 font-display text-lg font-bold text-slate-950 dark:text-white">
              {searchQuery
                ? t('patient.consultations.emptySearchTitle')
                : filter === 'TOUTES'
                ? t('consultations.noConsultationTitle')
                : t('patient.consultations.emptyFilteredTitle', {
                    filter: t(
                      FILTER_TABS.find((tab) => tab.key === filter)?.labelKey || '',
                    ).toLowerCase(),
                  })}
            </h3>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500 dark:text-slate-300">
              {searchQuery
                ? t('patient.consultations.emptySearchDesc')
                : filter === 'TOUTES'
                ? t('patient.consultations.emptyAllDesc')
                : t('patient.consultations.emptyFilteredDesc')}
            </p>
            {filter === 'TOUTES' && !searchQuery && (
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="mt-5 inline-flex h-11 items-center justify-center gap-2 bg-emerald-700 px-4 text-sm font-bold text-white transition hover:bg-emerald-600"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                {t('patient.consultations.new')}
              </button>
            )}
          </div>
        ) : (
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            <AnimatePresence mode="popLayout">
              {displayedConsultations.map((consultation) => {
                const Icon = STATUT_ICON[consultation.statut as keyof typeof STATUT_ICON] || Clock
                const style =
                  STATUT_STYLES[consultation.statut as keyof typeof STATUT_STYLES]
                  || STATUT_STYLES.OUVERTE

                return (
                  <motion.article
                    key={consultation.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="flex min-h-56 flex-col border border-slate-200 bg-white transition hover:border-slate-300 hover:shadow-sm dark:border-white/10 dark:bg-slate-900 dark:hover:border-white/20"
                  >
                    <div className="flex flex-1 gap-4 p-4 sm:p-5">
                      <span className={`flex h-12 w-12 shrink-0 items-center justify-center ${style.icon}`}>
                        <Icon className="h-6 w-6" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <span className={`border px-2 py-1 text-[10px] font-black uppercase ${style.badge}`}>
                            {t(style.labelKey)}
                          </span>
                          {consultation.priorite !== 'NORMALE' && (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 dark:text-red-300">
                              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                              {consultation.priorite === 'CRITIQUE'
                                ? t('patient.consultations.urgencyCritical')
                                : t('patient.consultations.urgencyUrgent')}
                            </span>
                          )}
                        </div>
                        <h3 className="mt-3 line-clamp-2 font-display text-lg font-bold leading-6 text-slate-950 dark:text-white">
                          {consultation.motif || t('patient.consultations.fallbackTitle')}
                        </h3>
                        <div className="mt-3 space-y-2 text-xs text-slate-500 dark:text-slate-300">
                          <p className="flex items-center gap-2">
                            <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                            {new Date(consultation.createdAt).toLocaleDateString(locale, {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                          {consultation.medecin && (
                            <p className="flex items-center gap-2">
                              <Stethoscope className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300" aria-hidden="true" />
                              Dr {consultation.medecin.prenom} {consultation.medecin.nom}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3 dark:border-white/10 sm:px-5">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setDetailFor(consultation.id)}
                          className="inline-flex h-10 items-center justify-center gap-2 border border-slate-200 px-3 text-xs font-bold text-slate-600 transition hover:bg-slate-50 hover:text-slate-950 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
                          title={t('patient.consultations.viewDetails')}
                        >
                          <Activity className="h-4 w-4" aria-hidden="true" />
                          <span>{t('common.details')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(consultation.id)}
                          className="flex h-10 w-10 items-center justify-center border border-slate-200 text-slate-500 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:border-white/10 dark:text-slate-300 dark:hover:border-red-500/40 dark:hover:bg-red-500/10 dark:hover:text-red-300"
                          title={t('common.delete')}
                          aria-label={t('common.delete')}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>

                      {consultation.statut === 'OUVERTE' && (
                        <span className="border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200">
                          {t('consultations.pending')}
                        </span>
                      )}
                      {consultation.statut === 'EN_COURS' && (
                        <button
                          type="button"
                          onClick={() => openChat(consultation)}
                          className="inline-flex h-10 items-center justify-center gap-2 bg-emerald-700 px-4 text-xs font-bold text-white transition hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                        >
                          <MessageSquare className="h-4 w-4" aria-hidden="true" />
                          {t('consultations.discuss')}
                        </button>
                      )}
                      {consultation.statut === 'TERMINEE' && (
                        <span className="border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-200">
                          {t('consultations.finished')}
                        </span>
                      )}
                    </div>
                  </motion.article>
                )
              })}
            </AnimatePresence>
          </div>
        )}
        {!showHistory && hasMore && !isLoading && (
          <div className="mt-6 border-t border-slate-200 pt-5 text-center dark:border-white/10">
            <p className="text-sm text-slate-500 dark:text-slate-300">
              {t('patient.consultations.historyTeaser', { count: Math.max(0, totalConsultations - recentConsultations.length) })}
            </p>
            <button
              type="button"
              onClick={() => {
                setShowHistory(true)
                void setSize((currentSize) => Math.max(currentSize, 2))
              }}
              className="mt-3 inline-flex h-11 items-center justify-center gap-2 border border-slate-300 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-white dark:hover:bg-white/5"
            >
              <ClipboardList className="h-4 w-4" aria-hidden="true" />
              {t('patient.consultations.viewHistory')}
            </button>
          </div>
        )}
        {showHistory && (
          <div
            ref={historySentinelRef}
            className="flex min-h-16 items-center justify-center py-5 text-sm text-slate-500 dark:text-slate-300"
            aria-live="polite"
          >
            {loadingMore
              ? t('patient.consultations.loadingMore')
              : hasMore
                ? t('patient.consultations.scrollForMore')
                : t('patient.consultations.endOfHistory')}
          </div>
        )}
      </section>

      {detailFor && (
        <ConsultationDetailModal
          consultationId={detailFor}
          onClose={() => setDetailFor(null)}
        />
      )}
      {showPrescriptions && (
        <PrescriptionsModal
          onClose={() => setShowPrescriptions(false)}
          onSelect={(prescription) => {
            setShowPrescriptions(false)
            setSelectedPrescription(prescription)
          }}
        />
      )}
      {selectedPrescription && (
        <PrescriptionDetailModal
          prescription={selectedPrescription}
          onClose={() => setSelectedPrescription(null)}
        />
      )}
      <ConfirmModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => handleDelete(deleteTarget!)}
        title={t('consultations.deleteTitle')}
        message={t('consultations.deleteMessage')}
        type="danger"
        confirmText={t('consultations.deleteConfirm')}
        cancelText={t('common.cancel')}
      />
    </main>
  )
}
