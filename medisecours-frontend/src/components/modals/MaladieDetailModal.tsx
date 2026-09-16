'use client'

import { useEffect, useCallback } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import {
  X, AlertTriangle, ShieldCheck, Activity,
  Stethoscope, Pill, Siren, FileText, Bug
} from 'lucide-react'

/* ─── Configuration des niveaux de gravité ─── */
const SEVERITY_CONFIG: Record<string, { label: string; color: string; bg: string; text: string }> = {
  'CRITIQUE':  { label: 'CRITIQUE',  color: 'bg-red-500',    bg: 'bg-red-50',    text: 'text-red-700' },
  'SÉVÈRE':    { label: 'SÉVÈRE',    color: 'bg-orange-500', bg: 'bg-orange-50',  text: 'text-orange-700' },
  'MODÉRÉE':   { label: 'MODÉRÉE',   color: 'bg-amber-500',  bg: 'bg-amber-50',   text: 'text-amber-700' },
  'LÉGÈRE':    { label: 'LÉGÈRE',    color: 'bg-emerald-500',bg: 'bg-emerald-50', text: 'text-emerald-700' },
  'VARIABLE':  { label: 'VARIABLE',  color: 'bg-blue-500',   bg: 'bg-blue-50',    text: 'text-blue-700' },
  'DEFAULT':   { label: '—',         color: 'bg-slate-400',  bg: 'bg-slate-50',   text: 'text-slate-600' },
}

const PLACEHOLDER_IMG = '/images/placeholder-maladie.svg'

interface MaladieDetailModalProps {
  maladie: any | null
  onClose: () => void
}

export default function MaladieDetailModal({ maladie, onClose }: MaladieDetailModalProps) {
  const { t, i18n } = useTranslation()

  /* ─── Fermeture via la touche Escape ─── */
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    if (!maladie) return
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden' // Empêche le scroll du body
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [maladie, handleKeyDown])

  if (!maladie) return null

  /* ─── Données de la maladie ─── */
  const severityKey = maladie.niveauGravite?.toUpperCase() || 'DEFAULT'
  const severity = SEVERITY_CONFIG[severityKey] || SEVERITY_CONFIG['DEFAULT']
  const imgSrc = maladie.imageUrl || maladie.photo || PLACEHOLDER_IMG
  const categorieName = maladie.categorie?.nom || t('visitor.components.maladieDetail.categoryFallback')
  const isUrgent = maladie.urgence === true
  const isContagieux = maladie.contagieux === true

  /* ─── Premiers soins (array renvoyé par l'API) ─── */
  const premiersSoins: any[] = maladie.premiersSoins ?? []

  /* ─── Formatage de la date d'ajout ─── */
  const dateLocale = i18n.language.startsWith('en') ? 'en-GB' : 'fr-FR'
  const dateAjout = maladie.createdAt
    ? new Date(maladie.createdAt).toLocaleDateString(dateLocale, { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  return (
    <AnimatePresence>
      {/* ═══ Overlay avec blur ═══ */}
      <motion.div
        key="detail-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md"
        onClick={onClose}
      >
        {/* ═══ Panneau principal ═══ */}
        <motion.div
          key="detail-panel"
          initial={{ opacity: 0, scale: 0.92, y: 40 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 40 }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          onClick={(e) => e.stopPropagation()}
          className="relative bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
        >
          {/* ─── Bouton fermer (✕) ─── */}
          <button
            onClick={onClose}
            aria-label={t('visitor.components.maladieDetail.close')}
            className="absolute top-4 right-4 z-10 w-9 h-9 flex items-center justify-center rounded-full bg-black/30 backdrop-blur-sm text-white hover:bg-black/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* ═══ Zone image (Autorité visuelle) ═══ */}
          <div className="relative w-full h-64 sm:h-72 shrink-0 overflow-hidden bg-gray-100">
            <Image
              src={imgSrc}
              alt={maladie.nom}
              fill
              sizes="(max-width: 768px) 100vw, 768px"
              className="object-cover"
              unoptimized
            />

            {/* Dégradé en bas de l'image pour lisibilité */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

            {/* Badge de gravité en position absolue */}
            <div className="absolute bottom-4 left-5">
              <span className={`inline-flex items-center gap-1.5 ${severity.color} text-white text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full shadow-lg`}>
                <Activity className="w-3.5 h-3.5" />
                {severity.label}
              </span>
            </div>

            {/* Badge urgence */}
            {isUrgent && (
              <div className="absolute bottom-4 right-5">
                <span className="inline-flex items-center gap-1 bg-red-500 text-white text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full shadow-lg animate-pulse">
                  <Siren className="w-3.5 h-3.5" />
                  {t('visitor.components.maladieDetail.urgentCare')}
                </span>
              </div>
            )}
          </div>

          {/* ═══ Zone de contenu clinique (scrollable) ═══ */}
          <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">

            {/* ─── En-tête : Titre, catégorie, date ─── */}
            <div>
              <p className="text-sm text-gray-500 mb-1">
                <span className="mr-1">📍</span>{categorieName}
                {dateAjout && <span className="ml-3 text-gray-400">· {t('visitor.components.maladieDetail.addedOn', { date: dateAjout })}</span>}
              </p>
              <h2 className="text-2xl font-extrabold text-slate-800 leading-tight">
                {maladie.nom}
              </h2>
            </div>

            {/* ─── Badges informatifs rapides ─── */}
            <div className="flex flex-wrap gap-2">
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${severity.bg} ${severity.text} border ${severity.bg.replace('bg-', 'border-')}`}>
                <Activity className="w-3.5 h-3.5" />
                {t('visitor.components.maladieDetail.severity', { label: severity.label })}
              </span>
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${isContagieux ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'} border`}>
                <Bug className="w-3.5 h-3.5" />
                {isContagieux ? t('visitor.components.maladieCard.contagious') : t('visitor.components.maladieDetail.notContagious')}
              </span>
              {isUrgent && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-red-50 text-red-700 border border-red-100">
                  <Siren className="w-3.5 h-3.5" />
                  {t('visitor.components.maladieDetail.urgentCare')}
                </span>
              )}
            </div>

            {/* ─── Description générale ─── */}
            {maladie.description && (
              <div>
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-700 uppercase tracking-wide mb-2">
                  <FileText className="w-4 h-4 text-slate-400" />
                  {t('visitor.components.maladieDetail.description')}
                </h3>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-line">
                    {maladie.description}
                  </p>
                </div>
              </div>
            )}

            {/* ─── Section 1 : Symptômes associés ─── */}
            {maladie.symptomes && (
              <div>
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-700 uppercase tracking-wide mb-2">
                  <Stethoscope className="w-4 h-4 text-slate-400" />
                  {t('visitor.components.maladieDetail.symptoms')}
                </h3>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <ul className="space-y-1.5">
                    {maladie.symptomes.split(',').map((s: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                        <span className="leading-relaxed">{s.trim()}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* ─── Section 2 : Causes ─── */}
            {maladie.causes && (
              <div>
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-700 uppercase tracking-wide mb-2">
                  <AlertTriangle className="w-4 h-4 text-slate-400" />
                  {t('visitor.components.maladieDetail.causes')}
                </h3>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-line">
                    {maladie.causes}
                  </p>
                </div>
              </div>
            )}

            {/* ─── Section 3 : Gestes de premiers secours ─── */}
            {premiersSoins.length > 0 && (
              <div>
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-700 uppercase tracking-wide mb-3">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  {t('visitor.components.maladieDetail.firstAid')}
                </h3>
                <div className="space-y-3">
                  {premiersSoins.map((ps: any, i: number) => (
                    <div key={ps.id ?? i} className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-100">
                      <div className="flex items-start justify-between gap-3 mb-1.5">
                        <h4 className="font-bold text-sm text-slate-800">
                          {i + 1}. {ps.titre}
                        </h4>
                        {ps.niveauUrgence && (
                          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white text-emerald-700 border border-emerald-200">
                            {ps.niveauUrgence}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                        {ps.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ─── Section 4 : Précautions ─── */}
            {maladie.precautions && (
              <div>
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-700 uppercase tracking-wide mb-2">
                  <ShieldCheck className="w-4 h-4 text-slate-400" />
                  {t('visitor.components.maladieDetail.precautions')}
                </h3>
                <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-100">
                  <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-line">
                    {maladie.precautions}
                  </p>
                </div>
              </div>
            )}

            {/* ─── Section 5 : Traitement ─── */}
            {maladie.traitement && (
              <div>
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-700 uppercase tracking-wide mb-2">
                  <Pill className="w-4 h-4 text-slate-400" />
                  {t('visitor.components.maladieDetail.treatment')}
                </h3>
                <div className="bg-blue-50/60 p-4 rounded-2xl border border-blue-100">
                  <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-line">
                    {maladie.traitement}
                  </p>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
