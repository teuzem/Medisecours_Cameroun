'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, BadgeCheck, HeartHandshake, MapPin, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'

type AuthLayoutProps = {
  title: string
  description: string
  children: React.ReactNode
  /** Panneau photo : urgences Laquintinie (connexion) ou HG Yaoundé (inscription). */
  variant?: 'login' | 'register'
}

const VISUALS = {
  login: {
    src: '/images/landing/soins-infirmiere.jpg',
    altKey: 'visitor.authLayout.photoLoginCaption',
    creditKey: 'visitor.authLayout.photoLoginCredit',
  },
  register: {
    src: '/images/landing/terrain-yaounde.jpg',
    altKey: 'visitor.authLayout.photoRegisterCaption',
    creditKey: 'visitor.authLayout.photoRegisterCredit',
  },
} as const

export default function AuthLayout({ title, description, children, variant = 'login' }: AuthLayoutProps) {
  const { t } = useTranslation()
  const visual = VISUALS[variant]
  const assurances = [
    { icon: ShieldCheck, label: t('visitor.authLayout.assuranceData') },
    { icon: BadgeCheck, label: t('visitor.authLayout.assuranceDoctors') },
    { icon: HeartHandshake, label: t('visitor.authLayout.assuranceAssistance') },
  ]
  return (
    <div className="flex min-h-dvh items-center justify-center bg-sable px-3 py-3 text-primary-600 sm:px-6 sm:py-6 dark:bg-primary-900 dark:text-primary-100">
      <section className="grid w-full max-w-[1180px] overflow-hidden border border-primary-500/20 bg-white shadow-[0_28px_90px_rgba(30,58,95,0.18)] lg:min-h-[720px] lg:grid-cols-[0.86fr_1.14fr] dark:border-white/10 dark:bg-primary-800 dark:shadow-[0_28px_90px_rgba(0,0,0,0.48)]">
        <aside className="relative isolate flex min-h-[240px] flex-col overflow-hidden bg-primary-500 text-white sm:min-h-[280px] lg:min-h-full lg:justify-between dark:bg-primary-700">
          <Image
            src={visual.src}
            alt={t(visual.altKey)}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 44vw"
            className="absolute inset-0 -z-10 h-full w-full object-cover"
          />
          {/* Voile navy de la charte : lisibilité du texte, jamais de violet IA. */}
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-b from-[#0d2340]/85 via-[#1e3a5f]/55 to-[#0d2340]/90" />

          <div className="relative flex items-center justify-between p-5 sm:p-8 lg:p-10 lg:pb-0">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-xs font-semibold text-white/85 transition-colors hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              {t('visitor.authLayout.backToSite')}
            </Link>
            <span className="border border-white/40 bg-black/20 px-3 py-1 text-[11px] font-semibold backdrop-blur-sm">
              MediSecours+
            </span>
          </div>

          <div className="relative mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center px-5 py-5 text-center sm:px-8 lg:py-10">
            <div className="mb-4 flex h-[76px] w-[218px] items-center justify-center overflow-hidden bg-white p-2 shadow-[0_12px_35px_rgba(0,0,0,0.35)] sm:h-[84px] sm:w-[238px]">
              <Image
                src="/brand/medisecours-logo.png"
                alt="MediSecours"
                width={853}
                height={299}
                priority
                className="h-auto w-[210px] object-contain sm:w-[230px]"
              />
            </div>
            <h2 className="mt-2 font-display text-2xl font-extrabold leading-tight text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.45)] sm:text-3xl lg:text-4xl">
              {t('visitor.authLayout.headline')}
            </h2>
            <p className="mt-4 hidden text-sm leading-6 text-white/85 sm:block">
              {t('visitor.authLayout.subtitle')}
            </p>
          </div>

          <div className="relative px-5 pb-5 sm:px-8 sm:pb-8 lg:px-10 lg:pb-10">
            <p className="mb-3 flex items-center gap-1.5 text-[11px] font-medium text-white/70">
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">
                {t(visual.altKey)} · {t(visual.creditKey)}
              </span>
            </p>
            <div className="hidden grid-cols-1 gap-2 lg:grid">
              {assurances.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-3 border-t border-white/25 py-3 text-sm text-white/90">
                  <Icon className="h-4 w-4 shrink-0 text-mint-300" />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 items-center bg-white px-5 py-8 sm:px-10 sm:py-10 lg:px-14 xl:px-16 dark:bg-primary-800">
          <div className="mx-auto w-full max-w-[540px]">
            <div className="mb-7">
              <h1 className="font-display text-2xl font-extrabold text-primary-500 sm:text-3xl dark:text-white">
                {title}
              </h1>
              <p className="mt-2 text-sm leading-6 text-primary-400 dark:text-primary-200">{description}</p>
            </div>
            {children}
          </div>
        </div>
      </section>
    </div>
  )
}
