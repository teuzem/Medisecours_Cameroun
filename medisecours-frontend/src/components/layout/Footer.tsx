'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, MapPin } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthContext } from '../../contexts/AuthContext'

export default function Footer({ compact = false }: { compact?: boolean }) {
  const { isAuthenticated } = useAuthContext()
  const { t } = useTranslation()

  if (compact) {
    return (
      <footer className="w-full border-t border-slate-200 bg-white pb-24 dark:border-white/10 dark:bg-slate-950 lg:pb-0">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-display text-base font-bold text-slate-950 dark:text-white">MediSecours</p>
            <p className="mt-1 max-w-xl text-xs leading-5 text-slate-500 dark:text-slate-400">
              {t('visitor.footer.tagline')}
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-slate-600 dark:text-slate-300" aria-label={t('visitor.footer.linksAria')}>
            <Link href="/premiers-soins" className="hover:text-emerald-600 dark:hover:text-emerald-300">{t('visitor.nav.firstAid')}</Link>
            <Link href="/centres" className="hover:text-emerald-600 dark:hover:text-emerald-300">{t('visitor.nav.centres')}</Link>
            <Link href="/medecins" className="hover:text-emerald-600 dark:hover:text-emerald-300">{t('visitor.nav.doctors')}</Link>
            <Link href="/guide-utilisation" className="hover:text-emerald-600 dark:hover:text-emerald-300">{t('visitor.footer.guide')}</Link>
            <Link href="/login" className="hover:text-emerald-600 dark:hover:text-emerald-300">{t('visitor.nav.login')}</Link>
          </nav>
        </div>
      </footer>
    )
  }

  return (
    <footer className="mt-10 w-full min-w-0 overflow-x-clip border-t border-slate-100 bg-white pb-20 dark:border-white/5 dark:bg-[#111827] lg:pb-0">
      <div className="mx-auto w-full min-w-0 max-w-7xl px-4 py-10 sm:px-6 sm:py-16 lg:py-20">
        
        {/* --- TOP SECTION: Main CTA --- */}
        <div className="mb-12 min-w-0 border-b border-slate-100 pb-12 text-center dark:border-slate-800 sm:mb-16 sm:pb-16">
          <h2 className="mb-5 min-w-0 break-words font-display text-2xl font-extrabold leading-tight text-slate-900 sm:mb-6 sm:text-4xl lg:text-5xl dark:text-white">
            {t('visitor.footer.ctaLine1')}
            <br />
            <span className="break-words bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">
              {t('visitor.footer.ctaLine2')}
            </span>
          </h2>

          <p className="mx-auto mb-8 max-w-2xl break-words text-sm leading-relaxed text-slate-500 sm:mb-10 sm:text-lg dark:text-slate-400">
            {t('visitor.footer.ctaDescription')}
          </p>

          <div className="flex min-w-0 flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:gap-4">
            <Link
              href={isAuthenticated ? '/patient/consultations' : '/register'}
              className="group inline-flex min-h-12 min-w-0 items-center justify-center gap-2.5 rounded-full bg-slate-900 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-slate-800 sm:px-8 sm:py-4 dark:bg-emerald-500 dark:hover:bg-emerald-600"
            >
              <span className="min-w-0 break-words">{isAuthenticated ? t('visitor.footer.openConsultation') : t('visitor.footer.createFreeAccount')}</span>
              <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1" />
            </Link>

            <Link
              href="/centres"
              className="group inline-flex min-h-12 min-w-0 items-center justify-center gap-2.5 rounded-full border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 sm:px-8 sm:py-4 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <MapPin className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span className="min-w-0 break-words">{t('visitor.footer.findCentre')}</span>
            </Link>
          </div>
        </div>

        {/* --- BOTTOM SECTION: Newsletter & Links --- */}
        <div className="mb-12 flex min-w-0 flex-col gap-10 sm:mb-16 sm:gap-12 xl:flex-row xl:gap-32">
           {/* Left Column: Logo + Newsletter */}
           <div className="w-full min-w-0 xl:w-[380px] xl:shrink-0">
             {/* Logo */}
             <Link
               href="/"
               className="mb-8 inline-flex h-[86px] w-[230px] items-center justify-center overflow-hidden rounded-xl dark:bg-white/90 dark:shadow-[0_8px_24px_rgba(0,0,0,0.18)]"
               aria-label={t('visitor.nav.homeAria')}
             >
               <Image
                 src="/brand/medisecours-logo.png"
                 alt="MediSecours"
                 width={853}
                 height={299}
                 className="h-auto w-[222px] max-w-full object-contain"
               />
             </Link>
             
             <p className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
               {t('visitor.footer.newsletterTitle')}
             </p>
             
             {/* Newsletter Input */}
             <form className="mb-5 grid min-w-0 gap-2 sm:relative sm:block">
               <input 
                 type="email" 
                 placeholder={t('visitor.footer.newsletterPlaceholder')} 
                   className="min-h-12 w-full min-w-0 rounded-full border border-slate-200 bg-slate-50 py-3.5 pl-5 pr-5 text-sm text-slate-900 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/50 sm:pr-[110px] dark:border-slate-700 dark:bg-slate-800/50 dark:text-white"
               />
               <button 
                 type="button" 
                   className="min-h-11 w-full rounded-full bg-slate-900 px-6 text-sm font-semibold text-white transition-colors hover:bg-slate-800 sm:absolute sm:bottom-1.5 sm:right-1.5 sm:top-1.5 sm:min-h-0 sm:w-auto dark:bg-emerald-500 dark:hover:bg-emerald-600"
               >
                 {t('visitor.footer.newsletterSubmit')}
               </button>
             </form>

             <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed pr-4">
               {t('visitor.footer.newsletterConsent')}
             </p>
           </div>

           {/* Right Columns: Links */}
            <div className="grid min-w-0 flex-1 grid-cols-1 gap-8 sm:grid-cols-2">
              {/* Col 1 */}
              <div>
                <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-6">{t('visitor.footer.servicesTitle')}</h4>
                <ul className="space-y-4 text-sm text-slate-500 dark:text-slate-400">
                  <li><Link href="/centres" className="hover:text-emerald-500 transition-colors">{t('visitor.footer.healthCentres')}</Link></li>
                </ul>
              </div>
              
              {/* Col 2 */}
              <div>
                <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-6">{t('visitor.footer.learnTitle')}</h4>
                <ul className="space-y-4 text-sm text-slate-500 dark:text-slate-400">
                  <li><Link href="/premiers-soins" className="hover:text-emerald-500 transition-colors">{t('visitor.footer.firstAidActs')}</Link></li>
                  <li><Link href="/categories" className="hover:text-emerald-500 transition-colors">{t('visitor.footer.medicalCategories')}</Link></li>
                  <li><Link href="/guide-utilisation" className="hover:text-emerald-500 transition-colors">{t('visitor.footer.guide')}</Link></li>
                </ul>
              </div>
           </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-slate-100 dark:border-white/10 text-center">
           <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
             © {new Date().getFullYear()} MediSecours+, {t('visitor.footer.rightsReserved')}
           </p>
        </div>

      </div>
    </footer>
  )
}
