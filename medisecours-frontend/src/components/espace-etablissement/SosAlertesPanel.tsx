'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  CircleSlash,
  Clock,
  Eye,
  History,
  Loader2,
  MapPin,
  Phone,
  Radio,
  RefreshCw,
  ScrollText,
  Siren,
  Stethoscope,
  UserRound,
  X,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import api from '../../api/axios'
import { useNotification } from '../../contexts/NotificationContext'

interface SosItem {
  id: number
  statut: string
  nom: string | null
  telephone: string | null
  description: string | null
  latitude: number | number[] | null
  longitude: number | number[] | null
  sireneActive: boolean
  preuvePhoto: string | null
  etablissement: { id: number; nom: string } | null
  verifiePar: string | null
  verifieAt: string | null
  verificationComment: string | null
  prisEnChargePar: { id: string; nom: string } | null
  prisEnChargeAt: string | null
  resoluAt: string | null
  createdAt: string
}

interface Trace {
  id: number
  action: string
  auteur: { id: string; nom: string; prenom: string } | null
  details: Record<string, unknown> | null
  createdAt: string
}

type Filtre = 'TOUTES' | 'OUVERTES' | 'TERMINEES'

const STATUTS_OUVERTS = ['EN_COURS', 'VERIFIEE', 'EN_PRISE_EN_CHARGE']

function coordonnee(value: number | number[] | null): number | null {
  if (typeof value === 'number') return value
  if (Array.isArray(value) && typeof value[0] === 'number') return value[0]
  return null
}

function heureRelative(iso: string | null, locale: string): string {
  if (!iso) return '—'
  const delta = new Date(iso).getTime() - Date.now()
  const abs = Math.abs(delta)
  let value: number
  let unit: Intl.RelativeTimeFormatUnit
  if (abs < 60000) {
    value = Math.round(abs / 1000)
    unit = 'second'
  } else if (abs < 3600000) {
    value = Math.round(abs / 60000)
    unit = 'minute'
  } else if (abs < 86400000) {
    value = Math.round(abs / 3600000)
    unit = 'hour'
  } else {
    value = Math.round(abs / 86400000)
    unit = 'day'
  }
  try {
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(delta < 0 ? -value : value, unit)
  } catch {
    return new Date(iso).toLocaleString(locale)
  }
}

function heureExacte(iso: string | null, locale: string): string {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))
  } catch {
    return new Date(iso).toLocaleString(locale)
  }
}

const STATUT_ICONE: Record<string, typeof Clock> = {
  EN_COURS: Clock,
  VERIFIEE: Siren,
  EN_PRISE_EN_CHARGE: Stethoscope,
  TRAITEE: CheckCircle2,
  FRAUDULEUSE: CircleSlash,
  CLOTUREE: CircleSlash,
}

/* ──────────────────────────────────────────────────────────────────────────
 * Panneau « Alertes SOS » — fil temps réel de l'établissement.
 * ────────────────────────────────────────────────────────────────────────── */
export default function SosAlertesPanel({ centreId }: { centreId: number }) {
  const { t, i18n } = useTranslation()
  const { subscribeToSos, sosAlerte } = useNotification()
  const locale = i18n.language === 'en' ? 'en-US' : 'fr-FR'

  const [items, setItems] = useState<SosItem[]>([])
  const [loading, setLoading] = useState(true)
  const [erreur, setErreur] = useState(false)
  const [filtre, setFiltre] = useState<Filtre>('TOUTES')
  const [expandId, setExpandId] = useState<number | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [decision, setDecision] = useState<'REEL' | 'FAUX'>('REEL')
  const [commentaire, setCommentaire] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const [photoOuverte, setPhotoOuverte] = useState<string | null>(null)
  const [traces, setTraces] = useState<Record<number, Trace[]>>({})
  const [journalLoading, setJournalLoading] = useState<number | null>(null)

  const charger = useCallback(async () => {
    try {
      const { data } = await api.get('/api/sos/etablissement', { params: { centre: centreId } })
      setItems(Array.isArray(data?.alertes) ? data.alertes : [])
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

  // Rafraîchit à chaque événement WebSocket d'équipe (création / vérification…).
  useEffect(() => {
    return subscribeToSos((_type, _payload) => {
      void charger()
    })
  }, [subscribeToSos, charger])

  const ouvertes = useMemo(() => items.filter((i) => STATUTS_OUVERTS.includes(i.statut)), [items])
  const affichees = useMemo(() => {
    if (filtre === 'OUVERTES') return ouvertes
    if (filtre === 'TERMINEES') return items.filter((i) => !STATUTS_OUVERTS.includes(i.statut))
    return items
  }, [items, filtre, ouvertes])

  const msgErreur = (err: unknown): string => {
    const data = (err as any)?.response?.data
    return data?.detail || data?.message || t('sos.actionErreur')
  }

  const executer = async (id: number, chemin: string, body?: Record<string, unknown>) => {
    setBusyId(id)
    setActionError(null)
    try {
      await api.post(chemin, body ?? {})
      await charger()
      return true
    } catch (err) {
      setActionError(msgErreur(err))
      return false
    } finally {
      setBusyId(null)
    }
  }

  const validerDecision = async (sos: SosItem) => {
    const ok = await executer(sos.id, `/api/sos/${sos.id}/verifier`, {
      decision,
      commentaire: commentaire.trim() || undefined,
    })
    if (ok) {
      setCommentaire('')
      setExpandId(null)
    }
  }

  const cloturer = async (sos: SosItem) => {
    const ok = await executer(sos.id, `/api/sos/${sos.id}/cloturer`, {
      motif: commentaire.trim() || undefined,
    })
    if (ok) {
      setCommentaire('')
      setExpandId(null)
    }
  }

  const ouvrirJournal = async (sos: SosItem) => {
    if (traces[sos.id]) {
      setExpandId(expandId === sos.id ? null : sos.id)
      return
    }
    setJournalLoading(sos.id)
    try {
      const { data } = await api.get(`/api/sos/${sos.id}/traces`)
      setTraces((prev) => ({ ...prev, [sos.id]: Array.isArray(data?.traces) ? data.traces : [] }))
      setExpandId(sos.id)
    } catch {
      setActionError(t('sos.journalErreur'))
    } finally {
      setJournalLoading(null)
    }
  }

  const chipStatut = (statut: string) => {
    const map: Record<string, string> = {
      EN_COURS: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
      VERIFIEE: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30',
      EN_PRISE_EN_CHARGE: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30',
      TRAITEE: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
      FRAUDULEUSE: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:border-white/15',
      CLOTUREE: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:border-white/15',
    }
    return (
      <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${map[statut] ?? map.CLOTUREE}`}>
        {t(`sos.statut.${statut}`)}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="dashboard-section flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('sos.chargement')}
      </div>
    )
  }

  return (
    <div className="dashboard-section">
      {/* ── En-tête ── */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-600 text-white shadow-sm">
          <Siren className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-base font-bold text-slate-950 dark:text-white">{t('sos.titre')}</h3>
          <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            {t('sos.sousTitre')}
          </p>
        </div>
        <span className="rounded-full bg-red-50 px-3 py-1 text-sm font-black text-red-700 dark:bg-red-500/15 dark:text-red-400">
          {t('sos.ouvertesCount', { count: ouvertes.length })}
        </span>
        <button
          type="button"
          onClick={() => void charger()}
          aria-label={t('sos.actualiser')}
          title={t('sos.actualiser')}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* ── Filtres ── */}
      <div className="mb-4 flex gap-2" role="tablist" aria-label={t('sos.titre')}>
        {(['TOUTES', 'OUVERTES', 'TERMINEES'] as Filtre[]).map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filtre === f}
            onClick={() => setFiltre(f)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
              filtre === f
                ? 'bg-slate-900 text-white shadow dark:bg-white dark:text-slate-900'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/15'
            }`}
          >
            {t(`sos.filtre${f.charAt(0) + f.slice(1).toLowerCase()}`)}
          </button>
        ))}
      </div>

      {actionError && (
        <div role="alert" className="mb-3 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {actionError}
        </div>
      )}

      {/* ── Liste ── */}
      {erreur ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <AlertTriangle className="h-8 w-8 text-amber-500" />
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">{t('sos.erreurChargement')}</p>
          <button type="button" onClick={() => { setLoading(true); void charger() }} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white dark:bg-white dark:text-slate-900">
            {t('sos.actualiser')}
          </button>
        </div>
      ) : affichees.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-white/5 dark:text-slate-500">
            <Radio className="h-7 w-7" />
          </span>
          <div>
            <p className="font-bold text-slate-800 dark:text-slate-100">{t('sos.aucune')}</p>
            <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{t('sos.aucuneDesc')}</p>
          </div>
        </div>
      ) : (
        <ul className="space-y-3">
          {affichees.map((sos) => {
            const IconeStatut = STATUT_ICONE[sos.statut] ?? Clock
            const estOuverte = STATUTS_OUVERTS.includes(sos.statut)
            const enCours = sos.statut === 'EN_COURS'
            const enPrise = sos.statut === 'EN_PRISE_EN_CHARGE' || sos.statut === 'VERIFIEE'
            const surlignee = sosAlerte?.id === sos.id && estOuverte
            const lat = coordonnee(sos.latitude)
            const lng = coordonnee(sos.longitude)
            const detail = expandId === sos.id
            return (
              <li
                key={sos.id}
                className={`rounded-2xl border bg-white p-4 transition dark:bg-slate-900 ${
                  surlignee
                    ? 'border-red-400 shadow-[0_0_0_3px_rgba(239,68,68,0.15)] dark:border-red-500'
                    : estOuverte
                      ? 'border-slate-200 dark:border-white/10'
                      : 'border-slate-100 opacity-90 dark:border-white/5'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Pastille statut + icône */}
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      enCours
                        ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400'
                        : sos.statut === 'VERIFIEE' || sos.statut === 'EN_PRISE_EN_CHARGE'
                          ? 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400'
                          : 'bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400'
                    }`}
                  >
                    <IconeStatut className={`h-5 w-5 ${enCours ? 'animate-pulse' : ''}`} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {chipStatut(sos.statut)}
                      {sos.sireneActive && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wide text-white">
                          <BellRing className="h-3 w-3" />
                          {t('sos.sireneActiveLabel')}
                        </span>
                      )}
                      <span className="text-xs text-slate-400 dark:text-slate-500">
                        <Clock className="mr-1 inline h-3 w-3" />
                        {heureRelative(sos.createdAt, locale)}
                      </span>
                    </div>

                    <p className="mt-1.5 line-clamp-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {sos.description || <span className="font-normal italic text-slate-400 dark:text-slate-500">{t('sos.pasDescription')}</span>}
                    </p>

                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <UserRound className="h-3.5 w-3.5" />
                        {sos.nom || t('sos.anonyme')}
                      </span>
                      {lat != null && lng != null && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {lat.toFixed(4)}, {lng.toFixed(4)}
                        </span>
                      )}
                      {sos.verifiePar && (
                        <span className="inline-flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {t('sos.verifiePar', { nom: sos.verifiePar })}
                        </span>
                      )}
                      {sos.prisEnChargePar && (
                        <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400">
                          <Stethoscope className="h-3.5 w-3.5" />
                          {t('sos.prisPar', { nom: sos.prisEnChargePar.nom })}
                        </span>
                      )}
                    </div>

                    {/* Actions compactes */}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {sos.telephone && (
                        <a
                          href={`tel:${sos.telephone}`}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                        >
                          <Phone className="h-3.5 w-3.5" />
                          {t('sos.appeler')}
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => setPhotoOuverte(sos.preuvePhoto || null)}
                        disabled={!sos.preuvePhoto}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                      >
                        {sos.preuvePhoto ? <Eye className="h-3.5 w-3.5" /> : <CircleSlash className="h-3.5 w-3.5" />}
                        {sos.preuvePhoto ? t('sos.preuve') : t('sos.preuveAbsente')}
                      </button>
                      <button
                        type="button"
                        onClick={() => void ouvrirJournal(sos)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                      >
                        {journalLoading === sos.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <History className="h-3.5 w-3.5" />}
                        {t('sos.journal')}
                      </button>
                      {enPrise && !detail && (
                        <button
                          type="button"
                          onClick={() => setExpandId(sos.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                        >
                          <ScrollText className="h-3.5 w-3.5" />
                          {t('sos.options')}
                        </button>
                      )}
                    </div>

                    {/* ── Détail déplié : décision / clôture / journal ── */}
                    {detail && (
                      <div className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-slate-800/60">
                        {enCours && (
                          <>
                            <div>
                              <p className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                                {t('sos.decisionTitle')}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">{t('sos.decisionDesc')}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => setDecision('REEL')}
                                aria-pressed={decision === 'REEL'}
                                className={`flex flex-col items-center gap-1 rounded-xl border-2 px-3 py-2.5 text-xs font-bold transition ${
                                  decision === 'REEL'
                                    ? 'border-red-500 bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300'
                                    : 'border-slate-200 bg-white text-slate-500 hover:border-red-300 dark:border-white/10 dark:bg-slate-900 dark:text-slate-400'
                                }`}
                              >
                                <Siren className="h-4 w-4" />
                                {t('sos.decisionReel')}
                                <span className="font-medium opacity-70">{t('sos.decisionReelHint')}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setDecision('FAUX')}
                                aria-pressed={decision === 'FAUX'}
                                className={`flex flex-col items-center gap-1 rounded-xl border-2 px-3 py-2.5 text-xs font-bold transition ${
                                  decision === 'FAUX'
                                    ? 'border-slate-500 bg-slate-100 text-slate-700 dark:border-slate-400 dark:bg-white/10 dark:text-slate-200'
                                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-400 dark:border-white/10 dark:bg-slate-900 dark:text-slate-400'
                                }`}
                              >
                                <CircleSlash className="h-4 w-4" />
                                {t('sos.decisionFaux')}
                                <span className="font-medium opacity-70">{t('sos.decisionFauxHint')}</span>
                              </button>
                            </div>
                            <label className="block">
                              <span className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">
                                {t('sos.commentaireLabel')}
                              </span>
                              <input
                                type="text"
                                value={commentaire}
                                onChange={(event) => setCommentaire(event.target.value)}
                                maxLength={1000}
                                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-500/10 dark:border-white/10 dark:bg-slate-900 dark:text-white"
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => void validerDecision(sos)}
                              disabled={busyId === sos.id}
                              className={`flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white transition disabled:opacity-60 ${
                                decision === 'REEL' ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-700 hover:bg-slate-800 dark:bg-slate-600'
                              }`}
                            >
                              {busyId === sos.id ? <Loader2 className="h-4 w-4 animate-spin" /> : decision === 'REEL' ? <Siren className="h-4 w-4" /> : <CircleSlash className="h-4 w-4" />}
                              {t('sos.validerDecision')}
                            </button>
                          </>
                        )}

                        {enPrise && (
                          <>
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                              {sos.statut === 'VERIFIEE' ? t('sos.attenteMedecin') : t('sos.enTraitement')}
                            </p>
                            <button
                              type="button"
                              onClick={() => void cloturer(sos)}
                              disabled={busyId === sos.id}
                              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-100 disabled:opacity-60 dark:border-white/15 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                              {busyId === sos.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                              {t('sos.cloturer')}
                            </button>
                          </>
                        )}

                        {/* Journal d'audit */}
                        <div>
                          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                            <History className="h-3.5 w-3.5" />
                            {t('sos.journal')}
                          </p>
                          <ol className="space-y-2">
                            {(traces[sos.id] ?? []).map((tr) => {
                              const auteur = tr.auteur ? `${tr.auteur.prenom ?? ''} ${tr.auteur.nom ?? ''}`.trim() : t('sos.systeme')
                              return (
                                <li key={tr.id} className="flex gap-2 text-xs">
                                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400 dark:bg-slate-500" />
                                  <div className="min-w-0">
                                    <p className="font-semibold text-slate-700 dark:text-slate-200">
                                      {t(`sos.trace.${tr.action}`)} <span className="font-normal text-slate-400">· {auteur}</span>
                                    </p>
                                    <p className="text-slate-400 dark:text-slate-500">{heureExacte(tr.createdAt, locale)}</p>
                                    {tr.details && typeof tr.details.commentaire === 'string' && tr.details.commentaire && (
                                      <p className="mt-0.5 italic text-slate-500 dark:text-slate-400">« {tr.details.commentaire} »</p>
                                    )}
                                  </div>
                                </li>
                              )
                            })}
                          </ol>
                        </div>

                        <button
                          type="button"
                          onClick={() => setExpandId(null)}
                          className="flex w-full items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-bold text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200"
                        >
                          <X className="h-3.5 w-3.5" />
                          {t('sos.reduire')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {/* ── Visionneuse de preuve photo ── */}
      {photoOuverte && (
        <div
          className="fixed inset-0 z-[2500] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setPhotoOuverte(null)}
          role="dialog"
          aria-modal="true"
          aria-label={t('sos.preuve')}
        >
          <div className="max-h-full w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-white/10">
              <p className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                {t('sos.preuve')}
              </p>
              <button
                type="button"
                onClick={() => setPhotoOuverte(null)}
                aria-label={t('sos.fermer')}
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element -- preuve photo base64 serveur */}
            <img src={photoOuverte} alt={t('sos.preuveAlt')} className="max-h-[70vh] w-full object-contain bg-slate-100 dark:bg-slate-950" />
          </div>
        </div>
      )}
    </div>
  )
}
