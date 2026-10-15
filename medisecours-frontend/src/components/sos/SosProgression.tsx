'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Ambulance, CheckCircle2, ChevronDown, ChevronUp, Loader2, Stethoscope, type LucideIcon } from 'lucide-react'

import {
  avancerIntervention,
  cloturerAlerte,
  duree,
  etapeSuivante,
  messageErreur,
  type AlerteSos,
  type EtapeIntervention,
} from '../../lib/sosWorkflow'

const LIBELLE_ETAPE: Record<EtapeIntervention, string> = {
  DEPART: 'sos.etapeDepart',
  SUR_PLACE: 'sos.etapeSurPlace',
  TRANSPORT: 'sos.etapeTransport',
}

const ICONE_ETAPE: Record<EtapeIntervention, LucideIcon> = {
  DEPART: Ambulance,
  SUR_PLACE: Ambulance,
  TRANSPORT: Stethoscope,
}

/**
 * Pilotage d'une intervention en cours.
 *
 * L'ordre est imposé par le serveur : prise en charge → départ → arrivée sur
 * place → patient embarqué → clôture. Chaque jalon affiche l'horodatage déjà
 * posé, ce qui donne au demandeur (via son suivi) et au manager (via le
 * journal) une chronologie fiable de l'intervention.
 */
export function SosProgression({
  sos,
  onChange,
  disabled,
}: {
  sos: AlerteSos
  onChange: () => void | Promise<void>
  disabled?: boolean
}) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [details, setDetails] = useState(false)
  const [, force] = useState(0)

  const etape = etapeSuivante(sos)

  // Le chrono n'a besoin d'un rendu que sur les alertes encore en cours.
  useEffect(() => {
    if (!etape) return
    const timer = setInterval(() => force((n) => n + 1), 30_000)
    return () => clearInterval(timer)
  }, [etape])

  const avancer = async (valeur: EtapeIntervention) => {
    setBusy(true)
    setErreur(null)
    try {
      await avancerIntervention(sos.id, valeur)
      await onChange()
    } catch (err) {
      setErreur(messageErreur(err, t('sos.actionErreur')))
    } finally {
      setBusy(false)
    }
  }

  const cloturer = async () => {
    setBusy(true)
    setErreur(null)
    try {
      await cloturerAlerte(sos.id)
      await onChange()
    } catch (err) {
      setErreur(messageErreur(err, t('sos.actionErreur')))
    } finally {
      setBusy(false)
    }
  }

  const jalon = (cle: string, valeur: string | null | undefined, actif: boolean) => (
    <li key={cle} className="flex items-center gap-2 text-xs">
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${valeur ? 'bg-emerald-500' : actif ? 'animate-pulse bg-amber-400' : 'bg-slate-300 dark:bg-slate-600'}`}
        aria-hidden="true"
      />
      <span className="font-semibold text-slate-600 dark:text-slate-300">{t(cle)}</span>
      <span className="ml-auto tabular-nums text-slate-400 dark:text-slate-500">
        {valeur ? `${t('sos.depuis')} ${duree(valeur)}` : t('sos.enAttente')}
      </span>
    </li>
  )

  const IconeEtape: LucideIcon | null = etape ? ICONE_ETAPE[etape] : null

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-white/10 dark:bg-white/5">
      <button
        type="button"
        onClick={() => setDetails((v) => !v)}
        className="flex w-full items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300"
        aria-expanded={details}
      >
        {details ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        {t('sos.suiviIntervention')}
      </button>

      {details && (
        <ul className="mt-2 space-y-1.5">
          {jalon('sos.etapePriseEnCharge', sos.prisEnChargeAt, !sos.departAt)}
          {jalon('sos.etapeDepart', sos.departAt, Boolean(sos.departAt && !sos.arriveeAt))}
          {jalon('sos.etapeSurPlace', sos.arriveeAt, Boolean(sos.arriveeAt && !sos.patientEmbarqueAt))}
          {jalon('sos.etapeTransport', sos.patientEmbarqueAt, false)}
        </ul>
      )}

      {erreur && (
        <p role="alert" className="mt-2 text-xs font-semibold text-red-600 dark:text-red-400">
          {erreur}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {etape && IconeEtape && (
          <button
            type="button"
            onClick={() => void avancer(etape)}
            disabled={busy || disabled}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-primary-700 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <IconeEtape className="h-3.5 w-3.5" />}
            {t(LIBELLE_ETAPE[etape])}
          </button>
        )}
        <button
          type="button"
          onClick={() => void cloturer()}
          disabled={busy || disabled}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          {t('sos.cloturer')}
        </button>
      </div>
    </div>
  )
}