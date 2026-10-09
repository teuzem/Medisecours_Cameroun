'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import api from '../../api/axios'

interface Affiliation {
  id: number
  statut: string
  fonction: string | null
  teleconsultation: boolean
  createdAt: string
  etablissement: { id: number; nom: string; ville: string | null } | null
}

const STATUT_COULEUR: Record<string, string> = {
  EN_ATTENTE: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
  ACCEPTEE: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
  REFUSEE: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30',
  SUSPENDUE: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-white/10 dark:text-slate-300 dark:border-white/15',
}

/**
 * Tableau de bord médecin — mes affiliations d'établissements :
 * demandes en attente, affiliations actives, retirer une demande.
 */
export default function AffiliationsCard() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'en' ? 'en-GB' : 'fr-FR'

  const [items, setItems] = useState<Affiliation[]>([])
  const [loading, setLoading] = useState(true)
  const [erreur, setErreur] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; texte: string } | null>(null)

  const charger = useCallback(async () => {
    try {
      const { data } = await api.get('/api/medecin/affiliations')
      setItems(Array.isArray(data?.affiliations) ? data.affiliations : [])
      setErreur(false)
    } catch {
      setErreur(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void charger()
  }, [charger])

  const retirer = async (affiliation: Affiliation) => {
    setBusyId(affiliation.id)
    setMessage(null)
    try {
      await api.delete(`/api/affiliation_medecins/${affiliation.id}`)
      setMessage({ type: 'ok', texte: t('medecin.affiliations.retireOk') })
      await charger()
    } catch (err: any) {
      const data = err?.response?.data
      setMessage({
        type: 'err',
        texte: data?.detail || data?.message || data?.error || t('medecin.affiliations.actionErreur'),
      })
    } finally {
      setBusyId(null)
    }
  }

  const dateCourte = (iso: string): string => {
    try {
      return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(iso))
    } catch {
      return new Date(iso).toLocaleDateString(locale)
    }
  }

  return (
    <div className="dashboard-panel rounded-xl p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white">
            <Building2 className="h-[18px] w-[18px]" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-[#0F2C52] dark:text-white">
              {t('medecin.affiliations.titre')}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('medecin.affiliations.intro')}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void charger()}
          aria-label={t('sos.actualiser')}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:bg-slate-50 hover:text-slate-700 dark:border-white/10 dark:hover:bg-white/5 dark:hover:text-white"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {message && (
        <div
          role={message.type === 'ok' ? 'status' : 'alert'}
          className={`mb-4 flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold ${
            message.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400'
              : 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400'
          }`}
        >
          {message.type === 'ok' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
          {message.texte}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('medecin.affiliations.chargement')}
        </div>
      ) : erreur ? (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs font-semibold text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {t('medecin.affiliations.erreurChargement')}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 py-8 text-center dark:border-white/10">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-white/5 dark:text-slate-500">
            <Building2 className="h-5 w-5" />
          </span>
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{t('medecin.affiliations.aucune')}</p>
          <p className="max-w-sm text-xs text-slate-500 dark:text-slate-400">{t('medecin.affiliations.aucuneDesc')}</p>
          <Link
            href="/carte"
            className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-blue-700"
          >
            <Plus className="h-3.5 w-3.5" />
            {t('medecin.affiliations.rejoindre')}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : (
        <>
          <ul className="space-y-2.5">
            {items.map((aff) => (
              <li
                key={aff.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5 dark:border-white/10 dark:bg-slate-900/60"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400">
                  <Building2 className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">
                      {aff.etablissement?.nom ?? '—'}
                    </p>
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        STATUT_COULEUR[aff.statut] ?? STATUT_COULEUR.SUSPENDUE
                      }`}
                    >
                      {t(`affiliation.statut.${aff.statut}`)}
                    </span>
                  </div>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    {aff.etablissement?.ville && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {aff.etablissement.ville}
                      </span>
                    )}
                    {aff.fonction && <span>{aff.fonction}</span>}
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {dateCourte(aff.createdAt)}
                    </span>
                  </p>
                </div>

                {aff.statut !== 'ACCEPTEE' && (
                  <button
                    type="button"
                    onClick={() => void retirer(aff)}
                    disabled={busyId === aff.id}
                    title={t('medecin.affiliations.retirer')}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:border-white/10 dark:hover:bg-red-500/10"
                  >
                    {busyId === aff.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                )}
              </li>
            ))}
          </ul>

          <Link
            href="/carte"
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:underline dark:text-blue-400"
          >
            <Plus className="h-3.5 w-3.5" />
            {t('medecin.affiliations.rejoindre')}
            <ArrowRight className="h-3 w-3" />
          </Link>
        </>
      )}
    </div>
  )
}
