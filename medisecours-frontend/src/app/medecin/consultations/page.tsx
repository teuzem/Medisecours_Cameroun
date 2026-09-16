'use client'

import { useMemo, useState, useCallback } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import {
  ClipboardList, Clock, CheckCircle, MessageSquare, FileText, AlertTriangle,
  Activity, Phone, Mail, User, Trash2,
} from 'lucide-react'
import useSWR, { mutate as globalMutate } from 'swr'
import api from '../../../api/axios'
import { fetcher } from '../../../lib/fetcher'
import { useAuth } from '../../../hooks/useAuth'
import { useWebSocket } from '../../../hooks/useWebSocket'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import EmptyState from '../../../components/ui/EmptyState'
import Avatar from '../../../components/ui/Avatar'
import { useToast } from '../../../components/ui/Toast'
import { imgUrl } from '../../../lib/config'
import {
  STATUT_CONSULTATION_PILL,
  STATUT_BADGE_RING,
  PRIORITE_BADGE,
  daysSince,
} from '../../../lib/consultations'
import { CONSULTATIONS_KEY, CONSULTATIONS_PENDING_KEY } from '../../../lib/keys'
import PrescriptionFormModal from '../../../components/admin/PrescriptionFormModal'
import ConsultationDetailModal from '../../../components/consultations/ConsultationDetailModal'
import ConfirmModal from '../../../components/ui/ConfirmModal'
import type { StatutConsultation, PrioriteConsultation } from '../../../types/api'

// M2 corrigé : styles centralisés dans lib/consultations.ts.
// On ne redéfinit plus STATUT_STYLES / PRIORITE_UI localement.
const STATUT_STYLES = STATUT_BADGE_RING
const STATUT_PILLS = STATUT_CONSULTATION_PILL

type TabKey = 'TOUTES' | 'OUVERTE' | 'EN_COURS' | 'TERMINEE'

const TABS: { key: TabKey; labelKey: string }[] = [
  { key: 'TOUTES', labelKey: 'consultations.tab_all' },
  { key: 'OUVERTE', labelKey: 'consultations.tab_pending' },
  { key: 'EN_COURS', labelKey: 'consultations.tab_inProgress' },
  { key: 'TERMINEE', labelKey: 'consultations.tab_finished' },
]

const STATUT_PILL_LABELS: Record<string, string> = {
  OUVERTE: 'consultations.pending',
  EN_COURS: 'consultations.inProgress',
  TERMINEE: 'consultations.finished',
  ANNULEE: 'consultations.cancelled',
}

export default function MedecinConsultationsPage() {
  const { user, token } = useAuth()
  const toast = useToast()
  const { t, i18n } = useTranslation()
  const [tab, setTab] = useState<TabKey>('TOUTES')
  const [prescriptionFor, setPrescriptionFor] = useState<any>(null)
  const [detailFor, setDetailFor] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null)

  const { data, isLoading, error, mutate } = useSWR(CONSULTATIONS_KEY, fetcher, {
    revalidateOnFocus: false,
    // M1 corrigé : pas de refreshInterval. Le WebSocket (useWebSocket ci-dessous)
    // pousse déjà les mises à jour temps réel. Le polling 15s était redondant et
    // provoquait du flicker en écrasant les updates optimistes.
    keepPreviousData: true,
  })

  useWebSocket(user?.id || '', token || '', {
    onConsultationCreated: useCallback((payload: any) => {
      mutate((current: any) => {
        const list = Array.isArray(current) ? current : []
        if (list.some((c: any) => c.id === payload.id)) return list
        toast.info(t('consultations.newRequest'))
        return [{ ...payload }, ...list]
      }, { revalidate: false })
    }, [mutate, toast, t]),
    onConsultationAccepted: useCallback((payload: any) => {
      mutate((current: any) => {
        const list = Array.isArray(current) ? current : []
        return list.map((c: any) => c.id === payload.id ? { ...c, statut: 'EN_COURS', medecin: payload.medecin } : c)
      }, { revalidate: false })
    }, [mutate]),
    onConsultationClosed: useCallback((payload: any) => {
      mutate((current: any) => {
        const list = Array.isArray(current) ? current : []
        return list.map((c: any) => c.id === payload.id ? { ...c, statut: 'TERMINEE' } : c)
      }, { revalidate: false })
    }, [mutate]),
  })

  const consultations = useMemo(() => {
    const list = Array.isArray(data) ? data : []
    return list.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [data])

  const counts = useMemo(() => ({
    TOUTES: consultations.length,
    OUVERTE: consultations.filter((c: any) => c.statut === 'OUVERTE').length,
    EN_COURS: consultations.filter((c: any) => c.statut === 'EN_COURS').length,
    TERMINEE: consultations.filter((c: any) => c.statut === 'TERMINEE').length,
  }), [consultations])

  const filtered = useMemo(() => {
    if (tab === 'TOUTES') return consultations
    return consultations.filter((c: any) => c.statut === tab)
  }, [consultations, tab])

  const updateStatut = async (id: number, statut: string) => {
    try {
      await api.patch(
        `/api/consultations/${id}`,
        { statut },
        { headers: { 'Content-Type': 'application/merge-patch+json' } }
      )
      const msg = statut === 'EN_COURS' ? t('consultations.updated') : t('consultations.closed')
      toast.success(msg)
      mutate()
      globalMutate(CONSULTATIONS_PENDING_KEY)
    } catch {
      toast.error(t('consultations.updateError'))
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/api/consultations/${id}`)
      mutate((current: any) => {
        const list = Array.isArray(current) ? current : []
        return list.filter((c: any) => c.id !== id)
      }, { revalidate: false })
      toast.success(t('consultations.deleted'))
      setDeleteTarget(null)
      globalMutate(CONSULTATIONS_PENDING_KEY)
    } catch {
      toast.error(t('consultations.deleteError'))
    }
  }



  return (
    <div className="medecin-consultations-page max-w-7xl mx-auto px-4 sm:px-6 py-6 lg:py-8">
      {/* En-tête */}
      <div className="medecin-consultations-header mb-8">
        <p className="medecin-consultations-eyebrow">{t('consultations.eyebrow')}</p>
        <h1 className="font-display text-2xl font-bold">{t('consultations.title')}</h1>
        <p className="mt-1">
          {counts.OUVERTE > 0
            ? t('consultations.pendingCount', { count: counts.OUVERTE })
            : t('consultations.noPendingCount')}
        </p>
        <div className="medecin-consultations-live">
          <span className="medecin-consultations-live-dot" />
          {t('consultations.liveSync')}
        </div>
      </div>

      {/* Cartes statistiques */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: t('consultations.total'), value: counts.TOUTES, icon: ClipboardList },
          { label: t('consultations.pending'), value: counts.OUVERTE, icon: Clock },
          { label: t('consultations.inProgress'), value: counts.EN_COURS, icon: Activity },
          { label: t('consultations.finished'), value: counts.TERMINEE, icon: CheckCircle },
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
                <stat.icon className="w-4 h-4" />
              </div>
            </div>
            <div className="medecin-consultation-stat-value">{stat.value}</div>
            <div className="medecin-consultation-stat-trend neutral">
              <span>{t('consultations.updatedNow')}</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Filtres */}
      <div className="medecin-consultation-tabs overflow-x-auto">
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

      {/* Liste */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={tab === 'OUVERTE' ? t('consultations.noPendingTitle') : t('consultations.noConsultationTitle')}
          description={tab === 'OUVERTE' ? t('consultations.noPendingDesc') : t('consultations.noConsultationDesc')}
          action={tab !== 'TOUTES' ? (
            <button onClick={() => setTab('TOUTES')} className="medecin-consultation-btn-accent">
              {t('consultations.seeAll')}
            </button>
          ) : undefined}
        />
      ) : (
        <div className="medecin-consultations-grid">
          <AnimatePresence mode="popLayout">
            {filtered.map((c: any) => {
              const statut = c.statut as StatutConsultation
              const badgeClass = STATUT_STYLES[statut] || STATUT_STYLES.OUVERTE
              const pill = STATUT_PILLS[statut] || statut
              const statutLabel = STATUT_PILL_LABELS[statut] || pill

              let priorityCardClass = ''
              if (c.priorite === 'CRITIQUE') priorityCardClass = 'medecin-consultation-card-urgent'
              else if (c.priorite === 'URGENTE') priorityCardClass = 'medecin-consultation-card-priority'

              const locale = i18n.language === 'en' ? 'en-GB' : 'fr-FR'

              return (
                <motion.div
                  key={c.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className={`medecin-consultation-card ${priorityCardClass}`}
                >
                  {/* Card Header */}
                  <div className="medecin-consultation-card-header">
                    <span className="medecin-consultation-card-id">#{c.id.toString().padStart(5, '0')}</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${badgeClass}`}>
                      {statutLabel}
                    </span>
                  </div>

                  {/* Infos patient */}
                  <div className="medecin-consultation-patient">
                    <Avatar
                      name={`${c.patient?.prenom || ''} ${c.patient?.nom || ''}`}
                      size="md"
                      src={imgUrl(c.patient?.photoProfil)}
                    />
                    <div className="medecin-consultation-patient-info">
                      <div className="medecin-consultation-patient-name">
                        {c.patient?.prenom} {c.patient?.nom}
                      </div>
                      {c.patient?.telephone && (
                        <div className="medecin-consultation-patient-phone">
                          <Phone className="w-3.5 h-3.5" />
                          {c.patient.telephone}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Details */}
                  <div className="medecin-consultation-details">
                    <div className="medecin-consultation-detail-item" style={{ gridColumn: 'span 2' }}>
                      <span className="medecin-consultation-detail-label">{t('consultations.reason')}</span>
                      <span className="medecin-consultation-detail-value truncate">
                        {c.motif || t('common.none')}
                      </span>
                    </div>
                    <div className="medecin-consultation-detail-item">
                      <span className="medecin-consultation-detail-label">{t('consultations.date')}</span>
                      <span className="medecin-consultation-detail-value">
                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                        {new Date(c.createdAt).toLocaleDateString(locale, {
                          day: 'numeric', month: 'short'
                        })}
                      </span>
                    </div>
                    <div className="medecin-consultation-detail-item">
                      <span className="medecin-consultation-detail-label">{t('consultations.priority')}</span>
                      <span className="medecin-consultation-detail-value">
                        {c.priorite === 'CRITIQUE' ? (
                          <span className="text-red-500 font-bold flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {t('consultations.priorityCritical')}</span>
                        ) : c.priorite === 'URGENTE' ? (
                          <span className="text-amber-500 font-bold flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {t('consultations.priorityUrgent')}</span>
                        ) : (
                          <span className="text-emerald-500 font-medium">{t('consultations.priorityNormal')}</span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="medecin-consultation-actions">
                    <button
                      onClick={() => setDeleteTarget(c.id)}
                      className="medecin-consultation-btn-danger"
                      title={t('common.delete')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => setDetailFor(c.id)}
                      className="medecin-consultation-btn-outline"
                    >
                      {t('common.details')}
                    </button>

                    {c.statut === 'OUVERTE' && (
                      <>
                        <Link
                          href={`/medecin/messages?patient=${c.patient?.id}`}
                          className="medecin-consultation-btn-outline"
                          title={t('consultations.message')}
                        >
                          <MessageSquare className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => updateStatut(c.id, 'EN_COURS')}
                          className="medecin-consultation-btn-accent"
                        >
                          {t('consultations.takeCharge')}
                        </button>
                      </>
                    )}
                    {c.statut === 'EN_COURS' && (
                      <>
                        <Link
                          href={`/medecin/messages?patient=${c.patient?.id}`}
                          className="medecin-consultation-btn-outline"
                          title={t('consultations.discuss')}
                        >
                          <MessageSquare className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => setPrescriptionFor(c)}
                          className="medecin-consultation-btn-outline"
                          title={t('consultations.prescribe')}
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => updateStatut(c.id, 'TERMINEE')}
                          className="medecin-consultation-btn-success"
                        >
                          <CheckCircle className="w-4 h-4" /> {t('consultations.finish')}
                        </button>
                      </>
                    )}
                    {c.statut === 'TERMINEE' && (
                      <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-50 text-gray-500 border border-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400">
                        {t('consultations.finishedOn', { date: new Date(c.closedAt || c.createdAt).toLocaleDateString(locale, { day: 'numeric', month: 'short' }) })}
                      </span>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      {prescriptionFor && (
        <PrescriptionFormModal
          consultation={prescriptionFor}
          onClose={() => setPrescriptionFor(null)}
          onSaved={() => { setPrescriptionFor(null); mutate() }}
        />
      )}
      {detailFor && (
        <ConsultationDetailModal
          consultationId={detailFor}
          onClose={() => setDetailFor(null)}
        />
      )}
      <ConfirmModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => handleDelete(deleteTarget!)}
        title={t('consultations.deleteTitle')}
        message={t('consultations.deleteMessage')}
        type="danger"
        confirmText={t('consultations.deleteConfirm')}
        cancelText={t('common.cancel')}
      />
    </div>
  )
}
