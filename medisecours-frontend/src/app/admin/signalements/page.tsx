'use client'

import { useDeferredValue, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import useSWR from 'swr'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  Flag,
  Search,
  ShieldCheck,
  Trash2,
  XCircle,
} from 'lucide-react'
import api from '../../../api/axios'
import { fetcher } from '../../../lib/fetcher'
import Avatar from '../../../components/ui/Avatar'
import EmptyState from '../../../components/ui/EmptyState'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import Modal from '../../../components/ui/Modal'
import ConfirmModal from '../../../components/ui/ConfirmModal'
import { useToast } from '../../../components/ui/Toast'

type ReportStatus = 'NOUVEAU' | 'EN_COURS' | 'TRAITE' | 'REJETE'

interface Person {
  id: string
  nom?: string | null
  prenom?: string | null
  email?: string | null
  telephone?: string | null
  specialite?: string | null
  numeroOrdre?: string | null
}

interface DoctorReport {
  id: number
  motif: string
  description: string
  statut: ReportStatus
  noteAdmin?: string | null
  createdAt: string
  updatedAt: string
  traiteAt?: string | null
  patient?: Person | null
  medecin?: Person | null
}

const STATUS_META: Record<ReportStatus, {
  labelKey: string
  className: string
  icon: typeof Flag
}> = {
  NOUVEAU: {
    labelKey: 'admin.signalements.statusNouveau',
    className: 'bg-red-100 text-red-700',
    icon: AlertTriangle,
  },
  EN_COURS: {
    labelKey: 'admin.signalements.statusEnCours',
    className: 'bg-amber-100 text-amber-800',
    icon: Clock3,
  },
  TRAITE: {
    labelKey: 'admin.signalements.statusTraite',
    className: 'bg-emerald-100 text-emerald-700',
    icon: CheckCircle2,
  },
  REJETE: {
    labelKey: 'admin.signalements.statusRejete',
    className: 'bg-slate-200 text-slate-700',
    icon: XCircle,
  },
}

const MOTIF_LABELS: Record<string, string> = {
  COMPORTEMENT_INAPPROPRIE: 'admin.signalements.motifComportement',
  FAUSSE_INFORMATION: 'admin.signalements.motifFausseInfo',
  HARCELEMENT: 'admin.signalements.motifHarcelement',
  NEGLIGENCE: 'admin.signalements.motifNegligence',
  FRAUDE: 'admin.signalements.motifFraude',
  AUTRE: 'admin.signalements.motifAutre',
}

export default function AdminSignalementsPage() {
  const toast = useToast()
  const { t, i18n } = useTranslation()
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<DoctorReport | null>(null)
  const [editStatus, setEditStatus] = useState<ReportStatus>('NOUVEAU')
  const [adminNote, setAdminNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DoctorReport | null>(null)

  const query = new URLSearchParams({
    page: String(page),
    limit: '20',
  })
  if (deferredSearch.trim()) query.set('search', deferredSearch.trim())
  if (status) query.set('statut', status)

  const {
    data: statsData,
    mutate: mutateStats,
  } = useSWR('/api/admin/signalements/stats', fetcher, { revalidateOnFocus: true })
  const {
    data: listData,
    error,
    isLoading,
    mutate: mutateList,
  } = useSWR(`/api/admin/signalements?${query.toString()}`, fetcher, {
    revalidateOnFocus: true,
  })

  const stats = useMemo(() => statsData ?? {
    total: 0,
    nouveaux: 0,
    enCours: 0,
    traites: 0,
    rejetes: 0,
  }, [statsData])
  const list = useMemo(() => listData ?? {
    items: [],
    total: 0,
    page: 1,
    pages: 0,
  }, [listData])

  const openDetail = (report: DoctorReport) => {
    setSelected(report)
    setEditStatus(report.statut)
    setAdminNote(report.noteAdmin ?? '')
  }

  const refresh = async () => {
    await Promise.all([mutateList(), mutateStats()])
  }

  const saveReport = async () => {
    if (!selected) return
    setSaving(true)
    try {
      const response = await api.patch(`/api/admin/signalements/${selected.id}`, {
        statut: editStatus,
        noteAdmin: adminNote.trim() || null,
      })
      setSelected(response.data as DoctorReport)
      await refresh()
      toast.success(t('admin.signalements.toastUpdated'))
    } catch {
      toast.error(t('admin.signalements.toastUpdateError'))
    } finally {
      setSaving(false)
    }
  }

  const deleteReport = async () => {
    if (!deleteTarget) return
    setSaving(true)
    try {
      await api.delete(`/api/admin/signalements/${deleteTarget.id}`)
      if (selected?.id === deleteTarget.id) setSelected(null)
      setDeleteTarget(null)
      await refresh()
      toast.success(t('admin.signalements.toastDeleted'))
    } catch {
      toast.error(t('admin.signalements.toastDeleteError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={deleteReport}
        isLoading={saving}
        type="danger"
        title={t('admin.signalements.deleteConfirmTitle')}
        message={t('admin.signalements.deleteConfirmMessage')}
        confirmText={t('admin.signalements.deleteConfirm')}
      />

      <Modal
        isOpen={Boolean(selected)}
        onClose={() => {
          if (!saving) setSelected(null)
        }}
        title={t('admin.signalements.detailTitle')}
        size="lg"
      >
        {selected && (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <PersonBlock title={t('admin.signalements.patientDeclarant')} person={selected.patient} />
              <PersonBlock title={t('admin.signalements.medecinConcerne')} person={selected.medecin} doctor />
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#7c8778]">
                {t('admin.signalements.motifLabel')}
              </p>
              <p className="mt-2 text-sm font-bold text-[#172216]">
                {MOTIF_LABELS[selected.motif] ? t(MOTIF_LABELS[selected.motif]) : selected.motif}
              </p>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#7c8778]">
                {t('admin.signalements.descriptionPatient')}
              </p>
              <p className="mt-2 whitespace-pre-wrap rounded-lg bg-[#f4f6f1] p-4 text-sm leading-6 text-[#334032]">
                {selected.description}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
              <div>
                <label htmlFor="report-status" className="text-xs font-bold uppercase tracking-[0.16em] text-[#7c8778]">
                  {t('admin.signalements.statutLabel')}
                </label>
                <select
                  id="report-status"
                  value={editStatus}
                  onChange={(event) => setEditStatus(event.target.value as ReportStatus)}
                  className="mt-2 min-h-11 w-full rounded-lg border border-[#dfe5db] bg-white px-3 text-sm text-[#172216]"
                >
                  {Object.entries(STATUS_META).map(([value, meta]) => (
                    <option key={value} value={value}>{t(meta.labelKey)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="admin-note" className="text-xs font-bold uppercase tracking-[0.16em] text-[#7c8778]">
                  {t('admin.signalements.noteAdmin')}
                </label>
                <textarea
                  id="admin-note"
                  value={adminNote}
                  onChange={(event) => setAdminNote(event.target.value)}
                  rows={4}
                  maxLength={2000}
                  placeholder={t('admin.signalements.noteAdminPlaceholder')}
                  className="mt-2 w-full resize-y rounded-lg border border-[#dfe5db] bg-white px-3 py-3 text-sm text-[#172216]"
                />
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-[#e3e7df] pt-4 sm:flex-row sm:justify-between">
              <button
                type="button"
                onClick={() => setDeleteTarget(selected)}
                disabled={saving}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-red-50 px-4 text-sm font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {t('admin.signalements.delete')}
              </button>
              <button
                type="button"
                onClick={saveReport}
                disabled={saving}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#0f2418] px-5 text-sm font-bold text-white disabled:opacity-50"
              >
                <ShieldCheck className="h-4 w-4" />
                {saving ? t('admin.signalements.saving') : t('admin.signalements.saveTreatment')}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <section className="border border-[#dfe5db] bg-[#0f2418] p-5 text-white sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/60">{t('admin.signalements.eyebrow')}</p>
        <h1 className="mt-2 font-display text-2xl font-extrabold sm:text-3xl">
          {t('admin.signalements.title')}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">
          {t('admin.signalements.description')}
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Metric label={t('admin.signalements.statTotal')} value={stats.total} />
        <Metric label={t('admin.signalements.statNouveaux')} value={stats.nouveaux} tone="red" />
        <Metric label={t('admin.signalements.statEnCours')} value={stats.enCours} tone="amber" />
        <Metric label={t('admin.signalements.statTraites')} value={stats.traites} tone="green" />
        <Metric label={t('admin.signalements.statRejetes')} value={stats.rejetes} />
      </section>

      <section className="border border-[#e3e7df] bg-white">
        <div className="flex flex-col gap-3 border-b border-[#e3e7df] p-4 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#768172]" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
              placeholder={t('admin.signalements.searchPlaceholder')}
              className="min-h-11 w-full rounded-lg border border-[#dfe5db] bg-[#f8faf6] pl-10 pr-3 text-sm text-[#172216]"
            />
          </div>
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value)
              setPage(1)
            }}
            className="min-h-11 rounded-lg border border-[#dfe5db] bg-white px-3 text-sm text-[#172216]"
          >
            <option value="">{t('admin.signalements.allStatuses')}</option>
            {Object.entries(STATUS_META).map(([value, meta]) => (
              <option key={value} value={value}>{t(meta.labelKey)}</option>
            ))}
          </select>
        </div>

        {isLoading ? (
          <div className="flex min-h-72 items-center justify-center">
            <LoadingSpinner label={t('admin.signalements.loading')} />
          </div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-red-700">
            {t('admin.signalements.loadError')}
          </div>
        ) : list.items.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={Flag}
              title={t('admin.signalements.emptyTitle')}
              description={t('admin.signalements.emptyDesc')}
            />
          </div>
        ) : (
          <div className="divide-y divide-[#edf2ea]">
            {list.items.map((report: DoctorReport) => (
              <ReportRow
                key={report.id}
                report={report}
                onOpen={() => openDetail(report)}
              />
            ))}
          </div>
        )}

        {list.pages > 1 && (
          <div className="flex items-center justify-between border-t border-[#e3e7df] px-4 py-3">
            <p className="text-xs text-[#768172]">
              {t('admin.signalements.pageInfo', { total: list.total, page: list.page, pages: list.pages })}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-[#dfe5db] p-2 disabled:opacity-40"
                aria-label={t('admin.signalements.prevPage')}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(list.pages, current + 1))}
                disabled={page >= list.pages}
                className="rounded-lg border border-[#dfe5db] p-2 disabled:opacity-40"
                aria-label={t('admin.signalements.nextPage')}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

function ReportRow({ report, onOpen }: { report: DoctorReport; onOpen: () => void }) {
  const { t, i18n } = useTranslation()
  const status = STATUS_META[report.statut]
  const StatusIcon = status.icon

  return (
    <button
      type="button"
      onClick={onOpen}
      className="grid w-full gap-3 p-4 text-left transition hover:bg-[#f8faf6] sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_180px_120px] sm:items-center"
    >
      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={`${report.patient?.prenom ?? ''} ${report.patient?.nom ?? ''}`} size="sm" />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-[#172216]">
            {report.patient?.prenom} {report.patient?.nom}
          </p>
          <p className="truncate text-xs text-[#768172]">{report.patient?.email}</p>
        </div>
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-[#172216]">
          Dr {report.medecin?.prenom} {report.medecin?.nom}
        </p>
        <p className="truncate text-xs text-[#768172]">
          {MOTIF_LABELS[report.motif] ? t(MOTIF_LABELS[report.motif]) : report.motif}
        </p>
      </div>
      <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${status.className}`}>
        <StatusIcon className="h-3.5 w-3.5" />
        {t(status.labelKey)}
      </span>
      <span className="flex items-center justify-between gap-2 text-xs text-[#768172] sm:justify-end">
        {new Date(report.createdAt).toLocaleDateString(i18n.language?.startsWith('en') ? 'en-US' : 'fr-FR')}
        <Eye className="h-4 w-4" />
      </span>
    </button>
  )
}

function PersonBlock({
  title,
  person,
  doctor = false,
}: {
  title: string
  person?: Person | null
  doctor?: boolean
}) {
  return (
    <div className="border border-[#e3e7df] bg-[#f8faf6] p-4">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#7c8778]">{title}</p>
      <div className="mt-3 flex items-center gap-3">
        <Avatar name={`${person?.prenom ?? ''} ${person?.nom ?? ''}`} />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-[#172216]">
            {doctor ? 'Dr ' : ''}{person?.prenom} {person?.nom}
          </p>
          <p className="truncate text-xs text-[#768172]">{person?.email}</p>
          {doctor && person?.specialite && (
            <p className="truncate text-xs text-[#768172]">{person.specialite}</p>
          )}
        </div>
      </div>
    </div>
  )
}

function Metric({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: number
  tone?: 'neutral' | 'red' | 'amber' | 'green'
}) {
  const tones = {
    neutral: 'bg-white text-[#172216]',
    red: 'bg-red-50 text-red-700',
    amber: 'bg-amber-50 text-amber-800',
    green: 'bg-emerald-50 text-emerald-700',
  }

  return (
    <div className={`border border-[#e3e7df] p-4 ${tones[tone]}`}>
      <p className="text-xs font-bold uppercase tracking-[0.14em] opacity-65">{label}</p>
      <p className="mt-2 text-2xl font-extrabold">{value}</p>
    </div>
  )
}
