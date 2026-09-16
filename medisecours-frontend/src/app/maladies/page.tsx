'use client'

import { FormEvent, Suspense, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import useSWR from 'swr'
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MessageSquareText,
  PhoneCall,
  Search,
  ShieldAlert,
  Stethoscope,
  X,
  XCircle,
} from 'lucide-react'
import api from '@/api/axios'
import EmptyState from '@/components/ui/EmptyState'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { useToast } from '@/components/ui/Toast'
import { useTranslation } from 'react-i18next'
import { emergencyCallHref, EMERGENCY_NUMBER, EMERGENCY_NUMBER_LABEL } from '@/config/firstAid'

const ITEMS_PER_PAGE = 12

const CONTEXT_OPTIONS = [
  { value: 'zone_tropicale', labelKey: 'visitor.orientation.contextOptions.zone_tropicale' },
  { value: 'piqure_moustique', labelKey: 'visitor.orientation.contextOptions.piqure_moustique' },
  { value: 'voyage_recent', labelKey: 'visitor.orientation.contextOptions.voyage_recent' },
  { value: 'contact_malade', labelKey: 'visitor.orientation.contextOptions.contact_malade' },
  { value: 'alimentation_suspecte', labelKey: 'visitor.orientation.contextOptions.alimentation_suspecte' },
  { value: 'blessure_accident', labelKey: 'visitor.orientation.contextOptions.blessure_accident' },
  { value: 'grossesse', labelKey: 'visitor.orientation.contextOptions.grossesse' },
  { value: 'enfant', labelKey: 'visitor.orientation.contextOptions.enfant' },
  { value: 'personne_agee', labelKey: 'visitor.orientation.contextOptions.personne_agee' },
]

const fetcher = (url: string) => api.get(url).then((response) => response.data)
const collection = (data: any): any[] =>
  data?.['hydra:member'] ?? data?.member ?? (Array.isArray(data) ? data : [])

export default function OrientationPage() {
  const { t } = useTranslation()
  return (
    <Suspense fallback={<LoadingSpinner label={t('visitor.orientation.loading')} />}>
      <OrientationContent />
    </Suspense>
  )
}

function OrientationContent() {
  const searchParams = useSearchParams()
  const toast = useToast()
  const { t } = useTranslation()
  const [freeText, setFreeText] = useState(searchParams.get('symptomes') ?? '')
  const [symptomFilter, setSymptomFilter] = useState('')
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [durationDays, setDurationDays] = useState('')
  const [intensity, setIntensity] = useState('MODEREE')
  const [contexts, setContexts] = useState<string[]>([])
  const [triage, setTriage] = useState<any | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [catalogPage, setCatalogPage] = useState(1)

  const { data: symptomsData } = useSWR('/api/symptomes', fetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  })
  const symptoms = collection(symptomsData)
  const selectedSymptoms = useMemo(
    () => symptoms.filter((symptom) => selectedIds.includes(Number(symptom.id))),
    [selectedIds, symptoms],
  )
  const proposedSymptoms = useMemo(() => {
    const query = normalize(symptomFilter)
    return symptoms
      .filter((symptom) => !selectedIds.includes(Number(symptom.id)))
      .filter((symptom) => !query || normalize(symptom.nom ?? '').includes(query))
      .slice(0, 16)
  }, [selectedIds, symptomFilter, symptoms])

  const catalogKey = `/api/public/conditions?page=${catalogPage}&itemsPerPage=${ITEMS_PER_PAGE}`
  const { data: catalogData, isLoading: catalogLoading } = useSWR(catalogKey, fetcher, {
    keepPreviousData: true,
    revalidateOnFocus: false,
  })
  const catalog = catalogData?.items ?? []
  const total = catalogData?.total ?? catalog.length
  const totalPages = catalogData?.totalPages ?? Math.max(1, Math.ceil(total / ITEMS_PER_PAGE))

  const toggleSymptom = (id: number) => {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
    setTriage(null)
  }

  const toggleContext = (value: string) => {
    setContexts((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value])
    setTriage(null)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (selectedSymptoms.length === 0 && freeText.trim().length < 2) {
      toast.error(t('visitor.orientation.emptyError'))
      return
    }

    setSubmitting(true)
    try {
      const response = await api.post('/api/orientation/symptomes', {
        symptomes: selectedSymptoms.map((symptom) => ({
          id: symptom.id,
          nom: symptom.nom,
          slug: symptom.slug,
        })),
        texteLibre: freeText.trim(),
        dureeJours: durationDays ? Number(durationDays) : null,
        intensite: intensity,
        contextes: contexts,
      })
      setTriage(response.data)
    } catch {
      toast.error(t('visitor.orientation.submitError'))
    } finally {
      setSubmitting(false)
    }
  }

  const reset = () => {
    setFreeText('')
    setSymptomFilter('')
    setSelectedIds([])
    setDurationDays('')
    setIntensity('MODEREE')
    setContexts([])
    setTriage(null)
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="border-b border-slate-200 pb-6 dark:border-white/10">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
          {t('visitor.orientation.eyebrow')}
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold text-slate-950 dark:text-white">
          {t('visitor.orientation.title')}
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
          {t('visitor.orientation.intro')}
        </p>
      </header>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label={t('visitor.orientation.actionsAria')}>
        <ActionLink href="/premiers-soins" icon={ShieldAlert} label={t('visitor.orientation.firstAid')} tone="red" />
        <ActionLink href="/medecins" icon={MessageSquareText} label={t('visitor.orientation.consultDoctor')} tone="emerald" />
        <ActionLink href="/centres" icon={Building2} label={t('visitor.orientation.findCentre')} tone="blue" />
        <a
          href={emergencyCallHref()}
          className="flex min-h-20 items-center gap-3 border border-red-200 bg-red-50 p-4 text-red-900 transition hover:bg-red-100 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-100"
        >
          <PhoneCall className="h-6 w-6 shrink-0" />
          <span>
            <strong className="block text-sm">{EMERGENCY_NUMBER_LABEL}</strong>
            <span className="text-xs">{t('visitor.orientation.callEmergency', { number: EMERGENCY_NUMBER })}</span>
          </span>
        </a>
      </section>

      <form onSubmit={submit} className="mt-6 border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900 sm:p-6">
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-5 dark:border-white/10 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-display text-xl font-bold text-slate-950 dark:text-white">{t('visitor.orientation.observedSigns')}</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
              {t('visitor.orientation.observedSignsDesc')}
            </p>
          </div>
          {(triage || selectedIds.length > 0 || freeText) && (
            <button type="button" onClick={reset} className="inline-flex h-10 items-center justify-center gap-2 border border-slate-200 px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5">
              <X className="h-4 w-4" /> {t('visitor.orientation.reset')}
            </button>
          )}
        </div>

        <div className="mt-5 grid gap-6 lg:grid-cols-[1.35fr_0.85fr]">
          <div>
            <label className="text-xs font-bold uppercase text-slate-500">{t('visitor.orientation.searchSign')}</label>
            <div className="mt-2 flex h-11 items-center gap-2 border border-slate-200 bg-slate-50 px-3 dark:border-white/10 dark:bg-slate-950">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                value={symptomFilter}
                onChange={(event) => setSymptomFilter(event.target.value)}
                placeholder={t('visitor.orientation.searchPlaceholder')}
                className="min-w-0 flex-1 bg-transparent text-sm outline-none dark:text-white"
              />
            </div>
            <div className="mt-3 flex max-h-44 flex-wrap gap-2 overflow-y-auto">
              {proposedSymptoms.map((symptom) => (
                <button key={symptom.id} type="button" onClick={() => toggleSymptom(Number(symptom.id))} className="border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200">
                  {symptom.nom}
                </button>
              ))}
            </div>

            {selectedSymptoms.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {selectedSymptoms.map((symptom) => (
                  <button key={symptom.id} type="button" onClick={() => toggleSymptom(Number(symptom.id))} className="inline-flex items-center gap-2 bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white">
                    <CheckCircle2 className="h-3.5 w-3.5" /> {symptom.nom}
                  </button>
                ))}
              </div>
            )}

            <label className="mt-5 block text-xs font-bold uppercase text-slate-500">{t('visitor.orientation.freeDescription')}</label>
            <textarea
              value={freeText}
              onChange={(event) => { setFreeText(event.target.value); setTriage(null) }}
              rows={4}
              maxLength={500}
              placeholder={t('visitor.orientation.freeDescriptionPlaceholder')}
              className="mt-2 w-full resize-none border border-slate-200 bg-white px-4 py-3 text-sm leading-6 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 dark:border-white/10 dark:bg-slate-950 dark:text-white"
            />
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-bold uppercase text-slate-500">
                {t('visitor.orientation.durationDays')}
                <input type="number" min="0" max="3650" value={durationDays} onChange={(event) => { setDurationDays(event.target.value); setTriage(null) }} className="mt-2 h-11 w-full border border-slate-200 bg-white px-3 text-sm font-normal outline-none dark:border-white/10 dark:bg-slate-950 dark:text-white" />
              </label>
              <label className="text-xs font-bold uppercase text-slate-500">
                {t('visitor.orientation.intensity')}
                <select value={intensity} onChange={(event) => { setIntensity(event.target.value); setTriage(null) }} className="mt-2 h-11 w-full border border-slate-200 bg-white px-3 text-sm font-normal outline-none dark:border-white/10 dark:bg-slate-950 dark:text-white">
                  <option value="LEGERE">{t('visitor.orientation.intensityLight')}</option>
                  <option value="MODEREE">{t('visitor.orientation.intensityModerate')}</option>
                  <option value="FORTE">{t('visitor.orientation.intensityHigh')}</option>
                </select>
              </label>
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-slate-500">{t('visitor.orientation.context')}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {CONTEXT_OPTIONS.map((option) => (
                  <button key={option.value} type="button" onClick={() => toggleContext(option.value)} className={`border px-3 py-1.5 text-xs font-semibold ${contexts.includes(option.value) ? 'border-blue-700 bg-blue-700 text-white' : 'border-slate-200 bg-white text-slate-600 dark:border-white/10 dark:bg-slate-950 dark:text-slate-200'}`}>
                    {t(option.labelKey)}
                  </button>
                ))}
              </div>
            </div>
            <button type="submit" disabled={submitting} className="inline-flex h-12 w-full items-center justify-center gap-2 bg-slate-950 px-5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-emerald-600 dark:hover:bg-emerald-500">
              <Stethoscope className="h-4 w-4" />
              {submitting ? t('visitor.orientation.orienting') : t('visitor.orientation.getOrientation')}
            </button>
          </div>
        </div>
      </form>

      {triage && <OrientationResult data={triage} />}

      <section className="mt-10 border-t border-slate-200 pt-8 dark:border-white/10">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{t('visitor.orientation.infoEyebrow')}</p>
            <h2 className="mt-1 font-display text-2xl font-bold text-slate-950 dark:text-white">{t('visitor.orientation.catalogTitle')}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              {t('visitor.orientation.catalogDesc')}
            </p>
          </div>
          <span className="text-sm font-semibold text-slate-500">{t('visitor.orientation.sheetsAvailable', { count: total })}</span>
        </div>

        {catalogLoading && catalog.length === 0 ? (
          <LoadingSpinner label={t('visitor.orientation.catalogLoading')} />
        ) : catalog.length === 0 ? (
          <EmptyState title={t('visitor.orientation.catalogEmptyTitle')} description={t('visitor.orientation.catalogEmptyDesc')} />
        ) : (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {catalog.map((item) => (
              <Link key={item.id} href={`/maladies/${item.id}`} className="group border border-slate-200 bg-white p-4 transition hover:border-emerald-400 dark:border-white/10 dark:bg-slate-900">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase text-slate-400">{item.categorie?.nom ?? t('visitor.orientation.generalHealth')}</p>
                    <h3 className="mt-1 font-bold text-slate-950 group-hover:text-emerald-700 dark:text-white dark:group-hover:text-emerald-300">{item.nom}</h3>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-1" />
                </div>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-300">
                  {t('visitor.orientation.cardDesc')}
                </p>
              </Link>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-5 dark:border-white/10">
            <button type="button" disabled={catalogPage <= 1} onClick={() => setCatalogPage((page) => page - 1)} className="inline-flex h-10 items-center gap-1 px-3 text-sm font-semibold text-slate-600 disabled:opacity-30 dark:text-slate-300">
              <ChevronLeft className="h-4 w-4" /> {t('visitor.orientation.previous')}
            </button>
            <span className="text-sm text-slate-500">{t('visitor.orientation.pageOf', { page: catalogPage, total: totalPages })}</span>
            <button type="button" disabled={catalogPage >= totalPages} onClick={() => setCatalogPage((page) => page + 1)} className="inline-flex h-10 items-center gap-1 px-3 text-sm font-semibold text-slate-600 disabled:opacity-30 dark:text-slate-300">
              {t('visitor.orientation.next')} <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </section>
    </main>
  )
}

function OrientationResult({ data }: { data: any }) {
  const { t } = useTranslation()
  const orientation = data.orientation ?? {}
  const level = orientation.niveau ?? 'TELECONSULTATION_POSSIBLE'
  const isCritical = level === 'CRITIQUE'
  const isHigh = level === 'ELEVE'
  const color = isCritical
    ? 'border-red-300 bg-red-50 text-red-950 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100'
    : isHigh
      ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100'
      : 'border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-500/25 dark:bg-blue-500/10 dark:text-blue-100'
  const levelLabel: Record<string, string> = {
    CRITIQUE: t('visitor.orientation.levelCritical'),
    ELEVE: t('visitor.orientation.levelHigh'),
    CONSULTATION_RAPIDE: t('visitor.orientation.levelQuickConsult'),
    TELECONSULTATION_POSSIBLE: t('visitor.orientation.levelTeleconsultation'),
  }

  return (
    <section className={`mt-6 border p-5 sm:p-6 ${color}`} aria-live="polite">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0" />
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em]">{t('visitor.orientation.recommendedOrientation')}</p>
            <h2 className="mt-1 font-display text-xl font-bold">{orientation.messageOrientation}</h2>
          </div>
        </div>
        <span className="w-fit border border-current/20 bg-white/60 px-3 py-1 text-xs font-black uppercase dark:bg-white/10">
          {levelLabel[level] ?? level}
        </span>
      </div>

      {orientation.signesDanger?.length > 0 && (
        <ResultList title={t('visitor.orientation.dangerSigns')} items={orientation.signesDanger} icon={ShieldAlert} />
      )}
      {orientation.actionsImmediates?.length > 0 && (
        <ResultList title={t('visitor.orientation.actNow')} items={orientation.actionsImmediates} icon={CheckCircle2} ordered />
      )}
      {orientation.actionsInterdites?.length > 0 && (
        <ResultList title={t('visitor.orientation.doNotDo')} items={orientation.actionsInterdites} icon={XCircle} />
      )}
      {orientation.surveillance?.length > 0 && (
        <ResultList title={t('visitor.orientation.monitor')} items={orientation.surveillance} icon={Clock3} />
      )}

      {orientation.protocoles?.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-black uppercase tracking-wide">{t('visitor.orientation.associatedFirstAid')}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {orientation.protocoles.map((protocol: any) => (
              <Link key={protocol.slug} href={`/premiers-soins/${protocol.slug}`} className="flex items-center justify-between gap-3 border border-current/15 bg-white/70 p-3 text-sm font-bold transition hover:bg-white dark:bg-white/10 dark:hover:bg-white/15">
                {protocol.titre}
                <ArrowRight className="h-4 w-4 shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2 border-t border-current/15 pt-5">
        {(isCritical || isHigh) && (
          <a href={emergencyCallHref()} className="inline-flex h-11 items-center gap-2 bg-red-700 px-4 text-sm font-bold text-white hover:bg-red-600">
            <PhoneCall className="h-4 w-4" /> {t('visitor.orientation.callEmergency', { number: EMERGENCY_NUMBER })}
          </a>
        )}
        <Link href="/medecins" className="inline-flex h-11 items-center gap-2 bg-slate-950 px-4 text-sm font-bold text-white hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500">
          <MessageSquareText className="h-4 w-4" /> {t('visitor.orientation.consultDoctor')}
        </Link>
        <Link href="/centres" className="inline-flex h-11 items-center gap-2 border border-current/20 bg-white/60 px-4 text-sm font-bold hover:bg-white dark:bg-white/10">
          <Building2 className="h-4 w-4" /> {t('visitor.orientation.findCentre')}
        </Link>
      </div>

      {data.causesAEvaluer?.length > 0 && (
        <details className="mt-5 border-t border-current/15 pt-4">
          <summary className="cursor-pointer text-sm font-bold">{t('visitor.orientation.doctorMayAssess')}</summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {data.causesAEvaluer.map((cause: any) => (
              <div key={cause.id ?? cause.nom} className="border border-current/15 bg-white/60 p-3 dark:bg-white/10">
                <p className="text-sm font-bold">{cause.nom}</p>
                <p className="mt-1 text-xs leading-5 opacity-80">{cause.raisonOrientation}</p>
              </div>
            ))}
          </div>
        </details>
      )}

      <p className="mt-4 text-xs leading-5 opacity-75">{data.disclaimer}</p>
    </section>
  )
}

function ResultList({ title, items, icon: Icon, ordered = false }: { title: string; items: string[]; icon: any; ordered?: boolean }) {
  return (
    <div className="mt-5 border-t border-current/15 pt-4">
      <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide">
        <Icon className="h-4 w-4" /> {title}
      </p>
      <ol className="mt-3 space-y-2 text-sm leading-6">
        {items.map((item, index) => (
          <li key={`${title}-${item}`} className="flex gap-3">
            <span className="font-black">{ordered ? `${index + 1}.` : '•'}</span>
            <span>{item}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

function ActionLink({ href, icon: Icon, label, tone }: { href: string; icon: any; label: string; tone: 'red' | 'emerald' | 'blue' }) {
  const tones = {
    red: 'border-red-200 bg-red-50 text-red-900 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-100',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-100',
    blue: 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-500/25 dark:bg-blue-500/10 dark:text-blue-100',
  }
  return (
    <Link href={href} className={`flex min-h-20 items-center justify-between gap-3 border p-4 transition hover:brightness-95 dark:hover:brightness-110 ${tones[tone]}`}>
      <span className="flex items-center gap-3">
        <Icon className="h-6 w-6 shrink-0" />
        <strong className="text-sm">{label}</strong>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0" />
    </Link>
  )
}

function normalize(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}
