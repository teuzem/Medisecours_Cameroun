'use client'

import Link from 'next/link'
import {
  ArrowRight,
  Bell,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  HeartPulse,
  MailCheck,
  MapPin,
  MessageCircle,
  Search,
  ShieldAlert,
  Stethoscope,
  UserCheck,
  UserRound,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

const visitorSteps = [
  {
    icon: HeartPulse,
    titleKey: 'visitor.guide.v1.title',
    descriptionKey: 'visitor.guide.v1.desc',
    links: [{ href: '/premiers-soins', labelKey: 'visitor.guide.v1.link' }],
  },
  {
    icon: Search,
    titleKey: 'visitor.guide.v2.title',
    descriptionKey: 'visitor.guide.v2.desc',
    links: [{ href: '/maladies', labelKey: 'visitor.guide.v2.link' }],
  },
  {
    icon: MapPin,
    titleKey: 'visitor.guide.v3.title',
    descriptionKey: 'visitor.guide.v3.desc',
    links: [{ href: '/centres', labelKey: 'visitor.guide.v3.link' }],
  },
  {
    icon: Stethoscope,
    titleKey: 'visitor.guide.v4.title',
    descriptionKey: 'visitor.guide.v4.desc',
    links: [{ href: '/medecins', labelKey: 'visitor.guide.v4.link' }],
  },
]

const patientSteps = [
  {
    icon: UserRound,
    titleKey: 'visitor.guide.p1.title',
    descriptionKey: 'visitor.guide.p1.desc',
    links: [{ href: '/register', labelKey: 'visitor.guide.p1.link' }],
  },
  {
    icon: MailCheck,
    titleKey: 'visitor.guide.p2.title',
    descriptionKey: 'visitor.guide.p2.desc',
  },
  {
    icon: CalendarClock,
    titleKey: 'visitor.guide.p3.title',
    descriptionKey: 'visitor.guide.p3.desc',
    links: [
      { href: '/medecins', labelKey: 'visitor.guide.p3.link1' },
      { href: '/patient/consultations', labelKey: 'visitor.guide.p3.link2' },
    ],
  },
  {
    icon: MessageCircle,
    titleKey: 'visitor.guide.p4.title',
    descriptionKey: 'visitor.guide.p4.desc',
    links: [{ href: '/messages', labelKey: 'visitor.guide.p4.link' }],
  },
  {
    icon: Bell,
    titleKey: 'visitor.guide.p5.title',
    descriptionKey: 'visitor.guide.p5.desc',
    links: [{ href: '/notifications', labelKey: 'visitor.guide.p5.link' }],
  },
  {
    icon: ShieldAlert,
    titleKey: 'visitor.guide.p6.title',
    descriptionKey: 'visitor.guide.p6.desc',
    links: [{ href: '/profil', labelKey: 'visitor.guide.p6.link' }],
  },
]

const doctorSteps = [
  {
    icon: FileCheck2,
    titleKey: 'visitor.guide.d1.title',
    descriptionKey: 'visitor.guide.d1.desc',
    detailKeys: [
      'visitor.guide.d1.detail1',
      'visitor.guide.d1.detail2',
      'visitor.guide.d1.detail3',
    ],
    links: [{ href: '/register', labelKey: 'visitor.guide.d1.link' }],
  },
  {
    icon: UserCheck,
    titleKey: 'visitor.guide.d2.title',
    descriptionKey: 'visitor.guide.d2.desc',
  },
  {
    icon: CalendarClock,
    titleKey: 'visitor.guide.d3.title',
    descriptionKey: 'visitor.guide.d3.desc',
    links: [{ href: '/medecin/consultations', labelKey: 'visitor.guide.d3.link' }],
  },
  {
    icon: MessageCircle,
    titleKey: 'visitor.guide.d4.title',
    descriptionKey: 'visitor.guide.d4.desc',
    links: [{ href: '/medecin/messages', labelKey: 'visitor.guide.d4.link' }],
  },
  {
    icon: ClipboardList,
    titleKey: 'visitor.guide.d5.title',
    descriptionKey: 'visitor.guide.d5.desc',
    links: [
      { href: '/medecin/rapports', labelKey: 'visitor.guide.d5.link1' },
      { href: '/medecin/patients', labelKey: 'visitor.guide.d5.link2' },
    ],
  },
]

const faq = [
  {
    questionKey: 'visitor.guide.faq1.q',
    answerKey: 'visitor.guide.faq1.a',
  },
  {
    questionKey: 'visitor.guide.faq2.q',
    answerKey: 'visitor.guide.faq2.a',
  },
  {
    questionKey: 'visitor.guide.faq3.q',
    answerKey: 'visitor.guide.faq3.a',
  },
  {
    questionKey: 'visitor.guide.faq4.q',
    answerKey: 'visitor.guide.faq4.a',
  },
  {
    questionKey: 'visitor.guide.faq5.q',
    answerKey: 'visitor.guide.faq5.a',
  },
  {
    questionKey: 'visitor.guide.faq6.q',
    answerKey: 'visitor.guide.faq6.a',
  },
]

const navigation = [
  { href: '#visiteur', labelKey: 'visitor.guide.navVisitor' },
  { href: '#patient', labelKey: 'visitor.guide.navPatient' },
  { href: '#medecin', labelKey: 'visitor.guide.navMedecin' },
  { href: '#questions', labelKey: 'visitor.guide.navFaq' },
]

export default function GuideUtilisationPage() {
  const { t } = useTranslation()
  return (
    <main className="bg-white dark:bg-slate-950">
      <section className="border-b border-slate-200 bg-slate-950 py-16 text-white dark:border-white/10 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-300">
            {t('visitor.guide.eyebrow')}
          </p>
          <h1 className="mt-3 max-w-4xl font-display text-4xl font-bold leading-tight sm:text-5xl">
            {t('visitor.guide.title')}
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300 sm:text-lg">
            {t('visitor.guide.description')}
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

      <section className="border-b border-red-200 bg-red-50 py-5 dark:border-red-500/20 dark:bg-red-500/10">
        <div className="mx-auto flex max-w-6xl items-start gap-3 px-4 sm:px-6">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-300" />
          <div>
            <p className="text-sm font-bold text-red-950 dark:text-red-100">
              {t('visitor.guide.dangerTitle')}
            </p>
            <p className="mt-1 text-sm leading-6 text-red-800 dark:text-red-200">
              {t('visitor.guide.dangerDesc')}
            </p>
          </div>
        </div>
      </section>

      <GuideSection
        id="visiteur"
        kicker={t('visitor.guide.visitorKicker')}
        title={t('visitor.guide.visitorTitle')}
        description={t('visitor.guide.visitorDesc')}
        steps={visitorSteps}
        color="blue"
      />

      <GuideSection
        id="patient"
        kicker={t('visitor.guide.patientKicker')}
        title={t('visitor.guide.patientTitle')}
        description={t('visitor.guide.patientDesc')}
        steps={patientSteps}
        color="violet"
        alternate
      />

      <GuideSection
        id="medecin"
        kicker={t('visitor.guide.medecinKicker')}
        title={t('visitor.guide.medecinTitle')}
        description={t('visitor.guide.medecinDesc')}
        steps={doctorSteps}
        color="emerald"
      />

      <section id="questions" className="scroll-mt-24 border-t border-slate-200 bg-slate-50 py-12 dark:border-white/10 dark:bg-slate-900 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-700 dark:text-violet-300">
            {t('visitor.guide.faqEyebrow')}
          </p>
          <h2 className="mt-2 font-display text-3xl font-bold text-slate-950 dark:text-white">
            {t('visitor.guide.faqTitle')}
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
              <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-violet-600 dark:text-violet-300" />
              <div>
                <p className="text-sm font-bold text-slate-950 dark:text-white">
                  {t('visitor.guide.endTitle')}
                </p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {t('visitor.guide.endDesc')}
                </p>
              </div>
            </div>
            <Link
              href="/"
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 bg-slate-950 px-5 text-sm font-bold text-white transition hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              {t('visitor.guide.backHome')}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}

function GuideSection({
  id,
  kicker,
  title,
  description,
  steps,
  color,
  alternate = false,
}: {
  id: string
  kicker: string
  title: string
  description: string
  steps: Array<{
    icon: React.ComponentType<{ className?: string }>
    titleKey: string
    descriptionKey: string
    detailKeys?: string[]
    links?: Array<{ href: string; labelKey: string }>
  }>
  color: 'blue' | 'violet' | 'emerald'
  alternate?: boolean
}) {
  const { t } = useTranslation()
  const tones = {
    blue: 'text-blue-700 dark:text-blue-300',
    violet: 'text-violet-700 dark:text-violet-300',
    emerald: 'text-emerald-700 dark:text-emerald-300',
  }
  const iconTones = {
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
    violet: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
    emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  }

  return (
    <section
      id={id}
      className={`scroll-mt-24 py-12 sm:py-16 ${
        alternate ? 'border-y border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-slate-900' : ''
      }`}
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[0.7fr_1.3fr]">
          <div>
            <p className={`text-xs font-bold uppercase tracking-[0.16em] ${tones[color]}`}>{kicker}</p>
            <h2 className="mt-2 font-display text-3xl font-bold text-slate-950 dark:text-white">{title}</h2>
            <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">{description}</p>
          </div>

          <ol className="divide-y divide-slate-200 border-y border-slate-200 dark:divide-white/10 dark:border-white/10">
            {steps.map((step, index) => {
              const Icon = step.icon
              return (
                <li key={step.titleKey} className="grid gap-4 py-6 sm:grid-cols-[52px_minmax(0,1fr)]">
                  <span className={`flex h-11 w-11 items-center justify-center rounded-lg ${iconTones[color]}`}>
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
                        {step.detailKeys.map((detailKey) => (
                          <li key={detailKey} className="flex items-start gap-2 text-xs leading-5 text-slate-600 dark:text-slate-300">
                            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                            {t(detailKey)}
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
                            className={`inline-flex items-center gap-1.5 text-xs font-bold ${tones[color]} hover:opacity-75`}
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
      </div>
    </section>
  )
}
