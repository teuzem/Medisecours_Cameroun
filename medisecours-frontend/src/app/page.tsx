'use client'

import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  HeartPulse,
  PhoneCall,
  Search,
  ShieldAlert,
  Stethoscope,
  UserRound,
} from 'lucide-react'
import { emergencyCallHref, EMERGENCY_NUMBER } from '@/config/firstAid'
import { useTranslation } from 'react-i18next'

const situations = [
  {
    href: '/premiers-soins',
    icon: ShieldAlert,
    labelKey: 'visitor.home.situations.emergencyLabel',
    titleKey: 'visitor.home.situations.emergencyTitle',
    descriptionKey: 'visitor.home.situations.emergencyDescription',
    actionKey: 'visitor.home.situations.emergencyAction',
    tone: 'border-red-200 bg-red-50 text-red-950 hover:border-red-300 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-100',
    iconTone: 'bg-red-600 text-white',
  },
  {
    href: '/maladies',
    icon: Search,
    labelKey: 'visitor.home.situations.symptomsLabel',
    titleKey: 'visitor.home.situations.symptomsTitle',
    descriptionKey: 'visitor.home.situations.symptomsDescription',
    actionKey: 'visitor.home.situations.symptomsAction',
    tone: 'border-blue-200 bg-blue-50 text-blue-950 hover:border-blue-300 dark:border-blue-500/25 dark:bg-blue-500/10 dark:text-blue-100',
    iconTone: 'bg-blue-600 text-white',
  },
  {
    href: '/medecins',
    icon: Stethoscope,
    labelKey: 'visitor.home.situations.professionalLabel',
    titleKey: 'visitor.home.situations.professionalTitle',
    descriptionKey: 'visitor.home.situations.professionalDescription',
    actionKey: 'visitor.home.situations.professionalAction',
    tone: 'border-emerald-200 bg-emerald-50 text-emerald-950 hover:border-emerald-300 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-100',
    iconTone: 'bg-emerald-600 text-white',
  },
]

const steps = [
  {
    icon: HeartPulse,
    titleKey: 'visitor.home.how.observeTitle',
    descriptionKey: 'visitor.home.how.observeDesc',
  },
  {
    icon: ClipboardCheck,
    titleKey: 'visitor.home.how.chooseTitle',
    descriptionKey: 'visitor.home.how.chooseDesc',
  },
  {
    icon: UserRound,
    titleKey: 'visitor.home.how.followTitle',
    descriptionKey: 'visitor.home.how.followDesc',
  },
]

export default function HomePage() {
  const { t } = useTranslation()
  return (
    <main className="bg-white dark:bg-slate-950">
      <section className="relative flex min-h-[68svh] items-end overflow-hidden bg-slate-950 sm:min-h-[72svh]">
        <Image
          src="/images/home-emergency.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-slate-950/72" aria-hidden="true" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/80 to-slate-950/30" aria-hidden="true" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950/30" aria-hidden="true" />

        <div className="relative mx-auto w-full max-w-6xl px-4 pb-10 pt-28 sm:px-6 sm:pb-14 xl:pt-36">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-300">
            {t('visitor.home.hero.needHelp')}
          </p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl">
            {t('visitor.home.hero.title')}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200 sm:text-lg">
            {t('visitor.home.hero.subtitle')}
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              href="/premiers-soins"
              className="inline-flex min-h-12 items-center justify-center gap-2 bg-red-600 px-5 text-sm font-bold text-white transition hover:bg-red-500"
            >
              <ShieldAlert className="h-5 w-5" aria-hidden="true" />
              {t('visitor.home.hero.emergencyCta')}
            </Link>
            <a
              href={emergencyCallHref()}
              className="inline-flex min-h-12 items-center justify-center gap-2 border border-white/35 bg-white/10 px-5 text-sm font-bold text-white backdrop-blur transition hover:bg-white/20"
            >
              <PhoneCall className="h-5 w-5" aria-hidden="true" />
              {t('visitor.home.hero.callEmergency', { number: EMERGENCY_NUMBER })}
            </a>
          </div>

          <p className="mt-5 max-w-2xl text-xs leading-5 text-slate-300">
            {t('visitor.home.hero.disclaimer')}
          </p>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white py-10 dark:border-white/10 dark:bg-slate-950 sm:py-14" aria-labelledby="choose-situation-title">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
              {t('visitor.home.situations.eyebrow')}
            </p>
            <h2 id="choose-situation-title" className="mt-2 font-display text-2xl font-bold text-slate-950 dark:text-white sm:text-3xl">
              {t('visitor.home.situations.title')}
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-base">
              {t('visitor.home.situations.subtitle')}
            </p>
          </div>

          <div className="mt-7 grid gap-3 lg:grid-cols-3">
            {situations.map((situation) => {
              const Icon = situation.icon
              return (
                <Link
                  key={situation.href}
                  href={situation.href}
                  className={`group flex min-h-64 flex-col border p-5 transition hover:-translate-y-0.5 hover:shadow-md ${situation.tone}`}
                >
                  <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${situation.iconTone}`}>
                    <Icon className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <p className="mt-5 text-xs font-bold uppercase tracking-[0.1em] opacity-70">{t(situation.labelKey)}</p>
                  <h3 className="mt-1 font-display text-xl font-bold">{t(situation.titleKey)}</h3>
                  <p className="mt-2 text-sm leading-6 opacity-80">{t(situation.descriptionKey)}</p>
                  <span className="mt-auto inline-flex items-center gap-2 pt-5 text-sm font-bold">
                    {t(situation.actionKey)}
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden="true" />
                  </span>
                </Link>
              )
            })}
          </div>

          <div className="mt-4 flex flex-col gap-3 border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-violet-600 dark:text-violet-300" aria-hidden="true" />
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">{t('visitor.home.situations.travelTitle')}</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t('visitor.home.situations.travelDesc')}</p>
              </div>
            </div>
            <Link
              href="/centres"
              className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 border border-slate-300 bg-white px-4 text-sm font-bold text-slate-800 transition hover:bg-slate-100 dark:border-white/15 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
            >
              {t('visitor.home.situations.findCentre')}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-10 dark:bg-slate-900 sm:py-14" aria-labelledby="how-it-works-title">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-8 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700 dark:text-blue-300">
                {t('visitor.home.how.eyebrow')}
              </p>
              <h2 id="how-it-works-title" className="mt-2 font-display text-2xl font-bold text-slate-950 dark:text-white sm:text-3xl">
                {t('visitor.home.how.title')}
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {t('visitor.home.how.description')}
              </p>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row lg:flex-col lg:items-start">
                <Link
                  href="/register"
                  className="inline-flex min-h-11 items-center justify-center gap-2 bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                >
                  {t('visitor.home.how.createAccount')}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex min-h-11 items-center justify-center px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-200 dark:text-slate-200 dark:hover:bg-white/5"
                >
                  {t('visitor.home.how.haveAccount')}
                </Link>
              </div>
            </div>

            <ol className="divide-y divide-slate-200 border-y border-slate-200 dark:divide-white/10 dark:border-white/10">
              {steps.map((step, index) => {
                const Icon = step.icon
                return (
                  <li key={t(step.titleKey)} className="grid grid-cols-[42px_minmax(0,1fr)] gap-4 py-5">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-blue-700 shadow-sm dark:bg-slate-800 dark:text-blue-300">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400 dark:text-slate-500">{t('visitor.home.how.step', { number: index + 1 })}</p>
                      <h3 className="mt-1 font-display text-lg font-bold text-slate-950 dark:text-white">{t(step.titleKey)}</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{t(step.descriptionKey)}</p>
                    </div>
                  </li>
                )
              })}
            </ol>
          </div>

          <div className="mt-8 flex gap-3 border-l-4 border-amber-500 bg-amber-50 p-4 text-amber-950 dark:bg-amber-500/10 dark:text-amber-100">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <p className="text-sm leading-6">
              {t('visitor.home.how.disclaimer')}
            </p>
          </div>
        </div>
      </section>

      <section className="relative flex min-h-[480px] items-end overflow-hidden border-t border-slate-200 bg-slate-950 dark:border-white/10 sm:min-h-[560px]" aria-labelledby="home-consultation-title">
        <Image
          src="/images/home-doctor-visit.jpg"
          alt={t('visitor.home.consult.imageAlt')}
          fill
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-slate-950/38" aria-hidden="true" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/65 to-transparent" aria-hidden="true" />

        <div className="relative mx-auto w-full max-w-6xl px-4 pb-8 pt-24 text-white sm:px-6 sm:pb-12 lg:pb-14">
          <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-300">
                {t('visitor.home.consult.eyebrow')}
              </p>
              <h2 id="home-consultation-title" className="mt-2 font-display text-2xl font-bold sm:text-3xl lg:text-4xl">
                {t('visitor.home.consult.title')}
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-200 sm:text-base">
                {t('visitor.home.consult.description')}
              </p>
              <Link
                href="/medecins"
                className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 bg-emerald-600 px-4 text-sm font-bold text-white transition hover:bg-emerald-500"
              >
                {t('visitor.home.consult.cta')}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
          </div>
        </div>
      </section>

      <section className="relative flex min-h-[500px] items-end overflow-hidden border-t border-white/10 bg-slate-950 sm:min-h-[580px]" aria-labelledby="home-guided-care-title">
        <Image
          src="/images/home-care-guidance.jpg"
          alt={t('visitor.home.guided.imageAlt')}
          fill
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-slate-950/40" aria-hidden="true" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent" aria-hidden="true" />

        <div className="relative mx-auto w-full max-w-6xl px-4 pb-8 pt-24 text-white sm:px-6 sm:pb-12 lg:pb-14">
          <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-300">
                {t('visitor.home.guided.eyebrow')}
              </p>
              <h2 id="home-guided-care-title" className="mt-2 font-display text-2xl font-bold sm:text-3xl lg:text-4xl">
                {t('visitor.home.guided.title')}
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-200 sm:text-base">
                {t('visitor.home.guided.description')}
              </p>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/premiers-soins"
                  className="inline-flex min-h-11 items-center justify-center gap-2 bg-blue-600 px-4 text-sm font-bold text-white transition hover:bg-blue-500"
                >
                  {t('visitor.home.guided.firstAidCta')}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link
                  href="/centres"
                  className="inline-flex min-h-11 items-center justify-center gap-2 border border-white/35 bg-white/10 px-4 text-sm font-bold text-white backdrop-blur transition hover:bg-white/20"
                >
                  <Building2 className="h-4 w-4" aria-hidden="true" />
                  {t('visitor.home.guided.centresCta')}
                </Link>
              </div>
          </div>
        </div>
      </section>
    </main>
  )
}
