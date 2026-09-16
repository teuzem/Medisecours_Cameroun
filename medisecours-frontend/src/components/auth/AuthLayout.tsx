'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, BadgeCheck, HeartHandshake, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'

type AuthLayoutProps = {
  eyebrow: string
  title: string
  description: string
  children: React.ReactNode
}

export default function AuthLayout({ eyebrow, title, description, children }: AuthLayoutProps) {
  const { t } = useTranslation()
  const assurances = [
    { icon: ShieldCheck, label: t('visitor.authLayout.assuranceData') },
    { icon: BadgeCheck, label: t('visitor.authLayout.assuranceDoctors') },
    { icon: HeartHandshake, label: t('visitor.authLayout.assuranceAssistance') },
  ]
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#edf6fb] px-3 py-3 text-slate-900 sm:px-6 sm:py-6 dark:bg-[#081525]">
      <section className="grid w-full max-w-[1180px] overflow-hidden rounded-lg border border-white/80 bg-white shadow-[0_28px_90px_rgba(30,58,95,0.18)] lg:min-h-[720px] lg:grid-cols-[0.86fr_1.14fr] dark:border-white/10 dark:bg-slate-950 dark:shadow-[0_28px_90px_rgba(0,0,0,0.48)]">
        <aside
          className="relative isolate flex min-h-[210px] flex-col overflow-hidden bg-[#075fba] p-5 text-white sm:min-h-[250px] sm:p-8 lg:min-h-full lg:justify-between lg:p-10"
          style={{
            backgroundImage:
              "linear-gradient(145deg, rgba(7,83,166,0.94), rgba(0,126,214,0.88)), url('/images/hero_cpr_bg.jpg')",
            backgroundPosition: 'center',
            backgroundSize: 'cover',
          }}
        >
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),transparent_38%,rgba(3,50,107,0.34))]" />

          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-xs font-semibold text-white/85 transition-colors hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              {t('visitor.authLayout.backToSite')}
            </Link>
            <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] font-semibold backdrop-blur-md">
              MediSecours+
            </span>
          </div>

          <div className="mx-auto flex max-w-sm flex-1 flex-col items-center justify-center py-5 text-center lg:py-10">
            <div className="mb-4 flex h-[76px] w-[218px] items-center justify-center overflow-hidden rounded-lg bg-white/95 shadow-[0_12px_35px_rgba(0,0,0,0.18)] sm:h-[84px] sm:w-[238px]">
              <Image
                src="/brand/medisecours-logo.png"
                alt="MediSecours"
                width={853}
                height={299}
                priority
                className="h-auto w-[210px] object-contain sm:w-[230px]"
              />
            </div>
            <p className="text-sm font-semibold text-cyan-50">{eyebrow}</p>
            <h2 className="mt-2 font-display text-2xl font-extrabold leading-tight sm:text-3xl lg:text-4xl">
              {t('visitor.authLayout.headline')}
            </h2>
            <p className="mt-4 hidden text-sm leading-6 text-blue-50/85 sm:block">
              {t('visitor.authLayout.subtitle')}
            </p>
          </div>

          <div className="hidden grid-cols-1 gap-2 lg:grid">
            {assurances.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3 border-t border-white/15 py-3 text-sm text-white/90">
                <Icon className="h-4 w-4 shrink-0 text-cyan-200" />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </aside>

        <div className="flex min-w-0 items-center bg-white px-5 py-8 sm:px-10 sm:py-10 lg:px-14 xl:px-16 dark:bg-slate-950">
          <div className="mx-auto w-full max-w-[540px]">
            <div className="mb-7">
              <p className="mb-2 text-xs font-bold uppercase text-blue-600 dark:text-blue-400">{eyebrow}</p>
              <h1 className="font-display text-2xl font-extrabold text-slate-950 sm:text-3xl dark:text-white">
                {title}
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>
            </div>
            {children}
          </div>
        </div>
      </section>
    </div>
  )
}
