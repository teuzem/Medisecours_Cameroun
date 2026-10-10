'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, BadgeCheck, HeartHandshake, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'

type AuthLayoutProps = {
  title: string
  description: string
  children: React.ReactNode
}

export default function AuthLayout({ title, description, children }: AuthLayoutProps) {
  const { t } = useTranslation()
  const assurances = [
    { icon: ShieldCheck, label: t('visitor.authLayout.assuranceData') },
    { icon: BadgeCheck, label: t('visitor.authLayout.assuranceDoctors') },
    { icon: HeartHandshake, label: t('visitor.authLayout.assuranceAssistance') },
  ]
  return (
    <div className="flex min-h-dvh items-center justify-center bg-sable px-3 py-3 text-primary-600 sm:px-6 sm:py-6 dark:bg-primary-900 dark:text-primary-100">
      <section className="grid w-full max-w-[1180px] overflow-hidden border border-primary-500/20 bg-white shadow-[0_28px_90px_rgba(30,58,95,0.18)] lg:min-h-[720px] lg:grid-cols-[0.86fr_1.14fr] dark:border-white/10 dark:bg-primary-800 dark:shadow-[0_28px_90px_rgba(0,0,0,0.48)]">
        <aside className="relative isolate flex min-h-[210px] flex-col overflow-hidden bg-primary-500 p-5 text-white sm:min-h-[250px] sm:p-8 lg:min-h-full lg:justify-between lg:p-10 dark:bg-primary-700">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-xs font-semibold text-white/85 transition-colors hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              {t('visitor.authLayout.backToSite')}
            </Link>
            <span className="border border-white/40 px-3 py-1 text-[11px] font-semibold">
              MediSecours+
            </span>
          </div>

          <div className="mx-auto flex max-w-sm flex-1 flex-col items-center justify-center py-5 text-center lg:py-10">
            <div className="mb-4 flex h-[76px] w-[218px] items-center justify-center overflow-hidden bg-white p-2 shadow-[0_12px_35px_rgba(0,0,0,0.18)] sm:h-[84px] sm:w-[238px]">
              <Image
                src="/brand/medisecours-logo.png"
                alt="MediSecours"
                width={853}
                height={299}
                priority
                className="h-auto w-[210px] object-contain sm:w-[230px]"
              />
            </div>
            <h2 className="mt-2 font-display text-2xl font-extrabold leading-tight sm:text-3xl lg:text-4xl">
              {t('visitor.authLayout.headline')}
            </h2>
            <p className="mt-4 hidden text-sm leading-6 text-mint-50/85 sm:block">
              {t('visitor.authLayout.subtitle')}
            </p>
          </div>

          <div className="hidden grid-cols-1 gap-2 lg:grid">
            {assurances.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3 border-t border-white/25 py-3 text-sm text-white/90">
                <Icon className="h-4 w-4 shrink-0 text-mint-300" />
                <span>{label}</span>
              </div>
            ))}
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
