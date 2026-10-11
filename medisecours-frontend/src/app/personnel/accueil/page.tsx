'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, UserPlus, X } from 'lucide-react'
import api from '../../../api/axios'
import GlassCard from '../../../components/ui/GlassCard'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { useToast } from '../../../components/ui/Toast'

type PatientLite = { id: string; nom: string; prenom: string; email?: string; telephone?: string }

type VitalFields = {
  ageAns: string; poidsKg: string; tailleCm: string; temperatureC: string
  tensionArterialeGauche: string; tensionArterialeDroite: string
  poulsParMin: string; spo2: string; glycemieMmol: string; notes: string
}

const EMPTY_VITALS: VitalFields = {
  ageAns: '', poidsKg: '', tailleCm: '', temperatureC: '',
  tensionArterialeGauche: '', tensionArterialeDroite: '',
  poulsParMin: '', spo2: '', glycemieMmol: '', notes: '',
}

export default function PersonnelAccueilPage() {
  const { t } = useTranslation()
  const toast = useToast()

  const [query, setQuery] = useState('')
  const [patients, setPatients] = useState<PatientLite[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<PatientLite | null>(null)
  const [motifs, setMotifs] = useState('')
  const [vitals, setVitals] = useState<VitalFields>(EMPTY_VITALS)
  const [submitting, setSubmitting] = useState(false)
  const [lastResult, setLastResult] = useState<{ ouvert: boolean } | null>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback((value: string) => {
    setQuery(value)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (value.trim().length < 2) {
      setPatients([])
      return
    }
    setSearching(true)
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await api.get('/api/personnel/patients', { params: { q: value.trim() } })
        setPatients(res.data?.patients ?? [])
      } catch {
        setPatients([])
      } finally {
        setSearching(false)
      }
    }, 250)
  }, [])

  useEffect(() => () => { if (searchTimer.current) clearTimeout(searchTimer.current) }, [])

  const patchVital = (key: keyof VitalFields, value: string) => {
    setVitals((prev) => ({ ...prev, [key]: value }))
  }

  const numOrNull = (value: string) => (value.trim() === '' ? null : Number(value))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected) return
    setSubmitting(true)
    try {
      const payload: Record<string, unknown> = {
        patientId: selected.id,
        motifs: motifs.trim() || undefined,
        signesVitaux: {
          ageAns: numOrNull(vitals.ageAns),
          poidsKg: numOrNull(vitals.poidsKg),
          tailleCm: numOrNull(vitals.tailleCm),
          temperatureC: numOrNull(vitals.temperatureC),
          tensionArterialeGauche: vitals.tensionArterialeGauche.trim() || undefined,
          tensionArterialeDroite: vitals.tensionArterialeDroite.trim() || undefined,
          poulsParMin: numOrNull(vitals.poulsParMin),
          spo2: numOrNull(vitals.spo2),
          glycemieMmol: numOrNull(vitals.glycemieMmol),
          notes: vitals.notes.trim() || undefined,
        },
      }
      const res = await api.post('/api/personnel/dossiers', payload)
      const nouveau = res.data?.ouvert
      toast.success(nouveau ? t('personnel.accueil.dossierNouveau') : t('personnel.accueil.dossierExistant'))
      setLastResult({ ouvert: Boolean(nouveau) })
      setSelected(null)
      setQuery('')
      setPatients([])
      setMotifs('')
      setVitals(EMPTY_VITALS)
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? t('personnel.commun.erreur'))
    } finally {
      setSubmitting(false)
    }
  }

  const field = (id: string, label: string, key: keyof VitalFields, type = 'text', placeholder = '') => (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-[#374151] dark:text-[#D1D5DB]">
        {label}
      </label>
      <input
        id={id}
        type={type}
        step={type === 'number' ? 'any' : undefined}
        value={vitals[key]}
        onChange={(e) => patchVital(key, e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-[#0B1A33] dark:text-white"
      />
    </div>
  )

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <h2 className="font-display text-lg font-bold text-[#0F2C52] dark:text-white">
        {t('personnel.accueil.titre')}
      </h2>

      <GlassCard className="mt-5 p-5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" aria-hidden />
          <input
            value={query}
            onChange={(e) => search(e.target.value)}
            placeholder={t('personnel.accueil.rechercherPatient')}
            className="w-full rounded-lg border border-[#E5E7EB] bg-white py-2.5 pl-9 pr-3.5 text-sm dark:border-white/10 dark:bg-[#0B1A33] dark:text-white"
          />
        </div>
        {searching && <p className="mt-2 text-xs text-[#6B7280] dark:text-[#9CA3AF]">{t('personnel.commun.rechercheEnCours')}</p>}
        {!searching && query.trim().length >= 2 && patients.length === 0 && (
          <p className="mt-2 text-xs text-[#6B7280] dark:text-[#9CA3AF]">{t('personnel.accueil.aucunPatient')}</p>
        )}
        {patients.length > 0 && (
          <ul className="mt-3 divide-y divide-[#F3F4F6] dark:divide-white/5">
            {patients.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setSelected(p)}
                  className="flex w-full items-center justify-between px-1 py-2.5 text-left text-sm hover:bg-[#F9FAFB] dark:hover:bg-white/5"
                >
                  <span className="font-medium text-[#111827] dark:text-white">{p.prenom} {p.nom}</span>
                  <span className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">{p.telephone ?? p.email}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>

      {selected && (
        <form onSubmit={submit} className="mt-5">
          <GlassCard className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0F2C52] text-sm font-bold text-white dark:bg-mint-600">
                  {selected.prenom?.[0]}{selected.nom?.[0]}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#111827] dark:text-white">{selected.prenom} {selected.nom}</p>
                  <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">{selected.telephone ?? selected.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg p-1.5 text-[#9CA3AF] hover:bg-[#F3F4F6] dark:hover:bg-white/5"
                aria-label={t('personnel.commun.fermer')}
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <div className="mt-5">
              <label htmlFor="motifs" className="mb-1 block text-xs font-medium text-[#374151] dark:text-[#D1D5DB]">
                {t('personnel.accueil.motifs')}
              </label>
              <input
                id="motifs"
                value={motifs}
                onChange={(e) => setMotifs(e.target.value)}
                className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-[#0B1A33] dark:text-white"
              />
            </div>

            <h3 className="mt-5 font-display text-sm font-bold text-[#0F2C52] dark:text-white">
              {t('personnel.accueil.signesVitaux')}
            </h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {field('v-age', t('personnel.accueil.ageAns'), 'ageAns', 'number')}
              {field('v-poids', t('personnel.accueil.poids'), 'poidsKg', 'number')}
              {field('v-taille', t('personnel.accueil.taille'), 'tailleCm', 'number')}
              {field('v-temp', t('personnel.accueil.temperature'), 'temperatureC', 'number')}
              {field('v-tag', t('personnel.accueil.taGauche'), 'tensionArterialeGauche', 'text', '120/80')}
              {field('v-tad', t('personnel.accueil.taDroite'), 'tensionArterialeDroite', 'text', '120/80')}
              {field('v-pouls', t('personnel.accueil.pouls'), 'poulsParMin', 'number')}
              {field('v-spo2', t('personnel.accueil.spo2'), 'spo2', 'number')}
              {field('v-gly', t('personnel.accueil.glycemie'), 'glycemieMmol', 'number')}
            </div>
            <div className="mt-3">
              <label htmlFor="v-notes" className="mb-1 block text-xs font-medium text-[#374151] dark:text-[#D1D5DB]">
                {t('personnel.accueil.notes')}
              </label>
              <textarea
                id="v-notes"
                rows={2}
                value={vitals.notes}
                onChange={(e) => patchVital('notes', e.target.value)}
                className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-[#0B1A33] dark:text-white"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-[#0F2C52] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#16395F] disabled:opacity-60 dark:bg-mint-600"
            >
              {submitting ? <LoadingSpinner size="sm" /> : <UserPlus className="h-4 w-4" aria-hidden />}
              {t('personnel.accueil.admettre')}
            </button>
          </GlassCard>
        </form>
      )}

      {lastResult && !selected && (
        <p className="mt-4 rounded-lg bg-mint-50 px-3 py-2 text-sm text-mint-700 dark:bg-mint-500/10 dark:text-mint-400">
          {t('personnel.accueil.admissionOk')} {lastResult.ouvert ? t('personnel.accueil.dossierNouveau') : t('personnel.accueil.dossierExistant')}
        </p>
      )}
    </div>
  )
}
