'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  Radio,
  RefreshCw,
  ShieldCheck,
  ShieldX,
  Siren,
  Stethoscope,
  UserRound,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import api from '../../../api/axios'
import { useNotification } from '../../../contexts/NotificationContext'

interface AlerteSos {
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
  prisEnChargePar: { id: string; nom: string } | null
  createdAt: string
  habilitation?: string
}

const HABILITATION_COULEUR: Record<string, string> = {
  admin: 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/30',
  affiliation: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
  equipe: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30',
  ouverte: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-white/10 dark:text-slate-300 dark:border-white/15',
  affiliation_requise: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30',
  equipe_requise: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30',
}

function coordonnee(value: number | number[] | null): number | null {
  if (typeof value === 'number') return value
  if (Array.isArray(value) && typeof value[0] === 'number') return value[0]
  return null
}

function heureExacte(iso: string | null, locale: string): string {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))
  } catch {
    return new Date(iso).toLocaleString(locale)
  }
}

/* ──────────────────────────────────────────────────────────────────────────
 * Vue médecin : alertes vérifiées à prendre + interventions en cours.
 * L'habilitation (affiliation / équipe / ouverte) est recalculée serveur
 * à chaque appel ; le refus s'affiche avec son motif exact.
 * ────────────────────────────────────────────────────────────────────────── */
export default function MedecinAlertesPage() {
  const { t, i18n } = useTranslation()
  const { subscribeToSos } = useNotification()
  const locale = i18n.language === 'en' ? 'en-US' : 'fr-FR'

  const [ouvertes, setOuvertes] = useState<AlerteSos[]>([])
  const [mesPrises, setMesPrises] = useState<AlerteSos[]>([])
  const [loading, setLoading] = useState(true)
  const [erreur, setErreur] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [succes, setSucces] = useState<string | null>(null)
  const [photoOuverte, setPhotoOuverte] = useState<string | null>(null)

  const charger = useCallback(async () => {
    try {
      const { data } = await api.get('/api/medecin/sos')
      setOuvertes(Array.isArray(data?.ouvertes) ? data.ouvertes : [])
      setMesPrises(Array.isArray(data?.mesPrises) ? data.mesPrises : [])
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

  useEffect(() => {
    return subscribeToSos(() => {
      void charger()
    })
  }, [subscribeToSos, charger])

  const msgErreur = (err: unknown): string => {
    const data = (err as any)?.response?.data
    return data?.detail || data?.message || t('medecin.alertes.actionErreur')
  }

  const prendre = async (sos: AlerteSos) => {
    setBusyId(sos.id)
    setActionError(null)
    setSucces(null)
    try {
      await api.post(`/api/sos/${sos.id}/prise-en-charge`)
      setSucces(t('medecin.alertes.priseOk'))
      await charger()
    } catch (err) {
      setActionError(msgErreur(err))
    } finally {
      setBusyId(null)
    }
  }

  const cloturer = async (sos: AlerteSos) => {
    setBusyId(sos.id)
    setActionError(null)
    setSucces(null)
    try {
      await api.post(`/api/sos/${sos.id}/cloturer`, {})
      setSucces(t('medecin.alertes.clotureOk'))
      await charger()
    } catch (err) {
      setActionError(msgErreur(err))
    } finally {
      setBusyId(null)
    }
  }

  const carte = (sos: AlerteSos, mode: 'ouverte' | 'prise') => {
    const lat = coordonnee(sos.latitude)
    const lng = coordonnee(sos.longitude)
    const hab = sos.habilitation ?? 'ouverte'
    const refuse = hab.endsWith('_requise')

    return (
      <li
        key={sos.id}
        className={`rounded-2xl border bg-white p-4 transition dark:bg-slate-900 ${
          mode === 'prise'
            ? 'border-blue-200 dark:border-blue-500/30'
            : 'border-slate-200 hover:border-red-300 hover:shadow-sm dark:border-white/10'
        }`}
      >
        <div className="flex items-start gap-3">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              mode === 'prise'
                ? 'bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400'
                : 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400'
            }`}
          >
            {mode === 'prise' ? <Stethoscope className="h-5 w-5" /> : <Siren className="h-5 w-5 animate-pulse" />}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                  HABILITATION_COULEUR[hab] ?? HABILITATION_COULEUR.ouverte
                }`}
              >
                {refuse ? <ShieldX className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
                {t(`medecin.alertes.habilitation.${hab}`)}
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500">
                <Clock className="mr-1 inline h-3 w-3" />
                {heureExacte(sos.createdAt, locale)}
              </span>
            </div>

            <p className="mt-1.5 line-clamp-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
              {sos.description || <span className="font-normal italic text-slate-400 dark:text-slate-500">{t('medecin.alertes.pasDescription')}</span>}
            </p>

            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1">
                <UserRound className="h-3.5 w-3.5" />
                {sos.nom || t('medecin.alertes.anonyme')}
              </span>
              {sos.etablissement && (
                <span className="inline-flex items-center gap-1">
                  <Stethoscope className="h-3.5 w-3.5" />
                  {sos.etablissement.nom}
                </span>
              )}
              {lat != null && lng != null && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {lat.toFixed(4)}, {lng.toFixed(4)}
                </span>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setPhotoOuverte(sos.preuvePhoto || null)}
                disabled={!sos.preuvePhoto}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
              >
                {t('medecin.alertes.preuve')}
              </button>

              {mode === 'ouverte' ? (
                <button
                  type="button"
                  onClick={() => void prendre(sos)}
                  disabled={busyId === sos.id || refuse}
                  title={refuse ? t(`medecin.alertes.habilitation.${hab}`) : undefined}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busyId === sos.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Stethoscope className="h-3.5 w-3.5" />}
                  {t('medecin.alertes.prendre')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void cloturer(sos)}
                  disabled={busyId === sos.id}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busyId === sos.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  {t('medecin.alertes.cloturer')}
                </button>
              )}
            </div>
          </div>
        </div>
      </li>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('sos.chargement')}
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      {/* Bandeau de statut des actions */}
      {actionError && (
        <div role="alert" className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {actionError}
        </div>
      )}
      {succes && (
        <div role="status" className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {succes}
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-600 text-white shadow-sm">
          <Siren className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-bold text-slate-950 dark:text-white">
            {t('medecin.alertes.titre')}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('medecin.alertes.intro')}</p>
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

      {erreur ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white py-12 text-center dark:border-white/10 dark:bg-slate-900">
          <AlertTriangle className="h-8 w-8 text-amber-500" />
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">{t('sos.erreurChargement')}</p>
          <button type="button" onClick={() => { setLoading(true); void charger() }} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white dark:bg-white dark:text-slate-900">
            {t('sos.actualiser')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* ── Alertes à prendre ── */}
          <section aria-labelledby="sos-ouvertes-title">
            <div className="mb-3 flex items-center gap-2">
              <h3 id="sos-ouvertes-title" className="font-display text-base font-bold text-slate-900 dark:text-white">
                {t('medecin.alertes.ouvertesSection')}
              </h3>
              <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-black text-red-700 dark:bg-red-500/15 dark:text-red-400">
                {ouvertes.length}
              </span>
            </div>
            {ouvertes.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-200 py-10 text-center dark:border-white/10">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-white/5 dark:text-slate-500">
                  <Radio />
                </span>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{t('medecin.alertes.ouvertesEmpty')}</p>
                <p className="max-w-xs text-xs text-slate-500 dark:text-slate-400">{t('medecin.alertes.ouvertesEmptyDesc')}</p>
              </div>
            ) : (
              <ul className="space-y-3">{ouvertes.map((sos) => carte(sos, 'ouverte'))}</ul>
            )}
          </section>

          {/* ── Mes prises en charge ── */}
          <section aria-labelledby="sos-prises-title">
            <div className="mb-3 flex items-center gap-2">
              <h3 id="sos-prises-title" className="font-display text-base font-bold text-slate-900 dark:text-white">
                {t('medecin.alertes.mesPrisesSection')}
              </h3>
              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-black text-blue-700 dark:bg-blue-500/15 dark:text-blue-400">
                {mesPrises.length}
              </span>
            </div>
            {mesPrises.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-200 py-10 text-center dark:border-white/10">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-white/5 dark:text-slate-500">
                  <Stethoscope />
                </span>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{t('medecin.alertes.mesPrisesEmpty')}</p>
                <p className="max-w-xs text-xs text-slate-500 dark:text-slate-400">{t('medecin.alertes.mesPrisesEmptyDesc')}</p>
              </div>
            ) : (
              <ul className="space-y-3">{mesPrises.map((sos) => carte(sos, 'prise'))}</ul>
            )}
          </section>
        </div>
      )}

      {/* ── Visionneuse de preuve ── */}
      {photoOuverte && (
        <div
          className="fixed inset-0 z-[2500] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setPhotoOuverte(null)}
          role="dialog"
          aria-modal="true"
          aria-label={t('sos.preuve')}
        >
          <div className="max-h-full w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element -- preuve photo base64 serveur */}
            <img src={photoOuverte} alt={t('sos.preuveAlt')} className="max-h-[70vh] w-full object-contain bg-slate-100 dark:bg-slate-950" />
          </div>
        </div>
      )}
    </div>
  )
}
