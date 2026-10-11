'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  FileCheck,
  Lock,
  MapPin,
  MessageSquare,
  Pause,
  Phone,
  Play,
  ShieldAlert,
  Siren,
  Stethoscope,
  User,
  UserCheck,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { emergencyCallHref, EMERGENCY_NUMBER } from '@/config/firstAid'

/* ── Photography: real Pexels photos of African health professionals,
   never AI-generated. Served through next/image from images.pexels.com. ── */

function pexels(id: string, width = 1920): string {
  return `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${width}`
}

const SLIDE_IMAGE_IDS = ['5452224', '6519935', '6129154', '5721672']

const BAND_IMAGES: Record<string, string> = {
  carte: pexels('33812025'),
  teleconsult: pexels('4989171'),
  pharmacie: pexels('13003793'),
  premiersSoins: pexels('6129198'),
}

const TRUST_IMAGE = pexels('8770714', 1200)

const SLIDE_HREFS: Array<{ primary: string; secondary: string; secondaryCall?: boolean }> = [
  { primary: '/register', secondary: '/carte' },
  { primary: '/login', secondary: '#emergency', secondaryCall: true },
  { primary: '/espace-etablissement', secondary: '/centres' },
  { primary: '/premiers-soins', secondary: '/maladies' },
]

const SOLUTION_ITEMS = [
  { key: 'sos', icon: Siren },
  { key: 'carte', icon: MapPin },
  { key: 'premiersSoins', icon: ShieldAlert },
  { key: 'maladies', icon: BookOpen },
  { key: 'medecins', icon: Stethoscope },
  { key: 'messagerie', icon: MessageSquare },
  { key: 'etablissement', icon: Building2 },
  { key: 'personnel', icon: ClipboardList },
] as const

const ROLE_ITEMS = [
  { key: 'patient', icon: User },
  { key: 'medecin', icon: Stethoscope },
  { key: 'personnel', icon: ClipboardCheck },
  { key: 'etablissement', icon: Building2 },
] as const

const BAND_KEYS = ['carte', 'teleconsult', 'pharmacie', 'premiersSoins'] as const

const TRUST_ITEMS = [
  { key: 'signatures', icon: FileCheck },
  { key: 'validation', icon: UserCheck },
  { key: 'confidentialite', icon: Lock },
  { key: 'reference', icon: BookOpen },
] as const

const FACT_KEYS = ['urgence', 'langues', 'regions', 'paiement'] as const

const ROLE_CTA_HREF: Record<string, string> = {
  patient: '/register',
  medecin: '/register',
  personnel: '/personnel',
  etablissement: '/espace-etablissement',
}

function subscribeReducedMotion(callback: () => void) {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
  mq.addEventListener('change', callback)
  return () => mq.removeEventListener('change', callback)
}

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => false,
  )
}

/* ── Hero carousel ─────────────────────────────────────────────────────── */

function HeroCarousel() {
  const { t } = useTranslation()
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const reducedMotion = usePrefersReducedMotion()
  const regionRef = useRef<HTMLElement | null>(null)
  const total = SLIDE_IMAGE_IDS.length

  const goTo = useCallback(
    (next: number) => setIndex(((next % total) + total) % total),
    [total],
  )

  useEffect(() => {
    if (paused || reducedMotion) return
    const id = setInterval(() => setIndex((i) => (i + 1) % total), 7000)
    return () => clearInterval(id)
  }, [paused, reducedMotion, total])

  useEffect(() => {
    const region = regionRef.current
    if (!region) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goTo(index - 1)
      if (e.key === 'ArrowRight') goTo(index + 1)
    }
    region.addEventListener('keydown', onKey)
    return () => region.removeEventListener('keydown', onKey)
  }, [index, goTo])

  const links = SLIDE_HREFS[index] ?? SLIDE_HREFS[0]

  return (
    <section
      ref={regionRef}
      aria-roledescription="carousel"
      aria-label={t('visitor.landing.ariaLabel')}
      className="relative isolate flex min-h-[86svh] w-full items-end overflow-hidden bg-primary-900"
    >
      {/* Photographs (decorative — the copy carries the meaning) */}
      {SLIDE_IMAGE_IDS.map((id, i) => (
        <Image
          key={id}
          src={pexels(id)}
          alt=""
          fill
          priority={i === 0}
          sizes="100vw"
          className={`object-cover object-[50%_30%] transition-opacity duration-700 ease-out ${
            i === index ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ))}
      {/* Flat readability scrim (no gradient wash) */}
      <div className="absolute inset-0 bg-primary-900/70" aria-hidden="true" />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-10 pt-28 sm:px-6 sm:pb-14 lg:pb-20 lg:pt-36">
        <div aria-live="polite" aria-atomic="true">
          <h2
            key={index}
            className="max-w-3xl font-display text-[1.75rem] font-extrabold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl"
          >
            {t(`visitor.landing.hero.slides.${index}.title`)}
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-white/85 sm:mt-5 sm:text-base lg:text-lg">
            {t(`visitor.landing.hero.slides.${index}.subtitle`)}
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:flex-wrap">
          {links.secondaryCall ? (
            <a
              href={emergencyCallHref()}
              className="inline-flex min-h-12 items-center justify-center gap-2 bg-white px-6 text-sm font-bold text-urgence-600 transition hover:bg-sable"
            >
              <Phone className="h-5 w-5" aria-hidden="true" />
              {t('visitor.landing.hero.slides.1.ctaSecondary')}
            </a>
          ) : (
            <Link
              href={links.secondary}
              className="inline-flex min-h-12 items-center justify-center gap-2 border-2 border-white/70 px-6 text-sm font-bold text-white transition hover:bg-white/10"
            >
              {t(`visitor.landing.hero.slides.${index}.ctaSecondary`)}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          )}
          <Link
            href={links.primary}
            className="inline-flex min-h-12 items-center justify-center gap-2 bg-mint-500 px-6 text-sm font-bold text-primary-900 transition hover:bg-mint-400"
          >
            {t(`visitor.landing.hero.slides.${index}.ctaPrimary`)}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        {/* Controls: flat protocol-style bars + square arrows */}
        <div className="mt-8 flex flex-wrap items-center gap-2 sm:mt-10 sm:gap-4">
          <button
            type="button"
            onClick={() => goTo(index - 1)}
            aria-label={t('visitor.landing.hero.previous')}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center border border-white/40 text-white transition hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <div className="flex items-center gap-2" role="tablist" aria-label={t('visitor.landing.ariaLabel')}>
            {Array.from({ length: total }, (_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={t('visitor.landing.hero.goTo', { number: i + 1 })}
                onClick={() => goTo(i)}
                className={`h-1.5 transition-all ${
                  i === index ? 'w-10 bg-white sm:w-12' : 'w-6 bg-white/35 hover:bg-white/60 sm:w-7'
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => goTo(index + 1)}
            aria-label={t('visitor.landing.hero.next')}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center border border-white/40 text-white transition hover:bg-white/10"
          >
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? t('visitor.landing.hero.play') : t('visitor.landing.hero.pause')}
            className="ml-auto inline-flex h-10 w-10 shrink-0 items-center justify-center border border-white/40 text-white transition hover:bg-white/10"
          >
            {paused ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>
      </div>
    </section>
  )
}

/* ── Deep-dive band (image + copy, alternating) ────────────────────────── */

function FeatureBand({ bandKey, flipped }: { bandKey: (typeof BAND_KEYS)[number]; flipped: boolean }) {
  const { t } = useTranslation()
  const id = `band-${bandKey}`

  return (
    <section
      aria-labelledby={id}
      className="border-b border-primary-500/20 bg-white py-12 dark:border-white/10 dark:bg-primary-800 sm:py-16"
    >
      <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 sm:px-6 lg:grid-cols-2 lg:gap-12">
        <div className={`relative aspect-4/3 w-full overflow-hidden border border-primary-500/20 bg-primary-900 dark:border-white/10 ${flipped ? 'lg:order-2' : ''}`}>
          <Image
            src={BAND_IMAGES[bandKey]}
            alt=""
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover object-[50%_35%]"
          />
        </div>
        <div className={flipped ? 'lg:order-1' : ''}>
          <h2
            id={id}
            className="font-display text-2xl font-bold tracking-tight text-primary-500 sm:text-3xl dark:text-white"
          >
            {t(`visitor.landing.bands.${bandKey}.title`)}
          </h2>
          <p className="mt-3 text-sm leading-6 text-primary-400 sm:text-base dark:text-primary-200">
            {t(`visitor.landing.bands.${bandKey}.desc`)}
          </p>
          <ul className="mt-5 space-y-2.5">
            {['p1', 'p2', 'p3'].map((p) => (
              <li key={p} className="flex items-start gap-3 text-sm text-primary-600 dark:text-primary-100">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-mint-600 dark:text-mint-400" aria-hidden="true" />
                {t(`visitor.landing.bands.${bandKey}.points.${p}`)}
              </li>
            ))}
          </ul>
          <Link
            href={t(`visitor.landing.bands.${bandKey}.href`)}
            className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 bg-primary-500 px-5 text-sm font-bold text-white transition hover:bg-primary-600 dark:bg-mint-500 dark:text-primary-900 dark:hover:bg-mint-400"
          >
            {t(`visitor.landing.bands.${bandKey}.cta`)}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  )
}

/* ── Page ──────────────────────────────────────────────────────────────── */

export default function HomePage() {
  const { t } = useTranslation()

  return (
    <main className="bg-white text-primary-600 dark:bg-primary-800 dark:text-primary-100">
      <h1 className="sr-only">{t('visitor.landing.ariaLabel')}</h1>

      <HeroCarousel />

      {/* ── Emergency band: red is reserved for vital danger ── */}
      <section
        id="emergency"
        aria-labelledby="emergency-title"
        className="bg-urgence-500 text-white"
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-start gap-3">
            <Siren className="mt-0.5 h-6 w-6 shrink-0" aria-hidden="true" />
            <div>
              <p id="emergency-title" className="font-display text-lg font-extrabold leading-tight sm:text-xl">
                {t('visitor.landing.emergency.title')}
              </p>
              <p className="mt-1 text-sm leading-6 text-white/90">{t('visitor.landing.emergency.desc')}</p>
            </div>
          </div>
          <a
            href={emergencyCallHref()}
            className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 bg-white px-6 text-sm font-bold text-urgence-600 transition hover:bg-sable"
          >
            <Phone className="h-5 w-5" aria-hidden="true" />
            {t('visitor.landing.emergency.call', { number: EMERGENCY_NUMBER })}
          </a>
        </div>
      </section>

      {/* ── Complete solution: every feature of the platform ── */}
      <section
        aria-labelledby="solution-title"
        className="border-b border-primary-500/20 bg-white py-12 dark:border-white/10 dark:bg-primary-800 sm:py-16"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-3xl">
            <h2
              id="solution-title"
              className="font-display text-2xl font-bold tracking-tight text-primary-500 sm:text-3xl lg:text-4xl dark:text-white"
            >
              {t('visitor.landing.solution.title')}
            </h2>
            <p className="mt-3 text-sm leading-6 text-primary-400 sm:text-base dark:text-primary-200">
              {t('visitor.landing.solution.subtitle')}
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:mt-10 sm:grid-cols-2 lg:grid-cols-4">
            {SOLUTION_ITEMS.map(({ key, icon: Icon }) => (
              <Link
                key={key}
                href={t(`visitor.landing.solution.items.${key}.href`)}
                className="group flex flex-col border border-primary-500/20 bg-white p-5 transition hover:border-primary-500 dark:border-white/10 dark:bg-primary-900/60 dark:hover:border-primary-300"
              >
                <Icon className="h-6 w-6 text-primary-500 dark:text-mint-400" aria-hidden="true" />
                <h3 className="mt-4 font-display text-lg font-bold text-primary-500 dark:text-white">
                  {t(`visitor.landing.solution.items.${key}.title`)}
                </h3>
                <p className="mt-2 text-sm leading-6 text-primary-400 dark:text-primary-200">
                  {t(`visitor.landing.solution.items.${key}.desc`)}
                </p>
                <span className="mt-auto inline-flex items-center gap-2 pt-4 text-sm font-bold text-primary-500 dark:text-mint-400">
                  {t(`visitor.landing.solution.items.${key}.link`)}
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden="true" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Deep dives: map, teleconsultation, pharmacy, first aid ── */}
      {BAND_KEYS.map((key, i) => (
        <FeatureBand key={key} bandKey={key} flipped={i % 2 === 1} />
      ))}

      {/* ── How it works: one circuit, four workstations ── */}
      <section
        aria-labelledby="roles-title"
        className="border-b border-primary-500/20 bg-sable py-12 dark:border-white/10 dark:bg-primary-900 sm:py-16"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-3xl">
            <h2
              id="roles-title"
              className="font-display text-2xl font-bold tracking-tight text-primary-500 sm:text-3xl lg:text-4xl dark:text-white"
            >
              {t('visitor.landing.roles.title')}
            </h2>
            <p className="mt-3 text-sm leading-6 text-primary-400 sm:text-base dark:text-primary-200">
              {t('visitor.landing.roles.subtitle')}
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:mt-10 lg:grid-cols-2">
            {ROLE_ITEMS.map(({ key, icon: Icon }) => (
              <div
                key={key}
                className="flex flex-col border border-primary-500/20 bg-white p-5 sm:p-6 dark:border-white/10 dark:bg-primary-800"
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center bg-primary-500 text-white dark:bg-mint-500 dark:text-primary-900">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="font-display text-lg font-bold text-primary-500 sm:text-xl dark:text-white">
                    {t(`visitor.landing.roles.${key}.title`)}
                  </h3>
                </div>
                <p className="mt-3 text-sm leading-6 text-primary-400 dark:text-primary-200">
                  {t(`visitor.landing.roles.${key}.desc`)}
                </p>
                <ol className="mt-4 space-y-2">
                  {[1, 2, 3].map((n) => (
                    <li key={n} className="flex items-start gap-3 text-sm text-primary-600 dark:text-primary-100">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-mint-600 dark:text-mint-400" aria-hidden="true" />
                      {t(`visitor.landing.roles.${key}.step${n}`)}
                    </li>
                  ))}
                </ol>
                <Link
                  href={ROLE_CTA_HREF[key] ?? '/register'}
                  className="mt-5 inline-flex min-h-11 w-fit items-center justify-center gap-2 bg-primary-500 px-5 text-sm font-bold text-white transition hover:bg-primary-600 dark:bg-mint-500 dark:text-primary-900 dark:hover:bg-mint-400"
                >
                  {t(`visitor.landing.roles.${key}.cta`)}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Facts: built for Cameroon ── */}
      <section
        aria-labelledby="facts-title"
        className="bg-primary-500 py-10 text-white dark:bg-primary-700 sm:py-12"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 id="facts-title" className="font-display text-xl font-bold tracking-tight sm:text-2xl">
            {t('visitor.landing.facts.title')}
          </h2>
          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-4">
            {FACT_KEYS.map((key) => (
              <div key={key}>
                <dt className="font-display text-2xl font-extrabold text-mint-400 sm:text-3xl">
                  {t(`visitor.landing.facts.items.${key}.value`)}
                </dt>
                <dd className="mt-1.5 text-sm leading-6 text-white/85">
                  {t(`visitor.landing.facts.items.${key}.label`)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── Trust: proofs, not promises ── */}
      <section
        aria-labelledby="trust-title"
        className="bg-primary-500 py-12 text-white dark:bg-primary-700 sm:py-16"
      >
        <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-start lg:gap-10">
          <div>
            <h2
              id="trust-title"
              className="font-display text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl"
            >
              {t('visitor.landing.trust.title')}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85 sm:text-base">
              {t('visitor.landing.trust.subtitle')}
            </p>
            <div className="mt-6 grid gap-4 sm:mt-8 sm:grid-cols-2">
              {TRUST_ITEMS.map(({ key, icon: Icon }) => (
                <div key={key} className="border border-white/20 p-4">
                  <Icon className="h-5 w-5 text-mint-400" aria-hidden="true" />
                  <h3 className="mt-3 font-display text-base font-bold">{t(`visitor.landing.trust.items.${key}.title`)}</h3>
                  <p className="mt-1.5 text-sm leading-6 text-white/85">{t(`visitor.landing.trust.items.${key}.desc`)}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="relative aspect-4/3 w-full overflow-hidden border border-white/20 bg-primary-700 lg:mt-14">
            <Image
              src={TRUST_IMAGE}
              alt=""
              fill
              sizes="(max-width: 1024px) 100vw, 40vw"
              className="object-cover object-[50%_35%]"
            />
          </div>
        </div>
      </section>
    </main>
  )
}
