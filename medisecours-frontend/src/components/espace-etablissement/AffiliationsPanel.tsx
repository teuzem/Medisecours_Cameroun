'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  Loader2,
  Mail,
  Phone,
  RefreshCw,
  ShieldCheck,
  Stethoscope,
  UserRound,
  UserRoundCheck,
  UserRoundX,
  XCircle,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import api from '../../api/axios'

interface AffiliationMedecinItem {
  id: number
  statut: string
  fonction: string | null
  salle: string | null
  teleconsultation: boolean
  createdAt: string
  updatedAt: string | null
  medecin: {
    id: string
    nom: string | null
    prenom: string | null
    specialite: string | null
    telephone: string | null
    email: string | null
    estValide: boolean
  } | null
  etablissement: { id: number; nom: string; ville: string | null } | null
}

type Onglet = 'EN_ATTENTE' | 'ACCEPTEE' | 'AUTRES'

const STATUT_COULEUR: Record<string, string> = {
  EN_ATTENTE: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
  ACCEPTEE: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
  REFUSEE: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30',
  SUSPENDUE: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-white/10 dark:text-slate-300 dark:border-white/15',
}

function initiales(prenom: string | null, nom: string | null): string {
  return `${(prenom ?? '').charAt(0)}${(nom ?? '').charAt(0)}`.toUpperCase() || '?'
}

function heureDate(iso: string | null, locale: string): string {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(iso))
  } catch {
    return new Date(iso).toLocaleDateString(locale)
  }
}

/* ──────────────────────────────────────────────────────────────────────────
 * Affiliations d'un établissement : demandes EN_ATTENTE à instruire,
 * médecins acceptés à suspendre/réactiver. Décisions via
 * POST /api/affiliation_medecins/{id}/decision (habilitation manager).
 * ────────────────────────────────────────────────────────────────────────── */
export default function AffiliationsPanel({ centreId }: { centreId: number }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'en' ? 'en-GB' : 'fr-FR'

  const [items, setItems] = useState<AffiliationMedecinItem[]>([])
  const [loading, setLoading] = useState(true)
  const [erreur, setErreur] = useState(false)
  const [onglet, setOnglet] = useState<Onglet>('EN_ATTENTE')
  const [busyId, setBusyId] = useState<number | null>(null)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; texte: string } | null>(null)

  const charger = useCallback(async () => {
    try {
      const { data } = await api.get('/api/etablissement/affiliations', {
        params: { centre: centreId },
      })
      setItems(Array.isArray(data?.affiliations) ? data.affiliations : [])
      setErreur(false)
    } catch {
      setErreur(true)
    } finally {
      setLoading(false)
    }
  }, [centreId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems([])
    setLoading(true)
    void charger()
  }, [charger])

  const decision = async (affiliation: AffiliationMedecinItem, statut: 'ACCEPTEE' | 'REFUSEE' | 'SUSPENDUE') => {
    setBusyId(affiliation.id)
    setMessage(null)
    try {
      await api.post(`/api/affiliation_medecins/${affiliation.id}/decision`, { statut })
      setMessage({ type: 'ok', texte: t('etablissement.affiliations.decisionOk') })
      await charger()
    } catch (err: any) {
      const data = err?.response?.data
      setMessage({
        type: 'err',
        texte: data?.detail || data?.message || t('etablissement.affiliations.decisionErreur'),
      })
    } finally {
      setBusyId(null)
    }
  }

  const attente = useMemo(() => items.filter((i) => i.statut === 'EN_ATTENTE'), [items])
  const acceptees = useMemo(() => items.filter((i) => i.statut === 'ACCEPTEE'), [items])
  const autres = useMemo(() => items.filter((i) => i.statut === 'REFUSEE' || i.statut === 'SUSPENDUE'), [items])

  const visibles = onglet === 'EN_ATTENTE' ? attente : onglet === 'ACCEPTEE' ? acceptees : autres

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('etablissement.affiliations.chargement')}
      </div>
    )
  }

  if (erreur) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <AlertTriangle className="h-8 w-8 text-amber-500" />
        <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
          {t('etablissement.affiliations.erreurChargement')}
        </p>
        <button
          type="button"
          onClick={() => { setLoading(true); void charger() }}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white dark:bg-white dark:text-slate-900"
        >
          {t('sos.actualiser')}
        </button>
      </div>
    )
  }

  const onglets: { id: Onglet; label: string; count: number; ton: string }[] = [
    { id: 'EN_ATTENTE', label: t('etablissement.affiliations.tabAttente'), count: attente.length, ton: 'amber' },
    { id: 'ACCEPTEE', label: t('etablissement.affiliations.tabAcceptees'), count: acceptees.length, ton: 'emerald' },
    { id: 'AUTRES', label: t('etablissement.affiliations.tabAutres'), count: autres.length, ton: 'slate' },
  ]

  return (
    <div>
      {/* ── En-tête ── */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
          <UserRoundCheck className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-base font-bold text-slate-950 dark:text-white">
            {t('etablissement.affiliations.titre')}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">{t('etablissement.affiliations.intro')}</p>
        </div>
        <button
          type="button"
          onClick={() => void charger()}
          aria-label={t('sos.actualiser')}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {message && (
        <div
          role={message.type === 'ok' ? 'status' : 'alert'}
          className={`mb-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${
            message.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400'
              : 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400'
          }`}
        >
          {message.type === 'ok' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
          {message.texte}
        </div>
      )}

      {/* ── Onglets ── */}
      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label={t('etablissement.affiliations.titre')}>
        {onglets.map((o) => (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={onglet === o.id}
            onClick={() => setOnglet(o.id)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
              onglet === o.id
                ? 'bg-slate-900 text-white shadow dark:bg-white dark:text-slate-900'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/15'
            }`}
          >
            {o.label}
            <span
              className={`rounded-full px-1.5 text-[10px] font-black ${
                onglet === o.id
                  ? 'bg-white/20 text-white dark:bg-slate-900/15 dark:text-slate-900'
                  : o.ton === 'amber'
                    ? 'bg-amber-200 text-amber-800 dark:bg-amber-500/25 dark:text-amber-300'
                    : o.ton === 'emerald'
                      ? 'bg-emerald-200 text-emerald-800 dark:bg-emerald-500/25 dark:text-emerald-300'
                      : 'bg-slate-300 text-slate-700 dark:bg-white/15 dark:text-slate-300'
              }`}
            >
              {o.count}
            </span>
          </button>
        ))}
      </div>

      {/* ── Liste ── */}
      {visibles.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-200 py-12 text-center dark:border-white/10">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-white/5 dark:text-slate-500">
            <Stethoscope className="h-6 w-6" />
          </span>
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
            {onglet === 'EN_ATTENTE'
              ? t('etablissement.affiliations.aucuneAttente')
              : onglet === 'ACCEPTEE'
                ? t('etablissement.affiliations.aucuneAcceptee')
                : t('etablissement.affiliations.aucuneAutres')}
          </p>
          <p className="max-w-sm text-xs text-slate-500 dark:text-slate-400">
            {onglet === 'EN_ATTENTE'
              ? t('etablissement.affiliations.aucuneAttenteDesc')
              : onglet === 'ACCEPTEE'
                ? t('etablissement.affiliations.aucuneAccepteeDesc')
                : t('etablissement.affiliations.aucuneAutresDesc')}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {visibles.map((aff) => {
            const m = aff.medecin
            return (
              <li
                key={aff.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 transition dark:border-white/10 dark:bg-slate-900"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-black text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                    {initiales(m?.prenom, m?.nom)}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-slate-900 dark:text-white">
                        {m ? `Dr ${m.prenom ?? ''} ${m.nom ?? ''}`.trim() : t('etablissement.affiliations.medecinInconnu')}
                      </p>
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                          STATUT_COULEUR[aff.statut] ?? STATUT_COULEUR.SUSPENDUE
                        }`}
                      >
                        {t(`affiliation.statut.${aff.statut}`)}
                      </span>
                      {m && !m.estValide && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                          <AlertTriangle className="h-3 w-3" />
                          {t('etablissement.affiliations.profilsNonValides')}
                        </span>
                      )}
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                      {aff.fonction && (
                        <span className="inline-flex items-center gap-1">
                          <Stethoscope className="h-3.5 w-3.5" />
                          {aff.fonction}
                        </span>
                      )}
                      {m?.specialite && (
                        <span className="inline-flex items-center gap-1">
                          <BadgeCheck className="h-3.5 w-3.5" />
                          {m.specialite}
                        </span>
                      )}
                      {m?.telephone && (
                        <a href={`tel:${m.telephone}`} className="inline-flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400">
                          <Phone className="h-3.5 w-3.5" />
                          {m.telephone}
                        </a>
                      )}
                      {m?.email && (
                        <span className="inline-flex min-w-0 items-center gap-1">
                          <Mail className="h-3.5 w-3.5" />
                          <span className="truncate">{m.email}</span>
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock className="h-3.5 w-3.5" />
                        {t('etablissement.affiliations.depuis', { date: heureDate(aff.createdAt, locale) })}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {aff.statut === 'EN_ATTENTE' && (
                        <>
                          <button
                            type="button"
                            onClick={() => void decision(aff, 'ACCEPTEE')}
                            disabled={busyId === aff.id}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
                          >
                            {busyId === aff.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                            {t('etablissement.affiliations.accepter')}
                          </button>
                          <button
                            type="button"
                            onClick={() => void decision(aff, 'REFUSEE')}
                            disabled={busyId === aff.id}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-100 disabled:opacity-60 dark:border-white/15 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            {busyId === aff.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                            {t('etablissement.affiliations.refuser')}
                          </button>
                        </>
                      )}

                      {aff.statut === 'ACCEPTEE' && (
                        <button
                          type="button"
                          onClick={() => void decision(aff, 'SUSPENDUE')}
                          disabled={busyId === aff.id}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-700 transition hover:bg-amber-100 disabled:opacity-60 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300"
                        >
                          {busyId === aff.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                          {t('etablissement.affiliations.suspendre')}
                        </button>
                      )}

                      {aff.statut === 'SUSPENDUE' && (
                        <button
                          type="button"
                          onClick={() => void decision(aff, 'ACCEPTEE')}
                          disabled={busyId === aff.id}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
                        >
                          {busyId === aff.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserRoundCheck className="h-3.5 w-3.5" />}
                          {t('etablissement.affiliations.reactiver')}
                        </button>
                      )}

                      {aff.statut === 'REFUSEE' && (
                        <span className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-4 py-2 text-xs font-bold text-slate-500 dark:bg-white/5 dark:text-slate-400">
                          <UserRoundX className="h-3.5 w-3.5" />
                          {t('etablissement.affiliations.refuseeInfo')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <p className="mt-4 flex items-start gap-1.5 text-xs leading-5 text-slate-400 dark:text-slate-500">
        <UserRound className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {t('etablissement.affiliations.footnote')}
      </p>
    </div>
  )
}
