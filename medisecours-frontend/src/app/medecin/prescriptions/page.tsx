'use client'

import { useMemo, useState, useCallback, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import {
  FileText, Pill, CalendarDays, Search, ClipboardList, Eye,
  Edit3, Trash2, PenLine, Send, RefreshCw, Ban, AlertTriangle,
  Clock, CheckCircle, History, FileEdit,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import useSWR, { mutate as globalMutate } from 'swr'
import api from '../../../api/axios'
import { fetcher } from '../../../lib/fetcher'
import { useAuth } from '../../../hooks/useAuth'
import { useToast } from '../../../components/ui/Toast'
import { PRESCRIPTIONS_KEY } from '../../../lib/keys'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import EmptyState from '../../../components/ui/EmptyState'
import Avatar from '../../../components/ui/Avatar'
import { imgUrl } from '../../../lib/config'
import PrescriptionDetailModal from '../../../components/admin/PrescriptionDetailModal'
import PrescriptionFormModal from '../../../components/admin/PrescriptionFormModal'
import ConfirmModal from '../../../components/ui/ConfirmModal'
import type { Prescription, StatutPrescription } from '../../../types/api'

type TabKey = 'TOUTES' | 'BROUILLON' | 'SIGNEE' | 'TRANSMISE' | 'HISTORIQUE'

const TABS: { key: TabKey; labelKey: string }[] = [
  { key: 'TOUTES', labelKey: 'prescriptions.tab_all' },
  { key: 'BROUILLON', labelKey: 'prescriptions.tab_drafts' },
  { key: 'SIGNEE', labelKey: 'prescriptions.tab_toSign' },
  { key: 'TRANSMISE', labelKey: 'prescriptions.tab_active' },
  { key: 'HISTORIQUE', labelKey: 'prescriptions.tab_history' },
]

const STATUT_PILL: Record<StatutPrescription, { bg: string; text: string; labelKey: string }> = {
  BROUILLON: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', labelKey: 'prescriptions.statut_draft' },
  SIGNEE: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', labelKey: 'prescriptions.statut_signed' },
  TRANSMISE: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', labelKey: 'prescriptions.statut_transmitted' },
  ANNULEE: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', labelKey: 'prescriptions.statut_cancelled' },
  EXPIREE: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400', labelKey: 'prescriptions.statut_expired' },
  REMPLACEE: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400', labelKey: 'prescriptions.statut_replaced' },
}

export default function MedecinPrescriptionsPage() {
  const { user } = useAuth()
  const toast = useToast()
  const { t, i18n } = useTranslation()
  const [tab, setTab] = useState<TabKey>('TOUTES')
  const [query, setQuery] = useState('')
  const [detailFor, setDetailFor] = useState<Prescription | null>(null)
  const [editFor, setEditFor] = useState<Prescription | null>(null)
  const [newPrescription, setNewPrescription] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Prescription | null>(null)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const ITEMS_PER_PAGE = 10

  const { data, isLoading, error, mutate } = useSWR(PRESCRIPTIONS_KEY, fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true,
  })

  const prescriptions = useMemo(() => {
    const list = Array.isArray(data) ? data : []
    return list
      .filter((p: Prescription) => String((p.medecin as any)?.id ?? p.medecin) === String(user?.id))
      .sort((a: Prescription, b: Prescription) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
  }, [data, user])

  const counts = useMemo(() => ({
    TOUTES: prescriptions.length,
    BROUILLON: prescriptions.filter((p: Prescription) => p.statut === 'BROUILLON').length,
    SIGNEE: prescriptions.filter((p: Prescription) => p.statut === 'SIGNEE').length,
    TRANSMISE: prescriptions.filter((p: Prescription) => p.statut === 'TRANSMISE').length,
    HISTORIQUE: prescriptions.filter((p: Prescription) =>
      ['ANNULEE', 'EXPIREE', 'REMPLACEE'].includes(p.statut)
    ).length,
  }), [prescriptions])

  const stats = useMemo(() => {
    const now = new Date()
    const thisMonth = prescriptions.filter((p: Prescription) => {
      const d = new Date(p.createdAt || 0)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    }).length
    return {
      actives: prescriptions.filter((p: Prescription) => p.statut === 'TRANSMISE').length,
      brouillons: counts.BROUILLON,
      ceMois: thisMonth,
      annulees: prescriptions.filter((p: Prescription) =>
        ['ANNULEE', 'REMPLACEE'].includes(p.statut)
      ).length,
    }
  }, [prescriptions, counts])

  const filtered = useMemo(() => {
    let list: Prescription[]
    if (tab === 'HISTORIQUE') {
      list = prescriptions.filter((p: Prescription) => ['ANNULEE', 'EXPIREE', 'REMPLACEE'].includes(p.statut))
    } else if (tab === 'TOUTES') {
      list = prescriptions
    } else {
      list = prescriptions.filter((p: Prescription) => p.statut === tab)
    }

    const q = query.trim().toLowerCase()
    if (!q) return list
    return list.filter((p: Prescription) => {
      const patientName = `${(p.patient as any)?.prenom || ''} ${(p.patient as any)?.nom || ''}`.toLowerCase()
      const diagnostic = (p.diagnostic || '').toLowerCase()
      const reference = (p.reference || '').toLowerCase()
      const meds = (p.medicaments || []).map((m: any) => (m.nom || '').toLowerCase()).join(' ')
      return patientName.includes(q) || diagnostic.includes(q) || reference.includes(q) || meds.includes(q)
    })
  }, [prescriptions, tab, query])

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
  const safePage = Math.min(page, totalPages)
  const paginated = useMemo(() => {
    const start = (safePage - 1) * ITEMS_PER_PAGE
    return filtered.slice(start, start + ITEMS_PER_PAGE)
  }, [filtered, safePage])

  useEffect(() => { setPage(1) }, [tab, query])

  const callAction = useCallback(async (url: string, payload?: any) => {
    try {
      const res = await api.post(url, payload || {})
      toast.success(t('prescriptions.actionSuccess'))
      mutate()
      return res.data
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t('prescriptions.actionError'))
      return null
    }
  }, [mutate, toast, t])

  const handleSign = useCallback(async (p: Prescription) => {
    setActionLoading(p.id)
    await callAction(`/api/prescriptions/${p.id}/sign`)
    setActionLoading(null)
  }, [callAction])

  const handleSend = useCallback(async (p: Prescription) => {
    setActionLoading(p.id)
    await callAction(`/api/prescriptions/${p.id}/send`)
    setActionLoading(null)
  }, [callAction])

  const handleCancel = useCallback(async (p: Prescription) => {
    setActionLoading(p.id)
    await callAction(`/api/prescriptions/${p.id}/cancel`, { cancelReason: 'Annulée par le médecin' })
    setActionLoading(null)
  }, [callAction])

  const handleReplace = useCallback(async (p: Prescription) => {
    setActionLoading(p.id)
    const result = await callAction(`/api/prescriptions/${p.id}/replace`)
    setActionLoading(null)
    if (result?.id) {
      setEditFor(result)
    }
  }, [callAction])

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return
    try {
      await api.delete(`/api/prescriptions/${deleteTarget.id}`)
      toast.success(t('prescriptions.deleted'))
      mutate()
      setDeleteTarget(null)
    } catch {
      toast.error(t('common.error'))
    }
  }, [deleteTarget, mutate, toast, t])

  return (
    <div className="medecin-consultations-page max-w-7xl mx-auto px-4 sm:px-6 py-6 lg:py-8">
      {/* En-tête */}
      <div className="medecin-consultations-header mb-8">
        <p className="medecin-consultations-eyebrow">{t('prescriptions.eyebrow')}</p>
        <h1 className="font-display text-2xl font-bold">{t('prescriptions.title')}</h1>
        <p className="mt-1">
          {counts.BROUILLON > 0
            ? t('prescriptions.draftCount', { count: counts.BROUILLON })
            : t('prescriptions.totalCount', { count: prescriptions.length })}
        </p>
      </div>

      {/* Cartes statistiques */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: t('prescriptions.active'), value: stats.actives, icon: CheckCircle, color: 'text-emerald-500' },
          { label: t('prescriptions.drafts'), value: stats.brouillons, icon: FileEdit, color: 'text-amber-500' },
          { label: t('prescriptions.thisMonth'), value: stats.ceMois, icon: CalendarDays, color: 'text-blue-500' },
          { label: t('prescriptions.cancelled'), value: stats.annulees, icon: Ban, color: 'text-red-400' },
        ].map((stat) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="medecin-consultation-stat"
          >
            <div className="medecin-consultation-stat-top">
              <span className="medecin-consultation-stat-label">{stat.label}</span>
              <div className="medecin-consultation-stat-icon-wrapper">
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
            </div>
            <div className="medecin-consultation-stat-value">{stat.value}</div>
          </motion.div>
        ))}
      </div>

      {/* Filtres + recherche + bouton nouvelle */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6 items-start sm:items-center justify-between">
        <div className="medecin-consultation-tabs overflow-x-auto flex-1">
          {TABS.map((tItem) => (
            <button
              key={tItem.key}
              onClick={() => setTab(tItem.key)}
              className={`whitespace-nowrap transition ${
                tab === tItem.key
                  ? 'medecin-consultation-tab-active'
                  : 'medecin-consultation-tab'
              }`}
            >
              {t(tItem.labelKey)}
              <span className="medecin-consultation-tab-count">{counts[tItem.key]}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2 items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-300" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('prescriptions.searchPlaceholder')}
              className="w-56 rounded-xl border border-primary-100 dark:border-white/10 bg-white dark:bg-primary-900 pl-9 pr-4 py-2 text-sm text-primary-900 dark:text-sable placeholder:text-primary-300"
            />
          </div>
          <button
            onClick={() => setNewPrescription(true)}
            className="medecin-consultation-btn-accent whitespace-nowrap"
          >
            <PenLine className="w-4 h-4" /> {t('prescriptions.new')}
          </button>
        </div>
      </div>

      {/* Contenu */}
      {isLoading ? (
        <LoadingSpinner label={t('prescriptions.loading')} />
      ) : error ? (
        <EmptyState
          icon={FileText}
          title={t('prescriptions.errorTitle')}
          description={t('prescriptions.errorDesc')}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={query ? Search : ClipboardList}
          title={query ? t('prescriptions.noResultTitle') : tab === 'BROUILLON' ? t('prescriptions.noDraftTitle') : t('prescriptions.noPrescriptionTitle')}
          description={query ? t('prescriptions.noResultDesc') : t('prescriptions.noPrescriptionDesc')}
          action={!query ? (
            <button onClick={() => setNewPrescription(true)} className="medecin-consultation-btn-accent">
              <PenLine className="w-4 h-4" /> {t('prescriptions.create')}
            </button>
          ) : undefined}
        />
      ) : (
        <div className="medecin-consultations-grid">
          <AnimatePresence mode="popLayout">
            {paginated.map((p: Prescription) => {
              const patient = (p.patient as any) || {}
              const patientName = `${patient.prenom || ''} ${patient.nom || ''}`.trim() || 'Patient'
              const pills = STATUT_PILL[p.statut] || STATUT_PILL.BROUILLON
              const meds = Array.isArray(p.medicaments) ? p.medicaments : []
              const consultation = (p.consultation as any) || {}
              const consultationId = consultation.id || String(consultation['@id'] || '').split('/').pop()
              const consultationMotif = consultation.motif || t('prescriptions.medicalConsultation')
              const consultationStatus = consultation.statut || '—'
              const locale = i18n.language === 'en' ? 'en-GB' : 'fr-FR'

              return (
                <motion.div
                  key={p.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="medecin-consultation-card"
                >
                  {/* Header */}
                  <div className="medecin-consultation-card-header">
                    <span className="medecin-consultation-card-id">{p.reference || `ORD-${String(p.id).padStart(5, '0')}`}</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${pills.bg} ${pills.text}`}>
                      {t(pills.labelKey)}
                    </span>
                  </div>

                  {/* Patient */}
                  <div className="medecin-consultation-patient">
                    <Avatar
                      name={patientName}
                      size="md"
                      src={imgUrl(patient.photoProfil)}
                    />
                    <div className="medecin-consultation-patient-info">
                      <div className="medecin-consultation-patient-name">{patientName}</div>
                      <div className="medecin-consultation-patient-phone">
                        <Pill className="w-3.5 h-3.5" />
                        {t('prescriptions.medicamentsCount', { count: meds.length })}
                      </div>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="medecin-consultation-details">
                    <div className="medecin-consultation-detail-item" style={{ gridColumn: 'span 2' }}>
                      <span className="medecin-consultation-detail-label">{t('prescriptions.consultationSource')}</span>
                      <span className="medecin-consultation-detail-value truncate">
                        <ClipboardList className="w-3.5 h-3.5 text-primary-500 shrink-0" />
                        {consultationId ? `#${consultationId} · ` : ''}{consultationMotif} · {consultationStatus}
                      </span>
                    </div>
                    <div className="medecin-consultation-detail-item" style={{ gridColumn: 'span 2' }}>
                      <span className="medecin-consultation-detail-label">{t('prescriptions.diagnostic')}</span>
                      <span className="medecin-consultation-detail-value truncate">
                        {p.diagnostic || t('common.none')}
                      </span>
                    </div>
                    <div className="medecin-consultation-detail-item">
                      <span className="medecin-consultation-detail-label">{t('consultations.date')}</span>
                      <span className="medecin-consultation-detail-value">
                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                        {new Date(p.createdAt || '').toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    <div className="medecin-consultation-detail-item">
                      <span className="medecin-consultation-detail-label">{t('prescriptions.version')}</span>
                      <span className="medecin-consultation-detail-value">
                        v{p.version}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="medecin-consultation-actions">
                    {/* BROUILLON */}
                    {p.statut === 'BROUILLON' && (
                      <>
                        <button onClick={() => setEditFor(p)} className="medecin-consultation-btn-outline" disabled={actionLoading === p.id}>
                          <Edit3 className="w-4 h-4" /> {t('prescriptions.edit')}
                        </button>
                        <button onClick={() => setDeleteTarget(p)} className="medecin-consultation-btn-danger" disabled={actionLoading === p.id}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleSign(p)} className="medecin-consultation-btn-accent" disabled={actionLoading === p.id}>
                          <PenLine className="w-4 h-4" /> {t('prescriptions.sign')}
                        </button>
                      </>
                    )}

                    {/* SIGNEE */}
                    {p.statut === 'SIGNEE' && (
                      <>
                        <button onClick={() => setDetailFor(p)} className="medecin-consultation-btn-outline">
                          <Eye className="w-4 h-4" /> {t('prescriptions.view')}
                        </button>
                        <button onClick={() => handleSend(p)} className="medecin-consultation-btn-accent" disabled={actionLoading === p.id}>
                          <Send className="w-4 h-4" /> {t('prescriptions.transmit')}
                        </button>
                        <button onClick={() => handleCancel(p)} className="medecin-consultation-btn-danger" disabled={actionLoading === p.id}>
                          <Ban className="w-4 h-4" />
                        </button>
                      </>
                    )}

                    {/* TRANSMISE */}
                    {p.statut === 'TRANSMISE' && (
                      <>
                        <button onClick={() => setDetailFor(p)} className="medecin-consultation-btn-outline">
                          <Eye className="w-4 h-4" /> {t('prescriptions.view')}
                        </button>
                        <button onClick={() => handleReplace(p)} className="medecin-consultation-btn-outline" disabled={actionLoading === p.id}>
                          <RefreshCw className="w-4 h-4" /> {t('prescriptions.replace')}
                        </button>
                        <button onClick={() => handleCancel(p)} className="medecin-consultation-btn-danger" disabled={actionLoading === p.id}>
                          <Ban className="w-4 h-4" />
                        </button>
                      </>
                    )}

                    {/* ANNULEE */}
                    {p.statut === 'ANNULEE' && (
                      <button onClick={() => setDetailFor(p)} className="medecin-consultation-btn-outline">
                        <Eye className="w-4 h-4" /> {t('prescriptions.viewReason')}
                      </button>
                    )}

                    {/* EXPIREE */}
                    {p.statut === 'EXPIREE' && (
                      <button onClick={() => setDetailFor(p)} className="medecin-consultation-btn-outline">
                        <Eye className="w-4 h-4" /> {t('prescriptions.view')}
                      </button>
                    )}

                    {/* REMPLACEE */}
                    {p.statut === 'REMPLACEE' && (
                      <button onClick={() => setDetailFor(p)} className="medecin-consultation-btn-outline">
                        <History className="w-4 h-4" /> {t('prescriptions.viewNew')}
                      </button>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Pagination */}
      {filtered.length > ITEMS_PER_PAGE && (
        <div className="flex items-center justify-between mt-6 px-1">
          <p className="text-xs text-primary-300">
            {t('prescriptions.showing', { from: (safePage - 1) * ITEMS_PER_PAGE + 1, to: Math.min(safePage * ITEMS_PER_PAGE, filtered.length), total: filtered.length })}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="p-2 rounded-xl border border-primary-100 dark:border-white/10 text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-700 disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 2)
              .reduce<(number | 'dots')[]>((acc, p, idx, arr) => {
                if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('dots')
                acc.push(p)
                return acc
              }, [])
              .map((item, idx) =>
                item === 'dots' ? (
                  <span key={`dots-${idx}`} className="px-1 text-primary-300">...</span>
                ) : (
                  <button
                    key={item}
                    onClick={() => setPage(item)}
                    className={`min-w-[32px] h-8 px-2 rounded-xl text-xs font-semibold transition ${
                      safePage === item
                        ? 'bg-primary-500 text-white shadow-md shadow-primary-500/25'
                        : 'border border-primary-100 dark:border-white/10 text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-700'
                    }`}
                  >
                    {item}
                  </button>
                )
              )}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="p-2 rounded-xl border border-primary-100 dark:border-white/10 text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-700 disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {detailFor && (
        <PrescriptionDetailModal
          prescription={detailFor}
          onClose={() => setDetailFor(null)}
        />
      )}

      {(newPrescription || editFor) && (
        <PrescriptionFormModal
          consultation={editFor?.consultation || null}
          prescription={editFor}
          onClose={() => { setNewPrescription(false); setEditFor(null) }}
          onSaved={() => { setNewPrescription(false); setEditFor(null); mutate() }}
        />
      )}

      <ConfirmModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={t('prescriptions.deleteTitle')}
        message={t('prescriptions.deleteMessage')}
        type="danger"
        confirmText={t('prescriptions.deleteConfirm')}
        cancelText={t('common.cancel')}
      />
    </div>
  )
}
