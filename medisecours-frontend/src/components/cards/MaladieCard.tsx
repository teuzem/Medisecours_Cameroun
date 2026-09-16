'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, ShieldCheck, AlertTriangle, Activity } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const SEVERITY_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  'CRITIQUE':  { label: 'CRITIQUE',  color: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-100' },
  'SÉVÈRE':    { label: 'SÉVÈRE',    color: 'text-orange-600', bg: 'bg-orange-50',  border: 'border-orange-100' },
  'MODÉRÉE':   { label: 'MODÉRÉE',   color: 'text-amber-600',  bg: 'bg-amber-50',   border: 'border-amber-100' },
  'LÉGÈRE':    { label: 'LÉGÈRE',    color: 'text-emerald-600',bg: 'bg-emerald-50', border: 'border-emerald-100' },
  'VARIABLE':  { label: 'VARIABLE',  color: 'text-blue-600',   bg: 'bg-blue-50',    border: 'border-blue-100' },
  'DEFAULT':   { label: '—',         color: 'text-slate-500',  bg: 'bg-slate-50',   border: 'border-slate-100' },
}

const PLACEHOLDER_IMG = '/images/placeholder-maladie.svg'

interface MaladieCardProps {
  maladie: any
}

export default function MaladieCard({ maladie }: MaladieCardProps) {
  const { t } = useTranslation()
  const severityKey = maladie.niveauGravite?.toUpperCase() || 'DEFAULT'
  const severity = SEVERITY_CONFIG[severityKey] || SEVERITY_CONFIG['DEFAULT']

  const imgSrc = maladie.imageUrl || maladie.photo || PLACEHOLDER_IMG
  const categorieName = maladie.categorie?.nom || t('visitor.components.maladieCard.categoryFallback')
  const isUrgent = maladie.urgence === true
  const isContagieux = maladie.contagieux === true

  return (
    <Link
      href={`/maladies/${maladie.id}`}
      className="group flex flex-col bg-white dark:bg-[#162032] rounded-3xl overflow-hidden shadow-sm border border-gray-100 dark:border-white/[0.06] hover:shadow-[0_20px_50px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_20px_50px_rgba(0,0,0,0.3)] hover:-translate-y-1 transition-all duration-300 cursor-pointer"
    >
      {/* ─── Zone image ─── */}
      <div className="relative h-56 w-full overflow-hidden bg-gray-100 dark:bg-slate-800">
        <Image
          src={imgSrc}
          alt={maladie.nom}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          unoptimized
        />

        {/* Badge « Guide disponible » */}
        <div className="absolute top-3 left-3">
          <span className="inline-flex items-center gap-1.5 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm text-gray-700 dark:text-slate-300 text-xs font-semibold px-3 py-1.5 rounded-full shadow-sm">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
            {t('visitor.components.maladieCard.guideAvailable')}
          </span>
        </div>

        {/* Badge urgence (optionnel) */}
        {isUrgent && (
          <div className="absolute top-3 right-3">
            <span className="inline-flex items-center gap-1 bg-red-500 text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shadow-sm">
              <AlertTriangle className="w-3 h-3" />
              {t('visitor.components.maladieCard.urgent')}
            </span>
          </div>
        )}
      </div>

      {/* ─── Corps de la carte ─── */}
      <div className="flex flex-col flex-1 p-5">
        {/* Catégorie */}
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-1">
          <span className="mr-1">📍</span>
          {categorieName}
        </p>

        {/* Titre */}
        <h3 className="font-bold text-lg text-gray-800 dark:text-white leading-snug mb-3 group-hover:text-[#143d2c] dark:group-hover:text-mint-400 transition-colors">
          {maladie.nom}
        </h3>

        {/* Mini-grille de spécifications (3 colonnes) */}
        <div className="grid grid-cols-3 gap-2 mb-4 py-3 border-t border-b border-gray-100 dark:border-white/[0.06]">
          <div className="flex items-center gap-1.5 text-gray-500 dark:text-slate-400">
            <Activity className="w-3.5 h-3.5 shrink-0" />
            <span className="text-xs font-medium truncate">{severity.label}</span>
          </div>
          <div className="flex items-center gap-1.5 text-gray-500 dark:text-slate-400">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span className="text-xs font-medium">{isUrgent ? t('visitor.components.maladieCard.emergency') : t('visitor.components.maladieCard.notUrgent')}</span>
          </div>
          <div className="flex items-center gap-1.5 text-gray-500 dark:text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span className="text-xs font-medium">{isContagieux ? t('visitor.components.maladieCard.contagious') : t('visitor.components.maladieCard.notContagious')}</span>
          </div>
        </div>

        {/* Footer : gravité + bouton */}
        <div className="flex items-center justify-between mt-auto">
          <span className={`text-sm font-extrabold ${severity.color}`}>
            {severity.label}
          </span>

          <span className="inline-flex items-center gap-1.5 bg-[#143d2c] dark:bg-mint-500 text-white dark:text-slate-900 px-4 py-2.5 rounded-xl font-bold text-sm group-hover:bg-[#1a5038] dark:group-hover:bg-mint-400 transition-colors">
            {t('visitor.components.maladieCard.viewGuide')}
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </span>
        </div>
      </div>
    </Link>
  )
}
