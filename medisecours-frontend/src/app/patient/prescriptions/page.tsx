'use client'

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText, Pill, Clock, CheckCircle, Search, Eye, History, Ban
} from 'lucide-react'
import useSWR from 'swr'
import { fetcher } from '../../../lib/fetcher'
import { useAuth } from '../../../hooks/useAuth'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import EmptyState from '../../../components/ui/EmptyState'
import Avatar from '../../../components/ui/Avatar'
import { imgUrl } from '../../../lib/config'
import PrescriptionDetailModal from '../../../components/admin/PrescriptionDetailModal'
import type { Prescription, StatutPrescription } from '../../../types/api'
import { PRESCRIPTIONS_KEY } from '../../../lib/keys'

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

export default function PatientPrescriptionsPage() {
  const { user } = useAuth()
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'en' ? 'en-GB' : 'fr-FR'
  const [tab, setTab] = useState<TabKey>('ACTIVES')
  const [query, setQuery] = useState('')
  const [detailFor, setDetailFor] = useState<Prescription | null>(null)

  const { data, isLoading, error } = useSWR(PRESCRIPTIONS_KEY, fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true,
  })

  const prescriptions = useMemo(() => {
    const list = Array.isArray(data) ? data : []
    // Ne montrer aux patients que les ordonnances qui leur ont été transmises (ou annulées après transmission)
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

  if (!user) return <LoadingSpinner label={t('common.loading')} />

  return (
    <div className="min-h-screen bg-sable dark:bg-primary-900">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* En-tête de page */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-primary-900 dark:text-sable">
              {t('patient.prescriptions.title')}
            </h1>
            <p className="text-sm text-primary-300 mt-1">
              {t('patient.prescriptions.subtitle')}
            </p>
          </div>
        </div>

        {/* Cartes statistiques */}
        <div className="grid grid-cols-2 gap-4 sm:gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl bg-white dark:bg-primary-800 border border-primary-100 dark:border-white/5 p-4 sm:p-5 flex items-center gap-4 shadow-sm"
          >
            <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center shrink-0">
              <CheckCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-3xl font-bold text-primary-900 dark:text-sable">{counts.ACTIVES}</p>
              <p className="text-sm text-primary-300 font-medium">{t('patient.prescriptions.activeCount')}</p>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl bg-white dark:bg-primary-800 border border-primary-100 dark:border-white/5 p-4 sm:p-5 flex items-center gap-4 shadow-sm"
          >
            <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
              <History className="w-6 h-6 text-gray-600 dark:text-gray-400" />
            </div>
            <div>
              <p className="text-3xl font-bold text-primary-900 dark:text-sable">{counts.HISTORIQUE}</p>
              <p className="text-sm text-primary-300 font-medium">{t('patient.prescriptions.historyCount')}</p>
            </div>
          </motion.div>
        </div>

        {/* Filtres + recherche */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6 items-start sm:items-center justify-between">
          <div className="flex gap-1.5 overflow-x-auto pb-1 max-w-full">
            {TABS.map((tabItem) => (
              <button
                key={tabItem.key}
                onClick={() => setTab(tabItem.key)}
                className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition ${
                  tab === tabItem.key
                    ? 'bg-primary-500 text-white shadow-md shadow-primary-500/25'
                    : 'bg-white dark:bg-primary-800 text-primary-300 dark:text-sable/70 border border-primary-100 dark:border-white/10 hover:bg-primary-50 dark:hover:bg-primary-700'
                }`}
              >
                {t(tabItem.labelKey)}
                <span className="ml-1.5 opacity-70">({counts[tabItem.key]})</span>
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-64 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-300" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('common.search')}
              className="w-full rounded-xl border border-primary-100 dark:border-white/10 bg-white dark:bg-primary-900 pl-9 pr-4 py-2 text-sm text-primary-900 dark:text-sable placeholder:text-primary-300 focus:outline-none focus:ring-2 focus:ring-mint-500/30 transition-all"
            />
          </div>
        </div>

        {/* Contenu */}
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
          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {filtered.map((p: Prescription) => {
                const medecin = (p.medecin as any) || {}
                const medecinName = `Dr ${medecin.prenom || ''} ${medecin.nom || ''}`.trim() || t('patient.doctor')
                const pills = STATUT_PILL[p.statut] || { bg: 'bg-gray-100', text: 'text-gray-500', labelKey: p.statut }
                const meds = Array.isArray(p.medicaments) ? p.medicaments : []

                return (
                  <motion.div
                    key={p.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="rounded-2xl bg-white dark:bg-primary-800 border border-primary-100 dark:border-white/5 p-5 flex flex-col sm:flex-row items-start sm:items-center gap-5 shadow-sm hover:shadow-md hover:border-primary-200 dark:hover:border-white/20 transition-all"
                  >
                    <div className="flex items-start gap-4 flex-1 min-w-0 w-full sm:w-auto">
                      <Avatar
                        name={medecinName}
                        size="lg"
                        src={imgUrl(medecin.photoProfil)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-primary-900 dark:text-sable truncate">
                            {medecinName}
                          </h3>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold ${pills.bg} ${pills.text} shrink-0`}>
                            {t(pills.labelKey)}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-3 text-sm text-primary-300">
                          <span className="flex items-center gap-1.5">
                            <Clock className="w-4 h-4" />
                            {new Date(p.createdAt || '').toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })}
                          </span>
                          <span className="hidden sm:inline text-primary-200 dark:text-white/10">•</span>
                          <span className="flex items-center gap-1.5">
                            <Pill className="w-4 h-4" />
                            {t('prescriptions.medicamentsCount', { count: meds.length })}
                          </span>
                        </div>
                        
                        {p.diagnostic && (
                          <div className="mt-3 text-sm text-primary-600 dark:text-sable/80 bg-primary-50 dark:bg-primary-900/50 p-2.5 rounded-lg border border-primary-100 dark:border-white/5 inline-block">
                            <span className="font-medium text-primary-900 dark:text-sable">{t('patient.prescriptions.reasonLabel')}</span> {p.diagnostic}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-end w-full sm:w-auto shrink-0 border-t sm:border-t-0 border-primary-100 dark:border-white/10 pt-4 sm:pt-0">
                      <button
                        onClick={() => setDetailFor(p)}
                        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-white dark:bg-primary-800 border-2 border-primary-100 dark:border-white/10 text-primary-700 dark:text-sable hover:border-mint-500 hover:text-mint-600 dark:hover:border-mint-500/50 dark:hover:text-mint-400 transition-all active:scale-[0.98] w-full sm:w-auto shadow-sm"
                      >
                        <Eye className="w-4 h-4" />
                        {t('patient.prescriptions.viewPrescription')}
                      </button>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {detailFor && (
        <PrescriptionDetailModal
          prescription={detailFor}
          onClose={() => setDetailFor(null)}
        />
      )}
    </div>
  )
}
