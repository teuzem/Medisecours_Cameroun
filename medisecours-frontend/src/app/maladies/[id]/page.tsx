'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  MessageSquareText,
  ShieldAlert,
} from 'lucide-react'
import api from '@/api/axios'
import EmptyState from '@/components/ui/EmptyState'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { useTranslation } from 'react-i18next'

export default function MaladieDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { t } = useTranslation()
  const [maladie, setMaladie] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let active = true
    api.get(`/api/public/conditions/${id}`)
      .then((response) => {
        if (active) setMaladie(response.data)
      })
      .catch((error) => {
        if (active && error.response?.status === 404) setNotFound(true)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [id])

  if (loading) return <LoadingSpinner label={t('visitor.maladieDetail.loading')} />
  if (notFound || !maladie) {
    return (
      <main className="mx-auto min-h-[60vh] max-w-4xl px-4 py-12 sm:px-6">
        <EmptyState
          title={t('visitor.maladieDetail.notFoundTitle')}
          description={t('visitor.maladieDetail.notFoundDesc')}
          action={<Link href="/maladies" className="font-semibold text-emerald-700 underline">{t('visitor.maladieDetail.backToOrientation')}</Link>}
        />
      </main>
    )
  }

  const symptoms = splitContent(maladie.symptomes)
  const precautions = splitContent(maladie.precautions)

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <button type="button" onClick={() => router.back()} className="inline-flex h-10 items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white">
        <ArrowLeft className="h-4 w-4" /> {t('visitor.maladieDetail.back')}
      </button>

      <header className="mt-4 border-b border-slate-200 pb-6 dark:border-white/10">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-emerald-700 dark:text-emerald-300">
          {t('visitor.maladieDetail.eyebrow')}
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold text-slate-950 dark:text-white sm:text-4xl">{maladie.nom}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
          {t('visitor.maladieDetail.intro')}
        </p>
      </header>

      {maladie.urgence && (
        <section className="mt-6 flex gap-3 border border-red-200 bg-red-50 p-4 text-red-900 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-100">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <h2 className="font-bold">{t('visitor.maladieDetail.urgentTitle')}</h2>
            <p className="mt-1 text-sm leading-6">
              {t('visitor.maladieDetail.urgentDesc')}
            </p>
          </div>
        </section>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        <article className="space-y-8">
          {maladie.description && (
            <InfoSection title={t('visitor.maladieDetail.understandTitle')} icon={ShieldAlert}>
              <p className="whitespace-pre-line text-sm leading-7 text-slate-600 dark:text-slate-300">{maladie.description}</p>
            </InfoSection>
          )}

          {symptoms.length > 0 && (
            <InfoSection title={t('visitor.maladieDetail.signsTitle')} icon={CheckCircle2}>
              <ul className="space-y-2">
                {symptoms.map((symptom) => (
                  <li key={symptom} className="flex gap-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    <span className="font-black text-emerald-700 dark:text-emerald-300">•</span>
                    <span>{symptom}</span>
                  </li>
                ))}
              </ul>
            </InfoSection>
          )}

          {maladie.causes && (
            <InfoSection title={t('visitor.maladieDetail.causesTitle')} icon={MessageSquareText}>
              <p className="whitespace-pre-line text-sm leading-7 text-slate-600 dark:text-slate-300">{maladie.causes}</p>
            </InfoSection>
          )}

          {precautions.length > 0 && (
            <InfoSection title={t('visitor.maladieDetail.precautionsTitle')} icon={ShieldAlert}>
              <ul className="space-y-2">
                {precautions.map((item) => (
                  <li key={item} className="flex gap-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    <span className="font-black text-blue-700 dark:text-blue-300">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </InfoSection>
          )}
        </article>

        <aside className="h-fit border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-slate-900">
          <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">{t('visitor.maladieDetail.nextStepTitle')}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
            {t('visitor.maladieDetail.nextStepDesc')}
          </p>
          <div className="mt-4 space-y-2">
            <Link href="/medecins" className="flex h-11 items-center justify-center gap-2 bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-600">
              <MessageSquareText className="h-4 w-4" /> {t('visitor.maladieDetail.consultDoctor')}
            </Link>
            <Link href="/centres" className="flex h-11 items-center justify-center gap-2 border border-slate-300 bg-white px-4 text-sm font-bold text-slate-800 hover:bg-slate-100 dark:border-white/15 dark:bg-slate-950 dark:text-white">
              <Building2 className="h-4 w-4" /> {t('visitor.maladieDetail.findCentre')}
            </Link>
            <Link href="/premiers-soins" className="flex h-11 items-center justify-center gap-2 border border-slate-300 bg-white px-4 text-sm font-bold text-slate-800 hover:bg-slate-100 dark:border-white/15 dark:bg-slate-950 dark:text-white">
              <ShieldAlert className="h-4 w-4" /> {t('visitor.maladieDetail.firstAid')}
            </Link>
          </div>
        </aside>
      </div>
    </main>
  )
}

function InfoSection({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="flex items-center gap-2 font-display text-xl font-bold text-slate-950 dark:text-white">
        <Icon className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function splitContent(value?: string | null): string[] {
  if (!value) return []
  return value
    .split(/[,;\n\r]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 20)
}
