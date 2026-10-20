'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Package } from 'lucide-react'
import api from '../../../api/axios'
import GlassCard from '../../../components/ui/GlassCard'
import PosteIndicateurs from '../components/PosteIndicateurs'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import Modal from '../../../components/ui/Modal'
import { useToast } from '../../../components/ui/Toast'

type Ordonnance = {
  id: number
  statut: string
  montantTotal?: number | null
  cancelMotif?: string | null
  prescription?: {
    id: number
    diagnostic?: string
    recommandations?: string
    medecin?: { nom?: string; prenom?: string; specialite?: string } | null
  } | null
  patient?: { id: string; nom: string; prenom: string; telephone?: string } | null
  factureLe?: string | null
  payeLe?: string | null
  createdAt: string
}

const STATUT_BADGE: Record<string, { bg: string; text: string }> = {
  RECUE: { bg: 'bg-amber-50 dark:bg-amber-500/10', text: 'text-amber-700 dark:text-amber-400' },
  FACTUREE: { bg: 'bg-[#E0F2FE] dark:bg-sky-500/10', text: 'text-sky-700 dark:text-sky-400' },
  PAYEE: { bg: 'bg-mint-50 dark:bg-mint-500/10', text: 'text-mint-700 dark:text-mint-400' },
  A_ADMINISTRER: { bg: 'bg-violet-50 dark:bg-violet-500/10', text: 'text-violet-700 dark:text-violet-400' },
  ADMINISTREE: { bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-400' },
  ANNULEE: { bg: 'bg-[#F3F4F6] dark:bg-white/5', text: 'text-[#6B7280] dark:text-[#9CA3AF]' },
}

export default function PersonnelPharmaciePage() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'en' ? 'en-GB' : 'fr-FR'
  const toast = useToast()

  const [ordonnances, setOrdonnances] = useState<Ordonnance[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  const [factureFor, setFactureFor] = useState<Ordonnance | null>(null)
  const [montant, setMontant] = useState('')
  const [busy, setBusy] = useState(false)
  const [annuleFor, setAnnuleFor] = useState<Ordonnance | null>(null)
  const [motif, setMotif] = useState('')

  const load = useCallback((statut: string) => {
    api.get('/api/personnel/pharmacie/ordonnances', { params: statut ? { statut } : {} })
      .then((res) => setOrdonnances(res.data?.ordonnances ?? []))
      .catch(() => setOrdonnances([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load(filter)
  }, [load, filter])

  const facturer = async () => {
    if (!factureFor) return
    const value = Number(montant)
    if (!Number.isFinite(value) || value < 0) {
      toast.error(t('personnel.commun.erreur'))
      return
    }
    setBusy(true)
    try {
      await api.post(`/api/personnel/pharmacie/ordonnances/${factureFor.id}/facturer`, { montantTotal: value })
      toast.success(t('personnel.pharmacie.factureOk'))
      setFactureFor(null)
      setMontant('')
      load(filter)
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? t('personnel.commun.erreur'))
    } finally {
      setBusy(false)
    }
  }

  const payer = async (o: Ordonnance) => {
    setBusy(true)
    try {
      await api.post(`/api/personnel/pharmacie/ordonnances/${o.id}/payer`)
      toast.success(t('personnel.pharmacie.payeOk'))
      load(filter)
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? t('personnel.commun.erreur'))
    } finally {
      setBusy(false)
    }
  }

  const preparer = async (o: Ordonnance) => {
    setBusy(true)
    try {
      await api.post(`/api/personnel/pharmacie/ordonnances/${o.id}/administrer`)
      toast.success(t('personnel.pharmacie.administrerOk'))
      load(filter)
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? t('personnel.commun.erreur'))
    } finally {
      setBusy(false)
    }
  }

  const annuler = async () => {
    if (!annuleFor || !motif.trim()) return
    setBusy(true)
    try {
      await api.post(`/api/personnel/pharmacie/ordonnances/${annuleFor.id}/annuler`, { motif: motif.trim() })
      toast.success(t('personnel.pharmacie.annuleeOk'))
      setAnnuleFor(null)
      setMotif('')
      load(filter)
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? t('personnel.commun.erreur'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
      <div>
        <h2 className="font-display text-lg font-bold text-[#0F2C52] dark:text-white">{t('personnel.pharmacie.titre')}</h2>
        <p className="mt-1 text-sm text-[#6B7280] dark:text-[#9CA3AF]">{t('personnel.pharmacie.intro')}</p>
      </div>

      <PosteIndicateurs />

      <div className="mt-4">
        <label htmlFor="pharm-filter" className="mb-1.5 block text-xs font-medium text-[#374151] dark:text-[#D1D5DB]">
          {t('personnel.pharmacie.filtrer')}
        </label>
        <select
          id="pharm-filter"
          value={filter}
          onChange={(e) => { setLoading(true); setFilter(e.target.value) }}
          className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-[#0B1A33] dark:text-white"
        >
          <option value="">{t('personnel.pharmacie.tous')}</option>
          {['RECUE', 'FACTUREE', 'PAYEE', 'A_ADMINISTRER', 'ADMINISTREE', 'ANNULEE'].map((s) => (
            <option key={s} value={s}>{t(`personnel.pharmacie.statuts.${s}`)}</option>
          ))}
        </select>
      </div>

      <GlassCard className="mt-4 p-2">
        {loading ? (
          <div className="py-10"><LoadingSpinner /></div>
        ) : ordonnances.length === 0 ? (
          <p className="py-10 text-center text-sm text-[#6B7280] dark:text-[#9CA3AF]">{t('personnel.pharmacie.aucune')}</p>
        ) : (
          <ul className="divide-y divide-[#F3F4F6] dark:divide-white/5">
            {ordonnances.map((o) => {
              const badge = STATUT_BADGE[o.statut] ?? STATUT_BADGE.RECUE
              return (
                <li key={o.id} className="px-3 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-semibold text-[#111827] dark:text-white">
                        <Package className="h-4 w-4 shrink-0 text-[#9CA3AF]" aria-hidden />
                        {o.patient ? `${o.patient.prenom} ${o.patient.nom}` : `#${o.id}`}
                      </p>
                      {o.prescription?.diagnostic && (
                        <p className="mt-0.5 text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                          {t('personnel.pharmacie.diagnostic')} : {o.prescription.diagnostic}
                        </p>
                      )}
                      {o.prescription?.medecin && (
                        <p className="mt-0.5 text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                          {t('personnel.pharmacie.medecin')} : {o.prescription.medecin.prenom} {o.prescription.medecin.nom}
                        </p>
                      )}
                      {o.montantTotal != null && (
                        <p className="mt-0.5 text-xs font-semibold text-[#111827] dark:text-white">
                          {Number(o.montantTotal).toLocaleString('fr-FR')} FCFA
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge.bg} ${badge.text}`}>
                        {t(`personnel.pharmacie.statuts.${o.statut}`)}
                      </span>
                      {o.statut === 'RECUE' && (
                        <button
                          type="button"
                          onClick={() => { setFactureFor(o); setMontant('') }}
                          className="rounded-lg bg-[#0F2C52] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#16395F] dark:bg-mint-600"
                        >
                          {t('personnel.pharmacie.facturer')}
                        </button>
                      )}
                      {o.statut === 'FACTUREE' && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => payer(o)}
                          className="rounded-lg bg-mint-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-mint-500 disabled:opacity-60"
                        >
                          {t('personnel.pharmacie.payer')}
                        </button>
                      )}
                      {o.statut === 'PAYEE' && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => preparer(o)}
                          className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-60"
                        >
                          {t('personnel.pharmacie.administrer')}
                        </button>
                      )}
                      {['RECUE', 'FACTUREE', 'PAYEE', 'A_ADMINISTRER'].includes(o.statut) && (
                        <button
                          type="button"
                          onClick={() => { setAnnuleFor(o); setMotif('') }}
                          className="rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-xs font-semibold text-[#6B7280] hover:bg-[#F3F4F6] dark:border-white/10 dark:text-[#9CA3AF]"
                        >
                          {t('personnel.pharmacie.annuler')}
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </GlassCard>

      <Modal isOpen={Boolean(factureFor)} onClose={() => setFactureFor(null)} title={t('personnel.pharmacie.facturer')}>
        <div className="space-y-4">
          <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
            {factureFor?.patient ? `${factureFor.patient.prenom} ${factureFor.patient.nom}` : ''}
          </p>
          <div>
            <label htmlFor="pharm-montant" className="mb-1 block text-xs font-medium text-[#374151] dark:text-[#D1D5DB]">
              {t('personnel.pharmacie.montant')}
            </label>
            <input
              id="pharm-montant"
              type="number"
              min={0}
              required
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
              className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-[#0B1A33] dark:text-white"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setFactureFor(null)}
              className="rounded-lg border border-[#E5E7EB] px-4 py-2 text-sm font-semibold text-[#6B7280] hover:bg-[#F3F4F6] dark:border-white/10 dark:text-[#9CA3AF]"
            >
              {t('personnel.commun.annuler')}
            </button>
            <button
              type="button"
              onClick={facturer}
              disabled={busy || montant.trim() === ''}
              className="rounded-lg bg-[#0F2C52] px-4 py-2 text-sm font-semibold text-white hover:bg-[#16395F] disabled:opacity-60 dark:bg-mint-600"
            >
              {busy ? <LoadingSpinner size="sm" /> : t('personnel.pharmacie.facturer')}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={Boolean(annuleFor)} onClose={() => setAnnuleFor(null)} title={t('personnel.pharmacie.annuler')}>
        <div className="space-y-4">
          <div>
            <label htmlFor="pharm-motif" className="mb-1 block text-xs font-medium text-[#374151] dark:text-[#D1D5DB]">
              {t('personnel.pharmacie.motif')}
            </label>
            <textarea
              id="pharm-motif"
              rows={3}
              required
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-[#0B1A33] dark:text-white"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setAnnuleFor(null)}
              className="rounded-lg border border-[#E5E7EB] px-4 py-2 text-sm font-semibold text-[#6B7280] hover:bg-[#F3F4F6] dark:border-white/10 dark:text-[#9CA3AF]"
            >
              {t('personnel.commun.annuler')}
            </button>
            <button
              type="button"
              onClick={annuler}
              disabled={busy || !motif.trim()}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-60"
            >
              {busy ? <LoadingSpinner size="sm" /> : t('personnel.pharmacie.annuler')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
