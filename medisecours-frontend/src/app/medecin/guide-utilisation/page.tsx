'use client'

import Link from 'next/link'
import {
  ArrowRight,
  Bell,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileEdit,
  FileText,
  HeartPulse,
  HelpCircle,
  MapPin,
  MessageCircle,
  Pill,
  ShieldAlert,
  Stethoscope,
  UserCheck,
  Users,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

const steps = [
  {
    icon: Stethoscope,
    titleKey: 'medecin.guide.s1.title',
    descriptionKey: 'medecin.guide.s1.desc',
    detailKeys: [
      'medecin.guide.s1.d1',
      'medecin.guide.s1.d2',
      'medecin.guide.s1.d3',
    ],
    links: [{ href: '/medecin', labelKey: 'medecin.guide.s1.link' }],
  },
  {
    icon: ClipboardList,
    titleKey: 'medecin.guide.s2.title',
    descriptionKey: 'medecin.guide.s2.desc',
    detailKeys: [
      'medecin.guide.s2.d1',
      'medecin.guide.s2.d2',
      'medecin.guide.s2.d3',
    ],
    links: [{ href: '/medecin/consultations', labelKey: 'medecin.guide.s2.link' }],
  },
  {
    icon: FileEdit,
    titleKey: 'medecin.guide.s3.title',
    descriptionKey: 'medecin.guide.s3.desc',
    detailKeys: [
      'medecin.guide.s3.d1',
      'medecin.guide.s3.d2',
      'medecin.guide.s3.d3',
    ],
    links: [{ href: '/medecin/prescriptions', labelKey: 'medecin.guide.s3.link' }],
  },
  {
    icon: MessageCircle,
    titleKey: 'medecin.guide.s4.title',
    descriptionKey: 'medecin.guide.s4.desc',
    detailKeys: [
      'medecin.guide.s4.d1',
      'medecin.guide.s4.d2',
    ],
    links: [{ href: '/medecin/messages', labelKey: 'medecin.guide.s4.link' }],
  },
  {
    icon: Users,
    titleKey: 'medecin.guide.s5.title',
    descriptionKey: 'medecin.guide.s5.desc',
    detailKeys: [
      'medecin.guide.s5.d1',
      'medecin.guide.s5.d2',
    ],
    links: [{ href: '/medecin/patients', labelKey: 'medecin.guide.s5.link' }],
  },
  {
    icon: FileText,
    titleKey: 'medecin.guide.s6.title',
    descriptionKey: 'medecin.guide.s6.desc',
    detailKeys: [
      'medecin.guide.s6.d1',
      'medecin.guide.s6.d2',
    ],
    links: [{ href: '/medecin/rapports', labelKey: 'medecin.guide.s6.link' }],
  },
  {
    icon: Pill,
    titleKey: 'medecin.guide.s7.title',
    descriptionKey: 'medecin.guide.s7.desc',
    detailKeys: [
      'medecin.guide.s7.d1',
      'medecin.guide.s7.d2',
    ],
    links: [{ href: '/medecin/pharmacy', labelKey: 'medecin.guide.s7.link' }],
  },
]

const faq = [
  { questionKey: 'medecin.guide.faq1.q', answerKey: 'medecin.guide.faq1.a' },
  { questionKey: 'medecin.guide.faq2.q', answerKey: 'medecin.guide.faq2.a' },
  { questionKey: 'medecin.guide.faq3.q', answerKey: 'medecin.guide.faq3.a' },
  { questionKey: 'medecin.guide.faq4.q', answerKey: 'medecin.guide.faq4.a' },
  { questionKey: 'medecin.guide.faq5.q', answerKey: 'medecin.guide.faq5.a' },
  { questionKey: 'medecin.guide.faq6.q', answerKey: 'medecin.guide.faq6.a' },
]

const navigation = [
  { href: '#dashboard', labelKey: 'medecin.guide.navDashboard' },
  { href: '#consultations', labelKey: 'medecin.guide.navConsultations' },
  { href: '#prescriptions', labelKey: 'medecin.guide.navPrescriptions' },
  { href: '#faq', labelKey: 'medecin.guide.navFaq' },
]

export default function MedecinGuidePage() {
  const { t } = useTranslation()

  return (
    <main className="bg-white dark:bg-slate-950">
      {/* Hero */}
      <section className="border-b border-emerald-200 bg-emerald-950 py-16 text-white dark:border-white/10 dark:bg-slate-950 sm:py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-300">
            {t('medecin.guide.eyebrow')}
          </p>
          <h1 className="mt-3 font-display text-4xl font-bold leading-tight sm:text-5xl">
            {t('medecin.guide.title')}
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300 sm:text-lg">
            {t('medecin.guide.description')}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            {navigation.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="inline-flex min-h-11 items-center justify-center gap-2 border border-white/25 bg-white/10 px-5 text-sm font-bold text-white transition hover:bg-white/20"
              >
                {t(item.labelKey)}
                <ArrowRight className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Urgence */}
      <section className="border-b border-red-200 bg-red-50 py-5 dark:border-red-500/20 dark:bg-red-500/10">
        <div className="mx-auto flex max-w-4xl items-start gap-3 px-4 sm:px-6">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-300" />
          <div>
            <p className="text-sm font-bold text-red-950 dark:text-red-100">
              {t('medecin.guide.dangerTitle')}
            </p>
            <p className="mt-1 text-sm leading-6 text-red-800 dark:text-red-200">
              {t('medecin.guide.dangerDesc')}
            </p>
          </div>
        </div>
      </section>

      {/* Steps */}
      <section id="dashboard" className="scroll-mt-24 py-12 sm:py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
            {t('medecin.guide.sectionKicker')}
          </p>
          <h2 className="mt-2 font-display text-3xl font-bold text-slate-950 dark:text-white">
            {t('medecin.guide.sectionTitle')}
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-300">
            {t('medecin.guide.sectionDesc')}
          </p>

          <ol className="mt-8 divide-y divide-slate-200 border-y border-slate-200 dark:divide-white/10 dark:border-white/10">
            {steps.map((step, index) => {
              const Icon = step.icon
              return (
                <li key={step.titleKey} id={step.links?.[0]?.href.split('/').pop()} className="grid gap-4 py-6 sm:grid-cols-[52px_minmax(0,1fr)]">
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-[11px] font-bold uppercase text-slate-400">
                      {t('visitor.guide.stepPrefix', { number: index + 1 })}
                    </p>
                    <h3 className="mt-1 font-display text-lg font-bold text-slate-950 dark:text-white">
                      {t(step.titleKey)}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                      {t(step.descriptionKey)}
                    </p>
                    {step.detailKeys && (
                      <ul className="mt-3 space-y-2">
                        {step.detailKeys.map((dk) => (
                          <li key={dk} className="flex items-start gap-2 text-xs leading-5 text-slate-600 dark:text-slate-300">
                            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                            {t(dk)}
                          </li>
                        ))}
                      </ul>
                    )}
                    {step.links && (
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                        {step.links.map((link) => (
                          <Link
                            key={link.href}
                            href={link.href}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:opacity-75"
                          >
                            {t(link.labelKey)}
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-24 border-t border-slate-200 bg-slate-50 py-12 dark:border-white/10 dark:bg-slate-900 sm:py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
            {t('medecin.guide.faqEyebrow')}
          </p>
          <h2 className="mt-2 font-display text-3xl font-bold text-slate-950 dark:text-white">
            {t('medecin.guide.faqTitle')}
          </h2>
          <div className="mt-7 grid gap-x-10 border-y border-slate-200 dark:border-white/10 md:grid-cols-2">
            {faq.map((item) => (
              <article
                key={item.questionKey}
                className="border-b border-slate-200 py-5 last:border-b-0 dark:border-white/10 md:[&:nth-last-child(-n+2)]:border-b-0"
              >
                <h3 className="text-sm font-bold text-slate-950 dark:text-white">{t(item.questionKey)}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{t(item.answerKey)}</p>
              </article>
            ))}
          </div>

          <div className="mt-10 flex flex-col gap-4 border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-950 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300" />
              <div>
                <p className="text-sm font-bold text-slate-950 dark:text-white">
                  {t('medecin.guide.endTitle')}
                </p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {t('medecin.guide.endDesc')}
                </p>
              </div>
            </div>
            <Link
              href="/medecin"
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 bg-slate-950 px-5 text-sm font-bold text-white transition hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              {t('medecin.guide.backDashboard')}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
