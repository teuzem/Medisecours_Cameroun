'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  Camera,
  CheckCircle2,
  Clock,
  FileText,
  MapPin,
  ShieldCheck,
  Siren,
  Stethoscope,
  Video,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

type SystemState = 'loading' | 'ok' | 'degraded' | 'offline'

function useSystemStatus(): { state: SystemState; ms: number | null } {
  const [state, setState] = useState<SystemState>('loading')
  const [ms, setMs] = useState<number | null>(null)

  useEffect(() => {
    let alive = true
    const debut = performance.now()
    fetch('/api/health', { cache: 'no-store' })
      .then(async (reponse) => {
        if (!alive) return
        setMs(Math.round(performance.now() - debut))
        if (!reponse.ok) {
          setState('offline')
          return
        }
        const data = await reponse.json().catch(() => null)
        setState(data?.status === 'ok' ? 'ok' : 'degraded')
      })
      .catch(() => {
        if (alive) setState('offline')
      })
    return () => {
      alive = false
    }
  }, [])

  return { state, ms }
}

const ETAPES = [
  { icone: MapPin, titreKey: 'visitor.sosPage.s1t', descKey: 'visitor.sosPage.s1d' },
  { icone: Camera, titreKey: 'visitor.sosPage.s2t', descKey: 'visitor.sosPage.s2d' },
  { icone: BellRing, titreKey: 'visitor.sosPage.s3t', descKey: 'visitor.sosPage.s3d' },
  { icone: Siren, titreKey: 'visitor.sosPage.s4t', descKey: 'visitor.sosPage.s4d' },
  { icone: Stethoscope, titreKey: 'visitor.sosPage.s5t', descKey: 'visitor.sosPage.s5d' },
] as const

const MODALITES = [
  { titreKey: 'visitor.sosPage.terms1t', descKey: 'visitor.sosPage.terms1d' },
  { titreKey: 'visitor.sosPage.terms2t', descKey: 'visitor.sosPage.terms2d' },
  { titreKey: 'visitor.sosPage.terms3t', descKey: 'visitor.sosPage.terms3d' },
  { titreKey: 'visitor.sosPage.terms4t', descKey: 'visitor.sosPage.terms4d' },
  { titreKey: 'visitor.sosPage.terms5t', descKey: 'visitor.sosPage.terms5d' },
] as const

export default function SosPage() {
  const { t } = useTranslation()
  const { state, ms } = useSystemStatus()

  return (
    <main className="min-h-dvh bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6">
        {/* ── Hero : cap visuel + statut live ─────────────────────────── */}
        <section className="grid items-center gap-10 pt-16 md:grid-cols-2 md:pt-24">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-red-600 dark:text-red-400">
              {t('visitor.sosPage.eyebrow')}
            </p>
            <h1 className="mt-3 max-w-xl text-4xl font-black leading-[1.1] tracking-tight md:text-5xl">
              {t('visitor.sosPage.title')}
            </h1>
            <p className="mt-4 max-w-[52ch] text-base leading-relaxed text-slate-600 dark:text-slate-300">
              {t('visitor.sosPage.sub')}
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-4">
              <Link
                href="/carte"
                className="inline-flex items-center gap-2 rounded-full bg-red-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/25 transition hover:bg-red-700 active:scale-[0.98]"
              >
                {t('visitor.sosPage.cta')}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#fonctionnement" className="text-sm font-bold text-red-700 underline-offset-4 hover:underline dark:text-red-300">
                {t('visitor.sosPage.ctaSecondaire')}
              </a>
            </div>
          </div>

          <div
            className="rounded-2xl border border-slate-200 bg-slate-50 p-6 dark:border-white/10 dark:bg-slate-900"
            role="status"
            aria-live="polite"
          >
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <span className="relative flex h-2.5 w-2.5">
                <span
                  className={`absolute inline-flex h-full w-full rounded-full opacity-75 motion-reduce:animate-none ${
                    state === 'ok' ? 'animate-ping bg-emerald-400' : state === 'loading' ? 'animate-ping bg-slate-400' : 'animate-ping bg-red-400'
                  }`}
                />
                <span
                  className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                    state === 'ok' ? 'bg-emerald-500' : state === 'loading' ? 'bg-slate-400' : 'bg-red-500'
                  }`}
                />
              </span>
              {t('visitor.sosPage.statutTitre')}
            </p>
            <p className="mt-3 text-2xl font-black">
              {state === 'loading' && t('visitor.sosPage.statutChargement')}
              {state === 'ok' && t('visitor.sosPage.statutOk')}
              {state === 'degraded' && t('visitor.sosPage.statutDegrade')}
              {state === 'offline' && t('visitor.sosPage.statutHorsLigne')}
            </p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {ms != null
                ? t('visitor.sosPage.statutLatence', { ms })
                : t('visitor.sosPage.statutVerification')}
            </p>
            <div className="mt-5 grid grid-cols-3 gap-3 border-t border-slate-200 pt-5 text-center dark:border-white/10">
              {[
                { icone: Video, label: t('visitor.sosPage.atoutVideo') },
                { icone: Clock, label: t('visitor.sosPage.atoutSuivi') },
                { icone: ShieldCheck, label: t('visitor.sosPage.atoutTriage') },
              ].map(({ icone: Icone, label }) => (
                <div key={label} className="flex flex-col items-center gap-1.5">
                  <Icone className="h-5 w-5 text-red-600 dark:text-red-400" />
                  <span className="text-[11px] font-bold leading-tight text-slate-600 dark:text-slate-300">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Fonctionnement en 5 étapes ──────────────────────────────── */}
        <section id="fonctionnement" className="mt-20 scroll-mt-20 md:mt-28">
          <h2 className="max-w-xl text-3xl font-black tracking-tight">
            {t('visitor.sosPage.etapesTitre')}
          </h2>
          <ol className="mt-8 space-y-0">
            {ETAPES.map(({ icone: Icone, titreKey, descKey }, index) => (
              <li key={titreKey} className="relative flex gap-5 pb-8 last:pb-0">
                {index < ETAPES.length - 1 && (
                  <span aria-hidden className="absolute left-[21px] top-12 h-[calc(100%-3rem)] w-0.5 bg-red-100 dark:bg-red-500/20" />
                )}
                <span className="z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-600 text-white shadow-md shadow-red-600/20">
                  <Icone className="h-5 w-5" />
                </span>
                <div className="min-w-0 pt-1">
                  <p className="text-sm font-black">
                    <span className="mr-2 text-red-600 dark:text-red-400">{index + 1}</span>
                    {t(titreKey)}
                  </p>
                  <p className="mt-1 max-w-[62ch] text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    {t(descKey)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* ── Gravités : 1 bannière + 2 tuiles ────────────────────────── */}
        <section className="mt-20 md:mt-28">
          <h2 className="max-w-xl text-3xl font-black tracking-tight">
            {t('visitor.sosPage.graviteTitre')}
          </h2>
          <div className="mt-8 rounded-2xl bg-red-600 p-6 text-white shadow-xl shadow-red-600/20 sm:p-8">
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-red-100">
              <Siren className="h-4 w-4" />
              {t('visitor.sosPage.graviteCritique')}
            </p>
            <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-red-50">
              {t('visitor.sosPage.graviteCritiqueDesc')}
            </p>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-500/25 dark:bg-amber-500/10">
              <p className="flex items-center gap-2 text-sm font-black text-amber-800 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4" />
                {t('visitor.sosPage.graviteUrgente')}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-amber-900/80 dark:text-amber-200/80">
                {t('visitor.sosPage.graviteUrgenteDesc')}
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-500/25 dark:bg-emerald-500/10">
              <p className="flex items-center gap-2 text-sm font-black text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
                {t('visitor.sosPage.graviteLegere')}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-emerald-900/80 dark:text-emerald-200/80">
                {t('visitor.sosPage.graviteLegereDesc')}
              </p>
            </div>
          </div>
        </section>

        {/* ── Conditions d'utilisation ────────────────────────────────── */}
        <section className="mt-20 md:mt-28">
          <h2 className="max-w-xl text-3xl font-black tracking-tight">
            {t('visitor.sosPage.conditionsTitre')}
          </h2>
          <div className="mt-6 divide-y divide-slate-200 rounded-2xl border border-slate-200 dark:divide-white/10 dark:border-white/10">
            {MODALITES.map(({ titreKey, descKey }, index) => (
              <div key={titreKey} className="grid gap-1 p-5 sm:grid-cols-[48px_1fr] sm:gap-4 sm:p-6">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-sm font-black text-slate-600 dark:bg-white/10 dark:text-slate-300">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-black">
                    <FileText className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                    {t(titreKey)}
                  </p>
                  <p className="mt-1 max-w-[68ch] text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    {t(descKey)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Appel final ─────────────────────────────────────────────── */}
        <section className="mt-20 rounded-2xl bg-slate-950 px-6 py-12 text-center dark:bg-white md:mt-28">
          <Siren className="mx-auto h-8 w-8 text-red-500" />
          <h2 className="mx-auto mt-4 max-w-xl text-3xl font-black tracking-tight text-white dark:text-slate-950">
            {t('visitor.sosPage.ctaTitre')}
          </h2>
          <p className="mx-auto mt-2 max-w-[52ch] text-sm leading-relaxed text-slate-300 dark:text-slate-600">
            {t('visitor.sosPage.ctaSousTitre')}
          </p>
          <Link
            href="/carte"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-red-600 px-7 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/25 transition hover:bg-red-500 active:scale-[0.98]"
          >
            {t('visitor.sosPage.ctaButton')}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      </div>
    </main>
  )
}
