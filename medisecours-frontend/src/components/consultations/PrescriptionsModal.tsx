'use client'

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { createPortal } from 'react-dom'
import {
  FileText, Pill, Clock, Eye, Search, X
} from 'lucide-react'
import useSWR from 'swr'
import { fetcher } from '../../lib/fetcher'
import { imgUrl } from '../../lib/config'
import Avatar from '../ui/Avatar'
import LoadingSpinner from '../ui/LoadingSpinner'
import EmptyState from '../ui/EmptyState'
import type { Prescription, StatutPrescription } from '../../types/api'
import { PRESCRIPTIONS_KEY } from '../../lib/keys'

type TabKey = 'TOUTES' | 'ACTIVES' | 'HISTORIQUE'

const TABS: { key: TabKey; labelKey: string }[] = [
  { key: 'TOUTES', labelKey: 'prescriptions.tab_all' },
  { key: 'ACTIVES', labelKey: 'prescriptions.tab_active' },
  { key: 'HISTORIQUE', labelKey: 'prescriptions.tab_history' },
]

const STATUT_PILL: Partial<Record<StatutPrescription, { bg: string; text: string; labelKey: string }>> = {
  TRANSMISE: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', labelKey: 'patient.prescriptions.statutValide' },
  ANNULEE: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', labelKey: 'prescriptions.statut_cancelled' },
  EXPIREE: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400', labelKey: 'prescriptions.statut_expired' },
  REMPLACEE: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400', labelKey: 'prescriptions.statut_replaced' },
}

export default function PrescriptionsModal({ onClose, onSelect }: {
  onClose: () => void
  onSelect: (prescription: Prescription) => void
}) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'en' ? 'en-GB' : 'fr-FR'
  const [tab, setTab] = useState<TabKey>('TOUTES')
  const [query, setQuery] = useState('')

  const { data, isLoading, error } = useSWR(PRESCRIPTIONS_KEY, fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true,
  })

  const prescriptions = useMemo(() => {
    const list = Array.isArray(data) ? data : []
    return list
      .filter((p: Prescription) => ['TRANSMISE', 'ANNULEE', 'EXPIREE', 'REMPLACEE'].includes(p.statut))
      .sort((a: Prescription, b: Prescription) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
  }, [data])

  const counts = useMemo(() => ({
    TOUTES: prescriptions.length,
    ACTIVES: prescriptions.filter((p: Prescription) => p.statut === 'TRANSMISE').length,
    HISTORIQUE: prescriptions.filter((p: Prescription) =>
      ['ANNULEE', 'EXPIREE', 'REMPLACEE'].includes(p.statut)
    ).length,
  }), [prescriptions])

  const filtered = useMemo(() => {
    let list: Prescription[]
    if (tab === 'HISTORIQUE') {
      list = prescriptions.filter((p: Prescription) => ['ANNULEE', 'EXPIREE', 'REMPLACEE'].includes(p.statut))
    } else if (tab === 'TOUTES') {
      list = prescriptions
    } else {
      list = prescriptions.filter((p: Prescription) => p.statut === 'TRANSMISE')
    }

    const q = query.trim().toLowerCase()
    if (!q) return list
    return list.filter((p: Prescription) => {
      const medecinName = `${(p.medecin as any)?.prenom || ''} ${(p.medecin as any)?.nom || ''}`.toLowerCase()
      const diagnostic = (p.diagnostic || '').toLowerCase()
      const meds = (p.medicaments || []).map((m: any) => (m.nom || '').toLowerCase()).join(' ')
      return medecinName.includes(q) || diagnostic.includes(q) || meds.includes(q)
    })
  }, [prescriptions, tab, query])

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[55] flex items-center justify-center p-4 bg-black/40"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white dark:bg-primary-800 rounded-2xl shadow-xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-primary-100 dark:border-white/10 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-mint-500/10 dark:bg-mint-500/20 flex items-center justify-center">
                <Pill className="w-5 h-5 text-mint-500" />
              </div>
              <div>
                <h2 className="font-display text-lg font-bold text-primary-900 dark:text-sable">
                  {t('patient.prescriptions.title')}
                </h2>
                <p className="text-xs text-primary-300">
                  {t('patient.prescriptions.subtitle')}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 text-primary-400 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tabs + Search */}
          <div className="flex flex-col sm:flex-row gap-3 px-5 pt-4 items-start sm:items-center justify-between shrink-0">
            <div className="flex gap-1.5 overflow-x-auto pb-1 max-w-full">
              {TABS.map((tabItem) => (
                <button
                  key={tabItem.key}
                  onClick={() => setTab(tabItem.key)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition ${
                    tab === tabItem.key
                      ? 'bg-primary-500 text-white shadow-md shadow-primary-500/25'
                      : 'bg-primary-50 dark:bg-primary-900 text-primary-300 dark:text-sable/70 border border-primary-100 dark:border-white/10 hover:bg-primary-100 dark:hover:bg-primary-700'
                  }`}
                >
                  {t(tabItem.labelKey)}
                  <span className="ml-1 opacity-70">({counts[tabItem.key]})</span>
                </button>
              ))}
            </div>
            <div className="relative w-full sm:w-52 shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-primary-300" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('common.search')}
                className="w-full rounded-xl border border-primary-100 dark:border-white/10 bg-white dark:bg-primary-900 pl-8 pr-3 py-1.5 text-xs text-primary-900 dark:text-sable placeholder:text-primary-300 focus:outline-none focus:ring-2 focus:ring-mint-500/30 transition-all"
              />
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto px-5 py-4">
            {isLoading ? (
              <LoadingSpinner label={t('patient.prescriptions.loading')} />
            ) : error ? (
              <EmptyState
                icon={FileText}
                title={t('prescriptions.errorTitle')}
                description={t('patient.prescriptions.errorDesc')}
              />
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={query ? Search : Pill}
                title={query ? t('prescriptions.noResultTitle') : t('prescriptions.noPrescriptionTitle')}
                description={query ? t('prescriptions.noResultDesc') : t('patient.prescriptions.emptyDesc')}
              />
            ) : (
              <div className="space-y-3">
                {filtered.map((p: Prescription) => {
                  const medecin = (p.medecin as any) || {}
                  const medecinName = `Dr ${medecin.prenom || ''} ${medecin.nom || ''}`.trim() || t('patient.doctor')
                  const pills = STATUT_PILL[p.statut] || { bg: 'bg-gray-100', text: 'text-gray-500', labelKey: p.statut }
                  const meds = Array.isArray(p.medicaments) ? p.medicaments : []

                  return (
                    <div
                      key={p.id}
                      className="rounded-xl bg-primary-50/50 dark:bg-primary-900/50 border border-primary-100 dark:border-white/5 p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 hover:border-primary-200 dark:hover:border-white/20 transition-colors"
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-0 w-full sm:w-auto">
                        <Avatar
                          name={medecinName}
                          size="md"
                          src={imgUrl(medecin.photoProfil)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-sm text-primary-900 dark:text-sable truncate">
                              {medecinName}
                            </h3>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${pills.bg} ${pills.text} shrink-0`}>
                              {t(pills.labelKey)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-primary-300">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(p.createdAt || '').toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                            <span className="text-primary-200 dark:text-white/10">·</span>
                            <span className="flex items-center gap-1">
                              <Pill className="w-3 h-3" />
                              {t('prescriptions.medicamentsCount', { count: meds.length })}
                            </span>
                          </div>
                          {p.diagnostic && (
                            <p className="mt-2 text-xs text-primary-600 dark:text-sable/70 line-clamp-1">
                              <span className="font-medium text-primary-700 dark:text-sable/90">{t('patient.prescriptions.reasonLabel')}</span> {p.diagnostic}
                            </p>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => onSelect(p)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-primary-800 border border-primary-100 dark:border-white/10 text-primary-700 dark:text-sable hover:border-mint-500 hover:text-mint-600 dark:hover:border-mint-500/50 dark:hover:text-mint-400 transition-all active:scale-[0.98] shrink-0"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        {t('patient.prescriptions.viewPrescription')}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  )
}
