'use client'

import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  PhoneCall,
  Search,
  ShieldAlert,
  Stethoscope,
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
    stripe: 'bg-urgence-500',
    labelTone: 'text-urgence-600 dark:text-urgence-400',
    actionTone: 'text-urgence-600 group-hover:text-urgence-700 dark:text-urgence-400',
  },
  {
    href: '/maladies',
    icon: Search,
    labelKey: 'visitor.home.situations.symptomsLabel',
    titleKey: 'visitor.home.situations.symptomsTitle',
    descriptionKey: 'visitor.home.situations.symptomsDescription',
    actionKey: 'visitor.home.situations.symptomsAction',
    stripe: 'bg-primary-500',
    labelTone: 'text-primary-400 dark:text-primary-300',
    actionTone: 'text-primary-500 group-hover:text-primary-700 dark:text-mint-300',
  },
  {
    href: '/medecins',
    icon: Stethoscope,
    labelKey: 'visitor.home.situations.professionalLabel',
    titleKey: 'visitor.home.situations.professionalTitle',
    descriptionKey: 'visitor.home.situations.professionalDescription',
    actionKey: 'visitor.home.situations.professionalAction',
    stripe: 'bg-mint-500',
    labelTone: 'text-mint-700 dark:text-mint-400',
    actionTone: 'text-mint-700 group-hover:text-mint-800 dark:text-mint-400',
  },
]

const steps = [
  {
    titleKey: 'visitor.home.how.observeTitle',
    descriptionKey: 'visitor.home.how.observeDesc',
  },
  {
    titleKey: 'visitor.home.how.chooseTitle',
    descriptionKey: 'visitor.home.how.chooseDesc',
  },
  {
    titleKey: 'visitor.home.how.followTitle',
    descriptionKey: 'visitor.home.how.followDesc',
  },
]

export default function HomePage() {
  const { t } = useTranslation()
  return (
    <main className="bg-white text-primary-600 dark:bg-primary-800 dark:text-primary-100">
      {/* ── Situation band: the protocol sheet opening (no stock photo) ── */}
      <section
        className="border-b-2 border-primary-500 bg-sable text-primary-600 dark:border-primary-400 dark:bg-primary-900 dark:text-primary-100"
        aria-labelledby="home-hero-title"
      >
        <div className="mx-auto grid max-w-6xl gap-8 px-4 pb-10 pt-12 sm:px-6 sm:pb-14 sm:pt-16 lg:grid-cols-[1.35fr_1fr] lg:items-start lg:gap-12 lg:pt-24 xl:pt-28">
          <div className="min-w-0">
            <h1
              id="home-hero-title"
              className="max-w-3xl font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-primary-500 sm:text-5xl lg:text-6xl dark:text-white"
            >
              {t('visitor.home.hero.title')}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-primary-600 sm:text-lg dark:text-primary-200">
              {t('visitor.home.hero.subtitle')}
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                href="/premiers-soins"
                className="inline-flex min-h-12 items-center justify-center gap-2 bg-urgence-500 px-6 text-sm font-bold text-white transition hover:bg-urgence-600"
              >
                <ShieldAlert className="h-5 w-5" aria-hidden="true" />
                {t('visitor.home.hero.emergencyCta')}
              </Link>
              <a
                href={emergencyCallHref()}
                className="inline-flex min-h-12 items-center justify-center gap-2 border-2 border-primary-500 bg-white px-6 text-sm font-bold text-primary-500 transition hover:bg-primary-50 dark:border-primary-300 dark:bg-primary-800 dark:text-white dark:hover:bg-primary-700"
              >
                <PhoneCall className="h-5 w-5" aria-hidden="true" />
                {t('visitor.home.hero.callEmergency', { number: EMERGENCY_NUMBER })}
              </a>
            </div>

            <p className="mt-6 max-w-2xl text-xs leading-5 text-primary-400 dark:text-primary-300">
              {t('visitor.home.hero.disclaimer')}
            </p>
          </div>

          {/* Emergency instruction band: the red wall panel */}
          <aside className="bg-urgence-500 p-5 text-white sm:p-6">
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-7 w-7 shrink-0" aria-hidden="true" />
              <p className="font-display text-lg font-extrabold leading-tight sm:text-xl">
                {t('visitor.home.situations.emergencyLabel')}
              </p>
            </div>
            <p className="mt-4 font-display text-6xl font-extrabold leading-none sm:text-7xl">
              {EMERGENCY_NUMBER}
            </p>
            <a
              href={emergencyCallHref()}
              className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 bg-white px-6 text-sm font-bold text-urgence-600 transition hover:bg-sable sm:w-auto"
            >
              <PhoneCall className="h-5 w-5" aria-hidden="true" />
              {t('visitor.home.hero.callEmergency', { number: EMERGENCY_NUMBER })}
            </a>
          </aside>
        </div>
      </section>

      {/* ── Three real situations → three actions ── */}
      <section
        className="border-b border-primary-500/20 bg-white py-10 dark:border-white/10 dark:bg-primary-800 sm:py-14"
        aria-labelledby="choose-situation-title"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-3xl">
            <h2
              id="choose-situation-title"
              className="font-display text-2xl font-bold text-primary-500 sm:text-3xl dark:text-white"
            >
              {t('visitor.home.situations.title')}
            </h2>
            <p className="mt-3 text-sm leading-6 text-primary-400 sm:text-base dark:text-primary-200">
              {t('visitor.home.situations.subtitle')}
            </p>
          </div>

          <div className="mt-7 grid gap-3 lg:grid-cols-3">
            {situations.map((situation, index) => {
              const Icon = situation.icon
              return (
                <Link
                  key={situation.href}
                  href={situation.href}
                  className="group relative flex min-h-60 flex-col border border-primary-500/20 bg-white p-5 pt-6 transition hover:border-primary-500 dark:border-white/10 dark:bg-primary-900/60 dark:hover:border-primary-300"
                >
                  <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-1.5 ${situation.stripe}`} />
                  <div className="flex items-start justify-between gap-3">
                    <Icon className="h-7 w-7 shrink-0 text-primary-500 dark:text-mint-300" aria-hidden="true" />
                    <span
                      className="font-display text-3xl font-extrabold leading-none text-primary-500/15 dark:text-white/15"
                      aria-hidden="true"
                    >
                      0{index + 1}
                    </span>
                  </div>
                  <p className={`mt-4 text-[13px] font-semibold ${situation.labelTone}`}>{t(situation.labelKey)}</p>
                  <h3 className="mt-1 font-display text-xl font-bold text-primary-500 dark:text-white">
                    {t(situation.titleKey)}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-primary-400 dark:text-primary-200">
                    {t(situation.descriptionKey)}
                  </p>
                  <span
                    className={`mt-auto inline-flex items-center gap-2 pt-5 text-sm font-bold ${situation.actionTone}`}
                  >
                    {t(situation.actionKey)}
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden="true" />
                  </span>
                </Link>
              )
            })}
          </div>

          <div className="mt-4 flex flex-col gap-3 border border-primary-500/20 bg-sable p-4 dark:border-white/10 dark:bg-primary-900 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-primary-500 dark:text-mint-300" aria-hidden="true" />
              <div>
                <p className="text-sm font-bold text-primary-500 dark:text-white">{t('visitor.home.situations.travelTitle')}</p>
                <p className="mt-1 text-sm text-primary-400 dark:text-primary-200">{t('visitor.home.situations.travelDesc')}</p>
              </div>
            </div>
            <Link
              href="/centres"
              className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 border-2 border-primary-500 bg-white px-4 text-sm font-bold text-primary-500 transition hover:bg-primary-50 dark:border-primary-300 dark:bg-primary-800 dark:text-white dark:hover:bg-primary-700"
            >
              {t('visitor.home.situations.findCentre')}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Numbered protocol steps ── */}
      <section
        className="border-b border-primary-500/20 bg-sable py-10 dark:border-white/10 dark:bg-primary-900 sm:py-14"
        aria-labelledby="how-it-works-title"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-8 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
            <div>
              <h2
                id="how-it-works-title"
                className="font-display text-2xl font-bold text-primary-500 sm:text-3xl dark:text-white"
              >
                {t('visitor.home.how.title')}
              </h2>
              <p className="mt-3 text-sm leading-6 text-primary-400 dark:text-primary-200">
                {t('visitor.home.how.description')}
              </p>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row lg:flex-col lg:items-start">
                <Link
                  href="/register"
                  className="inline-flex min-h-11 items-center justify-center gap-2 bg-primary-500 px-4 text-sm font-bold text-white transition hover:bg-primary-600 dark:bg-mint-500 dark:text-primary-900 dark:hover:bg-mint-400"
                >
                  {t('visitor.home.how.createAccount')}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex min-h-11 items-center justify-center px-4 text-sm font-bold text-primary-500 transition hover:bg-primary-500/10 dark:text-white dark:hover:bg-white/5"
                >
                  {t('visitor.home.how.haveAccount')}
                </Link>
              </div>
            </div>

            <ol className="divide-y divide-primary-500/20 border-y border-primary-500/20 dark:divide-white/10 dark:border-white/10">
              {steps.map((step, index) => (
                <li key={t(step.titleKey)} className="grid grid-cols-[42px_minmax(0,1fr)] gap-4 py-5">
                  <span className="flex h-10 w-10 items-center justify-center bg-primary-500 font-display text-lg font-extrabold text-white dark:bg-mint-500 dark:text-primary-900">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-primary-400 dark:text-primary-300">
                      {t('visitor.home.how.step', { number: index + 1 })}
                    </p>
                    <h3 className="mt-1 font-display text-lg font-bold text-primary-500 dark:text-white">
                      {t(step.titleKey)}
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-primary-400 dark:text-primary-200">
                      {t(step.descriptionKey)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="mt-8 flex gap-3 border border-primary-200 bg-white p-4 text-primary-700 dark:border-primary-700 dark:bg-primary-800 dark:text-primary-200">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary-500 dark:text-mint-400" aria-hidden="true" />
            <p className="text-sm leading-6">{t('visitor.home.how.disclaimer')}</p>
          </div>
        </div>
      </section>

      {/* ── Navy instruction band: consultation + guidance ── */}
      <section
        className="bg-primary-500 text-white dark:bg-primary-700"
        aria-labelledby="home-consultation-title"
      >
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-2 lg:gap-0">
          <div className="lg:pr-10">
            <div className="relative border border-white/20">
              <Image
                src="/images/home-doctor-visit.jpg"
                alt={t('visitor.home.consult.imageAlt')}
                width={800}
                height={533}
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="h-auto w-full object-cover"
              />
            </div>
            <h2
              id="home-consultation-title"
              className="mt-6 font-display text-2xl font-bold sm:text-3xl lg:text-4xl"
            >
              {t('visitor.home.consult.title')}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85 sm:text-base">
              {t('visitor.home.consult.description')}
            </p>
            <Link
              href="/medecins"
              className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 bg-mint-500 px-5 text-sm font-bold text-primary-900 transition hover:bg-mint-400"
            >
              {t('visitor.home.consult.cta')}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          <div className="border-t-2 border-white/20 pt-8 lg:border-l-2 lg:border-t-0 lg:pl-10 lg:pt-0">
            <h2 className="font-display text-2xl font-bold sm:text-3xl lg:text-4xl">
              {t('visitor.home.guided.title')}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85 sm:text-base">
              {t('visitor.home.guided.description')}
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/premiers-soins"
                className="inline-flex min-h-11 items-center justify-center gap-2 border-2 border-white bg-transparent px-5 text-sm font-bold text-white transition hover:bg-white hover:text-primary-500"
              >
                {t('visitor.home.guided.firstAidCta')}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/centres"
                className="inline-flex min-h-11 items-center justify-center gap-2 bg-mint-500 px-5 text-sm font-bold text-primary-900 transition hover:bg-mint-400"
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
