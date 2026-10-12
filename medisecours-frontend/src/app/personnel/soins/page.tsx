'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Activity, Plus, X } from 'lucide-react'
import api from '../../../api/axios'
import GlassCard from '../../../components/ui/GlassCard'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import Modal from '../../../components/ui/Modal'
import SignaturePad from '../../../components/ui/SignaturePad'
import { useToast } from '../../../components/ui/Toast'
import { useMySignature } from '../../../lib/documentSeals'

type Soin = {
  id: number
  libelle: string
  details?: string | null
  statut: string
  dossierId?: number | null
  dossierNumero?: string | null
  patient?: { id: string; nom: string; prenom: string } | null
  infirmier?: { nom?: string; prenom?: string; type?: string } | null
  signatureHash?: string | null
  createdAt: string
  realisedAt?: string | null
  ordonnanceId?: number | null
}

const STATUT_BADGE: Record<string, { bg: string; text: string }> = {
  PLANIFIE: { bg: 'bg-amber-50 dark:bg-amber-500/10', text: 'text-amber-700 dark:text-amber-400' },
  EN_COURS: { bg: 'bg-[#E0F2FE] dark:bg-sky-500/10', text: 'text-sky-700 dark:text-sky-400' },
  REALISE: { bg: 'bg-mint-50 dark:bg-mint-500/10', text: 'text-mint-700 dark:text-mint-400' },
  ANNULE: { bg: 'bg-[#F3F4F6] dark:bg-white/5', text: 'text-[#6B7280] dark:text-[#9CA3AF]' },
}

export default function PersonnelSoinsPage() {
  const { t } = useTranslation()
  const toast = useToast()
  // Signature enregistrée du soignant (paramètres) : pré-remplit le pad de
  // signature de l'acte pour une non-répudiation sans ressaisie.
  const { signature: registeredSignature } = useMySignature()

  const [soins, setSoins] = useState<Soin[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [libelle, setLibelle] = useState('')
  const [details, setDetails] = useState('')
  const [dossierId, setDossierId] = useState('')
  const [ordonnanceId, setOrdonnanceId] = useState('')
  const [creating, setCreating] = useState(false)

  const [realiseFor, setRealiseFor] = useState<Soin | null>(null)
  const [signature, setSignature] = useState('')
  const [observations, setObservations] = useState('')
  const [realising, setRealising] = useState(false)

  const load = useCallback((statut: string) => {
    api.get('/api/personnel/soins', { params: statut ? { statut } : {} })
      .then((res) => setSoins(res.data?.soins ?? []))
      .catch(() => setSoins([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load(filter)
  }, [load, filter])

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    try {
      await api.post('/api/personnel/soins', {
        libelle: libelle.trim(),
        details: details.trim() || undefined,
        dossierId: Number(dossierId),
        ordonnanceId: ordonnanceId.trim() ? Number(ordonnanceId) : undefined,
      })
      toast.success(t('personnel.soins.planifieOk'))
      setCreateOpen(false)
      setLibelle('')
      setDetails('')
      setDossierId('')
      setOrdonnanceId('')
      load(filter)
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? t('personnel.commun.erreur'))
    } finally {
      setCreating(false)
    }
  }

  const realiser = async () => {
    if (!realiseFor) return
    if (!signature) {
      toast.error(t('personnel.soins.erreurSignature'))
      return
    }
    setRealising(true)
    try {
      await api.post(`/api/personnel/soins/${realiseFor.id}/realiser`, {
        signatureImage: signature,
        observations: observations.trim() || undefined,
      })
      toast.success(t('personnel.soins.realiseOk'))
      setRealiseFor(null)
      setSignature('')
      setObservations('')
      load(filter)
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? t('personnel.commun.erreur'))
    } finally {
      setRealising(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-[#0F2C52] dark:text-white">{t('personnel.soins.titre')}</h2>
          <p className="mt-1 text-sm text-[#6B7280] dark:text-[#9CA3AF]">{t('personnel.soins.intro')}</p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-[#0F2C52] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#16395F] dark:bg-mint-600"
        >
          <Plus className="h-4 w-4" aria-hidden />
          {t('personnel.soins.nouveau')}
        </button>
      </div>

      <div className="mt-4">
        <label htmlFor="soins-filter" className="mb-1.5 block text-xs font-medium text-[#374151] dark:text-[#D1D5DB]">
          {t('personnel.soins.filtrer')}
        </label>
        <select
          id="soins-filter"
          value={filter}
          onChange={(e) => { setLoading(true); setFilter(e.target.value) }}
          className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-[#0B1A33] dark:text-white"
        >
          <option value="">{t('personnel.soins.tous')}</option>
          <option value="PLANIFIE">{t('personnel.soins.statuts.PLANIFIE')}</option>
          <option value="REALISE">{t('personnel.soins.statuts.REALISE')}</option>
          <option value="ANNULE">{t('personnel.soins.statuts.ANNULE')}</option>
        </select>
      </div>

      <GlassCard className="mt-4 p-2">
        {loading ? (
          <div className="py-10"><LoadingSpinner /></div>
        ) : soins.length === 0 ? (
          <p className="py-10 text-center text-sm text-[#6B7280] dark:text-[#9CA3AF]">{t('personnel.soins.aucun')}</p>
        ) : (
          <ul className="divide-y divide-[#F3F4F6] dark:divide-white/5">
            {soins.map((soin) => {
              const badge = STATUT_BADGE[soin.statut] ?? STATUT_BADGE.PLANIFIE
              return (
                <li key={soin.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-semibold text-[#111827] dark:text-white">
                      <Activity className="h-4 w-4 shrink-0 text-[#9CA3AF]" aria-hidden />
                      {soin.libelle}
                    </p>
                    <p className="mt-0.5 text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                      {soin.patient ? `${soin.patient.prenom} ${soin.patient.nom}` : ''}
                      {soin.dossierNumero ? ` · ${soin.dossierNumero}` : ''}
                      {soin.realisedAt ? ` · ${new Date(soin.realisedAt).toLocaleDateString()}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge.bg} ${badge.text}`}>
                      {t(`personnel.soins.statuts.${soin.statut}`)}
                    </span>
                    {soin.statut === 'PLANIFIE' && (
                      <button
                        type="button"
                        onClick={() => { setRealiseFor(soin); setSignature(registeredSignature?.imageData ?? ''); setObservations('') }}
                        className="rounded-lg bg-[#0F2C52] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#16395F] dark:bg-mint-600"
                      >
                        {t('personnel.soins.realiser')}
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </GlassCard>

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title={t('personnel.soins.nouveau')}>
        <form onSubmit={create} className="space-y-4">
          <div>
            <label htmlFor="soin-libelle" className="mb-1 block text-xs font-medium text-[#374151] dark:text-[#D1D5DB]">
              {t('personnel.soins.libelle')}
            </label>
            <input
              id="soin-libelle"
              required
              value={libelle}
              onChange={(e) => setLibelle(e.target.value)}
              className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-[#0B1A33] dark:text-white"
            />
          </div>
          <div>
            <label htmlFor="soin-dossier" className="mb-1 block text-xs font-medium text-[#374151] dark:text-[#D1D5DB]">
              {t('personnel.soins.lierDossier')}
            </label>
            <input
              id="soin-dossier"
              required
              type="number"
              min={1}
              value={dossierId}
              onChange={(e) => setDossierId(e.target.value)}
              className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-[#0B1A33] dark:text-white"
            />
          </div>
          <div>
            <label htmlFor="soin-ord" className="mb-1 block text-xs font-medium text-[#374151] dark:text-[#D1D5DB]">
              {t('personnel.soins.lierOrdonnance')}
            </label>
            <input
              id="soin-ord"
              type="number"
              min={1}
              value={ordonnanceId}
              onChange={(e) => setOrdonnanceId(e.target.value)}
              className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-[#0B1A33] dark:text-white"
            />
          </div>
          <div>
            <label htmlFor="soin-details" className="mb-1 block text-xs font-medium text-[#374151] dark:text-[#D1D5DB]">
              {t('personnel.soins.details')}
            </label>
            <textarea
              id="soin-details"
              rows={3}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-[#0B1A33] dark:text-white"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="rounded-lg border border-[#E5E7EB] px-4 py-2 text-sm font-semibold text-[#6B7280] hover:bg-[#F3F4F6] dark:border-white/10 dark:text-[#9CA3AF]"
            >
              {t('personnel.commun.annuler')}
            </button>
            <button
              type="submit"
              disabled={creating}
              className="rounded-lg bg-[#0F2C52] px-4 py-2 text-sm font-semibold text-white hover:bg-[#16395F] disabled:opacity-60 dark:bg-mint-600"
            >
              {creating ? <LoadingSpinner size="sm" /> : t('personnel.soins.planifier')}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(realiseFor)}
        onClose={() => setRealiseFor(null)}
        title={`${t('personnel.soins.signatureTitre')} — ${realiseFor?.libelle ?? ''}`}
      >
        <div className="space-y-4">
          <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">{t('personnel.soins.signatureIntro')}</p>
          <div>
            <label htmlFor="soin-obs" className="mb-1 block text-xs font-medium text-[#374151] dark:text-[#D1D5DB]">
              {t('personnel.soins.observations')}
            </label>
            <textarea
              id="soin-obs"
              rows={2}
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-[#0B1A33] dark:text-white"
            />
          </div>
          <SignaturePad value={signature} onChange={setSignature} />
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setRealiseFor(null)}
              className="rounded-lg border border-[#E5E7EB] px-4 py-2 text-sm font-semibold text-[#6B7280] hover:bg-[#F3F4F6] dark:border-white/10 dark:text-[#9CA3AF]"
            >
              {t('personnel.commun.annuler')}
            </button>
            <button
              type="button"
              onClick={realiser}
              disabled={realising || !signature}
              className="flex items-center gap-2 rounded-lg bg-[#0F2C52] px-4 py-2 text-sm font-semibold text-white hover:bg-[#16395F] disabled:opacity-60 dark:bg-mint-600"
            >
              {realising ? <LoadingSpinner size="sm" /> : <X className="hidden" aria-hidden />}
              {t('personnel.soins.confirmerRealisation')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
