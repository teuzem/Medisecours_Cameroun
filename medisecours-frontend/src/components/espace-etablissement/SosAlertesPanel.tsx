'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  CircleSlash,
  Clock,
  Forward,
  History,
  Loader2,
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
import { useToast } from '../ui/Toast'
import { SosPosition } from '../sos/SosPosition'
import { SosPreuve } from '../sos/SosPreuve'

interface SosItem {
  id: number
  statut: string
  gravite: string
  agePatient: number | null
  enceinte: boolean
  nom: string | null
  telephone: string | null
  description: string | null
  latitude: number | number[] | null
  longitude: number | number[] | null
  sireneActive: boolean
  preuvePhoto: string | null
  /** Nature de la preuve renvoyée par l'API (PHOTO / VIDEO). */
  preuveType: 'PHOTO' | 'VIDEO' | null
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

/** Teinte du point d'état : elle porte la lecture à une distance de bras. */
const TEINTE_STATUT: Record<string, string> = {
  EN_COURS: 'bg-amber-500',
  VERIFIEE: 'bg-red-600',
  EN_PRISE_EN_CHARGE: 'bg-sky-500',
  TRAITEE: 'bg-emerald-600',
  FRAUDULEUSE: 'bg-slate-400',
  CLOTUREE: 'bg-slate-300 dark:bg-slate-600',
}

const TEINTE_GRAVITE: Record<string, string> = {
  LEGERE: 'text-emerald-700 dark:text-emerald-400',
  URGENTE: 'text-amber-700 dark:text-amber-400',
  CRITIQUE: 'text-red-700 dark:text-red-400',
}

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

function Squelette() {
  return (
    <div className="space-y-2.5" aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <div key={index} className="h-28 animate-pulse rounded-xl bg-slate-100 dark:bg-white/5" />
      ))}
    </div>
  )
}

/**
 * État vide.
 *
 * Il dépend du filtre : « aucune alerte » sous un filtre ne veut pas dire
 * « aucune alerte reçue ». Dire « Les signalements apparaîtront ici » alors
 * qu'un registre existe ailleurs, c'est afficher un mensonge à l'écran.
 */
function Vide({ filtre, items, onVoirTout }: { filtre: Filtre; items: number; onVoirTout: () => void }) {
  const { t } = useTranslation()

  // Filtre restrictif alors que le registre contient des alertes.
  if (filtre !== 'TOUTES' && items > 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-white/5 dark:text-slate-500">
          {filtre === 'OUVERTES' ? <CheckCircle2 className="h-7 w-7" /> : <History className="h-7 w-7" />}
        </span>
        <p className="text-base font-bold text-slate-800 dark:text-slate-100">
          {filtre === 'OUVERTES' ? t('sos.videOuvertes') : t('sos.videTerminees')}
        </p>
        <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">{t('sos.videFiltreDesc', { count: items })}</p>
        <button
          type="button"
          onClick={onVoirTout}
          className="mt-1 min-h-9 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-900"
        >
          {t('sos.voirToutes', { count: items })}
        </button>
      </div>
    )
  }

  // Aucun signalement du tout : on explique l'interface.
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-white/5 dark:text-slate-500">
        <Radio className="h-7 w-7" />
      </span>
      <p className="text-base font-bold text-slate-800 dark:text-slate-100">{t('sos.aucune')}</p>
      <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">{t('sos.aucuneDesc')}</p>
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
 * Poste d'alerte de l'établissement.
 *
 * Surface « Operate » : l'écran d'un poste de secours. Priorité à la
 * lecture en un coup d'œil — où en est l'alerte, qui l'a prise, où est le
 * patient — puis aux actions de terrain sur une seule ligne.
 *
 * Une alerte ouverte s'affiche en pleine mesure (carte, preuve, actions).
 * Une alerte terminée se replie en une ligne de registre : sans carte ni
 * lecteur, la liste reste lisible même après des centaines d'interventions.
 * ────────────────────────────────────────────────────────────────────────── */
export default function SosAlertesPanel({ centreId }: { centreId: number }) {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const { subscribeToSos, sosAlerte } = useNotification()
  const locale = i18n.language === 'en' ? 'en-US' : 'fr-FR'

  const [items, setItems] = useState<SosItem[]>([])
  const [loading, setLoading] = useState(true)
  const [erreur, setErreur] = useState(false)
  const [filtre, setFiltre] = useState<Filtre>('TOUTES')
  const [expandId, setExpandId] = useState<number | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [decision, setDecision] = useState<'REEL' | 'FAUX'>('REEL')
  const [gravite, setGravite] = useState('URGENTE')
  const [commentaire, setCommentaire] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
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

  useEffect(() => {
    return subscribeToSos(() => {
      void charger()
    })
  }, [subscribeToSos, charger])

  const ouvertes = useMemo(() => items.filter((i) => STATUTS_OUVERTS.includes(i.statut)), [items])
  const terminees = useMemo(() => items.filter((i) => !STATUTS_OUVERTS.includes(i.statut)), [items])
  const affichees = useMemo(() => {
    if (filtre === 'OUVERTES') return ouvertes
    if (filtre === 'TERMINEES') return terminees
    return [...ouvertes, ...terminees]
  }, [filtre, ouvertes, terminees])

  const msgErreur = (err: unknown): string => {
    const data = (err as { response?: { data?: { detail?: string; message?: string } } })?.response?.data
    return data?.detail || data?.message || t('sos.actionErreur')
  }

  const cloturer = async (sos: SosItem) => {
    setBusyId(sos.id)
    setActionError(null)
    try {
      await api.post(`/api/sos/${sos.id}/cloturer`, {})
      await charger()
      toast.success(t('medecin.alertes.clotureOk', { defaultValue: t('sos.cloturer') }))
    } catch (err) {
      setActionError(msgErreur(err))
    } finally {
      setBusyId(null)
    }
  }

  const validerDecision = async (sos: SosItem) => {
    setBusyId(sos.id)
    setActionError(null)
    try {
      await api.post(`/api/sos/${sos.id}/verifier`, {
        decision,
        commentaire: commentaire.trim() || undefined,
        gravite: decision === 'REEL' ? gravite : undefined,
      })
      setCommentaire('')
      setExpandId(null)
      await charger()
    } catch (err) {
      setActionError(msgErreur(err))
    } finally {
      setBusyId(null)
    }
  }

  const relayer = async (sos: SosItem) => {
    setBusyId(sos.id)
    setActionError(null)
    try {
      await api.post(`/api/sos/${sos.id}/relayer`, {})
      await charger()
      toast.success(t('sos.relayOk'))
    } catch (err) {
      setActionError(msgErreur(err))
    } finally {
      setBusyId(null)
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
      setGravite(sos.gravite || 'URGENTE')
      setExpandId(sos.id)
    } catch {
      setActionError(t('sos.journalErreur'))
    } finally {
      setJournalLoading(null)
    }
  }

  /* ── Carte d'alerte ────────────────────────────────────────────────────── */
  const carte = (sos: SosItem) => {
    const enCours = sos.statut === 'EN_COURS'
    const enPrise = sos.statut === 'VERIFIEE' || sos.statut === 'EN_PRISE_EN_CHARGE'
    const estOuverte = STATUTS_OUVERTS.includes(sos.statut)
    const surlignee = sosAlerte?.id === sos.id && estOuverte
    const lat = coordonnee(sos.latitude)
    const lng = coordonnee(sos.longitude)
    const detail = expandId === sos.id

    return (
      <li
        key={sos.id}
        className={`overflow-hidden rounded-xl border transition-colors ${
          surlignee
            ? 'border-red-400 bg-white dark:bg-slate-900'
            : estOuverte
              ? 'border-slate-200 bg-white hover:border-slate-300 dark:border-white/10 dark:bg-slate-900 dark:hover:border-white/20'
              : 'border-transparent bg-slate-50/70 dark:bg-white/[0.03]'
        }`}
      >
        {/* Ligne d'état */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 pt-4">
          <span className={`inline-flex items-center gap-2 text-sm font-black uppercase tracking-wide ${TEINTE_GRAVITE[sos.gravite] ?? TEINTE_GRAVITE.LEGERE}`}>
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${estOuverte ? `${TEINTE_STATUT[sos.statut]} ${enCours ? 'animate-pulse' : ''}` : TEINTE_STATUT[sos.statut]}`}
              aria-hidden="true"
            />
            {t(`sos.gravite.${sos.gravite || 'LEGERE'}`)}
          </span>
          <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            {t(`sos.statut.${sos.statut}`)}
          </span>
          {sos.sireneActive && (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-2 py-0.5 text-xs font-black uppercase tracking-wide text-white">
              <BellRing className="h-3.5 w-3.5" />
              {t('sos.sireneActiveLabel')}
            </span>
          )}
          <time
            dateTime={sos.createdAt}
            className="ml-auto shrink-0 text-sm tabular-nums text-slate-400 dark:text-slate-500"
          >
            {heureRelative(sos.createdAt, locale)}
          </time>
        </div>

        {/* Titre + identité */}
        <div className="px-5 pt-2">
          <p className={`font-semibold leading-snug text-slate-900 dark:text-white ${estOuverte ? 'text-base' : 'truncate text-[15px]'}`}>
            {sos.description || <span className="font-normal italic text-slate-400">{t('sos.pasDescription')}</span>}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <UserRound className="h-4 w-4" />
              {sos.nom || t('sos.anonyme')}
            </span>
            {sos.agePatient != null && <span className="tabular-nums">{t('sos.agePatient', { age: sos.agePatient })}</span>}
            {sos.enceinte && <span className="font-semibold text-pink-600 dark:text-pink-400">{t('sos.enceinteBadge')}</span>}
            {sos.verifiePar && (
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" />
                {t('sos.verifiePar', { nom: sos.verifiePar })}
              </span>
            )}
            {sos.prisEnChargePar && (
              <span className="inline-flex items-center gap-1.5 font-medium text-sky-700 dark:text-sky-400">
                <Stethoscope className="h-4 w-4" />
                {sos.prisEnChargePar.nom}
              </span>
            )}
          </div>
        </div>

        {/* Alerte terminée : ligne de registre, sans carte ni lecteur */}
        {!estOuverte ? (
          <div className="flex items-center justify-between gap-3 px-5 pb-4 pt-2.5">
            <time dateTime={sos.resoluAt ?? undefined} className="text-sm tabular-nums text-slate-400 dark:text-slate-500">
              {heureExacte(sos.resoluAt, locale)}
            </time>
            <button
              type="button"
              onClick={() => void ouvrirJournal(sos)}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-slate-500 transition hover:bg-slate-200/70 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
            >
              {journalLoading === sos.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <History className="h-4 w-4" />}
              {t('sos.journal')}
            </button>
          </div>
        ) : (
          <>
            {/* Position : carte réelle + actions de terrain sur une seule ligne */}
            <div className="px-5 pt-3.5">
              <SosPosition latitude={lat} longitude={lng} nom={sos.nom} telephone={sos.telephone} />
            </div>

            {/* Preuve */}
            <div className="px-5 pt-3">
              <SosPreuve preuve={sos.preuvePhoto} type={sos.preuveType} />
            </div>

            {/* Décision / intervention */}
            <div className="flex flex-wrap items-center gap-2 px-5 py-3.5">
              {(sos.statut === 'EN_COURS' || sos.statut === 'VERIFIEE') && !sos.prisEnChargePar && (
                <button
                  type="button"
                  onClick={() => void relayer(sos)}
                  disabled={busyId === sos.id}
                  title={t('sos.relayerHint')}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                >
                  {busyId === sos.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Forward className="h-4 w-4" />}
                  {t('sos.relayer')}
                </button>
              )}
              <button
                type="button"
                onClick={() => void ouvrirJournal(sos)}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
              >
                {journalLoading === sos.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <History className="h-4 w-4" />}
                {t('sos.journal')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setGravite(sos.gravite || 'URGENTE')
                  setExpandId(detail ? null : sos.id)
                }}
                aria-expanded={detail}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
              >
                <ScrollText className="h-4 w-4" />
                {t('sos.options')}
              </button>
            </div>
          </>
        )}

        {/* ── Zone de décision (dépliée, sans carte imbriquée) ── */}
        {detail && (
          <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-4 dark:border-white/5 dark:bg-white/[0.02]">
            {enCours && (
              <>
                <p className="text-[15px] font-semibold text-slate-900 dark:text-white">{t('sos.decisionTitle')}</p>
                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{t('sos.decisionDesc')}</p>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDecision('REEL')}
                    aria-pressed={decision === 'REEL'}
                    className={`flex flex-col items-center gap-0.5 rounded-lg border px-3 py-2.5 text-sm font-bold transition ${
                      decision === 'REEL'
                        ? 'border-red-500 bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300'
                        : 'border-slate-200 bg-white text-slate-500 hover:border-red-300 dark:border-white/10 dark:bg-slate-900 dark:text-slate-400'
                    }`}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Siren className="h-4 w-4" />
                      {t('sos.decisionReel')}
                    </span>
                    <span className="text-xs font-normal opacity-70">{t('sos.decisionReelHint')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDecision('FAUX')}
                    aria-pressed={decision === 'FAUX'}
                    className={`flex flex-col items-center gap-0.5 rounded-lg border px-3 py-2.5 text-sm font-bold transition ${
                      decision === 'FAUX'
                        ? 'border-slate-500 bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-200'
                        : 'border-slate-200 bg-white text-slate-500 hover:border-slate-400 dark:border-white/10 dark:bg-slate-900 dark:text-slate-400'
                    }`}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <CircleSlash className="h-4 w-4" />
                      {t('sos.decisionFaux')}
                    </span>
                    <span className="text-xs font-normal opacity-70">{t('sos.decisionFauxHint')}</span>
                  </button>
                </div>

                {decision === 'REEL' && (
                  <div className="mt-3">
                    <span className="mb-1.5 block text-sm font-bold text-slate-600 dark:text-slate-300">
                      {t('sos.graviteLabel')}
                    </span>
                    <div
                      className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1 dark:bg-white/5"
                      role="radiogroup"
                      aria-label={t('sos.graviteLabel')}
                    >
                      {(['LEGERE', 'URGENTE', 'CRITIQUE'] as const).map((code) => (
                        <button
                          key={code}
                          type="button"
                          role="radio"
                          aria-checked={gravite === code}
                          onClick={() => setGravite(code)}
                          className={`rounded-md py-2 text-xs font-black uppercase tracking-wide transition ${
                            gravite === code
                              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                          }`}
                        >
                          {t(`sos.gravite.${code}`)}
                        </button>
                      ))}
                    </div>
                    <span className="mt-1.5 block text-xs text-slate-400">{t('sos.graviteHint')}</span>
                  </div>
                )}

                <label className="mt-3 block">
                  <span className="mb-1.5 block text-sm font-bold text-slate-600 dark:text-slate-300">
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
                  className={`mt-3.5 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold text-white transition disabled:opacity-60 ${
                    decision === 'REEL' ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-700 hover:bg-slate-800 dark:bg-slate-600'
                  }`}
                >
                  {busyId === sos.id ? <Loader2 className="h-4 w-4 animate-spin" /> : decision === 'REEL' ? <Siren className="h-4 w-4" /> : <CircleSlash className="h-4 w-4" />}
                  {t('sos.validerDecision')}
                </button>
              </>
            )}

            {enPrise && (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-slate-900 dark:text-white">
                    {sos.statut === 'VERIFIEE' ? t('sos.attenteMedecin') : t('sos.enTraitement')}
                  </p>
                  {sos.prisEnChargePar && (
                    <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                      {t('sos.prisPar', { nom: sos.prisEnChargePar.nom })}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void cloturer(sos)}
                  disabled={busyId === sos.id}
                  className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                >
                  {busyId === sos.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  {t('sos.cloturer')}
                </button>
              </div>
            )}

            {/* Journal d'audit */}
            <div className="mt-4 border-t border-slate-200/70 pt-3.5 dark:border-white/5">
              <p className="mb-2.5 flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <History className="h-4 w-4" />
                {t('sos.journal')}
              </p>
              <ol className="space-y-3">
                {(traces[sos.id] ?? []).map((tr) => {
                  const auteur = tr.auteur ? `${tr.auteur.prenom ?? ''} ${tr.auteur.nom ?? ''}`.trim() : t('sos.systeme')
                  return (
                    <li key={tr.id} className="flex gap-2.5 text-sm">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400 dark:bg-slate-500" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-700 dark:text-slate-200">
                          {t(`sos.trace.${tr.action}`, { defaultValue: tr.action })}{' '}
                          <span className="font-normal text-slate-400">· {auteur}</span>
                        </p>
                        <p className="tabular-nums text-slate-400 dark:text-slate-500">{heureExacte(tr.createdAt, locale)}</p>
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
              className="mt-3.5 flex min-h-9 w-full items-center justify-center gap-1.5 py-1.5 text-sm font-semibold text-slate-400 transition hover:text-slate-700 dark:hover:text-slate-200"
            >
              <X className="h-4 w-4" />
              {t('sos.reduire')}
            </button>
          </div>
        )}
      </li>
    )
  }

  return (
    <div className="dashboard-section">
      {/* ── En-tête ── */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h3 className="font-display text-xl font-black tracking-tight text-slate-950 dark:text-white">
          {t('sos.titre')}
        </h3>
        <span
          className={`inline-flex items-center gap-2 rounded-md px-2.5 py-1 text-sm font-black tabular-nums ${
            ouvertes.length > 0
              ? 'bg-red-600 text-white'
              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
          }`}
        >
          {ouvertes.length > 0 && (
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
            </span>
          )}
          {t('sos.ouvertesCount', { count: ouvertes.length })}
        </span>
        <button
          type="button"
          onClick={() => void charger()}
          aria-label={t('sos.actualiser')}
          title={t('sos.actualiser')}
          className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:bg-slate-50 hover:text-slate-700 dark:border-white/10 dark:text-slate-500 dark:hover:bg-white/5 dark:hover:text-white"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* ── Filtres ── */}
      <div
        className="mb-3.5 inline-flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-white/5"
        role="tablist"
        aria-label={t('sos.titre')}
      >
        {([
          ['OUVERTES', ouvertes.length],
          ['TERMINEES', terminees.length],
          ['TOUTES', items.length],
        ] as const).map(([cle, nombre]) => (
          <button
            key={cle}
            type="button"
            role="tab"
            aria-selected={filtre === cle}
            onClick={() => setFiltre(cle)}
            className={`inline-flex min-h-9 items-center gap-2 rounded-md px-4 py-2 text-sm font-bold transition ${
              filtre === cle
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
            }`}
          >
            {t(`sos.filtre${cle.charAt(0)}${cle.slice(1).toLowerCase()}`)}
            <span className="tabular-nums opacity-60">{nombre}</span>
          </button>
        ))}
      </div>

      {actionError && (
        <div
          role="alert"
          className="mb-3.5 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm font-semibold text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {actionError}
        </div>
      )}

      {/* ── Registre ── */}
      {loading ? (
        <Squelette />
      ) : erreur ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <AlertTriangle className="h-7 w-7 text-amber-500" />
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">{t('sos.erreurChargement')}</p>
          <button
            type="button"
            onClick={() => void charger()}
            className="min-h-9 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white dark:bg-white dark:text-slate-900"
          >
            {t('sos.actualiser')}
          </button>
        </div>
      ) : affichees.length === 0 ? (
        <Vide filtre={filtre} items={items.length} onVoirTout={() => setFiltre('TOUTES')} />
      ) : (
        <ul className="space-y-2.5">
          {affichees.map((sos) => carte(sos))}
        </ul>
      )}
    </div>
  )
}