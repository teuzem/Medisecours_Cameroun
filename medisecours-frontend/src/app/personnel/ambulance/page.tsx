'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AlertTriangle,
  Ambulance,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  Navigation,
  Siren,
  Stethoscope,
  UserRound,
  X,
} from 'lucide-react'
import api from '../../../api/axios'
import { useToast } from '../../../components/ui/Toast'
import GlassCard from '../../../components/ui/GlassCard'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import Toggle from '../../../components/ui/Toggle'
import SectionHeader from '../../../components/ui/SectionHeader'
import { useNotification } from '../../../contexts/NotificationContext'

interface AlerteLegere {
  id: number
  statut: string
  gravite: string
  agePatient: number | null
  enceinte: boolean
  nom: string | null
  telephone: string | null
  description: string | null
  latitude: number | null
  longitude: number | null
  sireneActive: boolean
  preuvePhoto: string | null
  etablissement: { id: number; nom: string } | null
  prisEnChargePar: { id: string; nom: string } | null
  createdAt: string
}

function coordonnee(value: number | number[] | null): number | null {
  if (typeof value === 'number') return value
  if (Array.isArray(value) && typeof value[0] === 'number') return value[0]
  return null
}

/* ──────────────────────────────────────────────────────────────────────────
 * Espace ambulancier : cas LÉGERS vérifiés de l'établissement + interventions.
 * Les cas urgents/critiques restent réservés aux médecins (tri à la lecture).
 * ────────────────────────────────────────────────────────────────────────── */
export default function PersonnelAmbulancePage() {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const { subscribeToSos } = useNotification()
  const locale = i18n.language === 'en' ? 'en-US' : 'fr-FR'

  const [enService, setEnService] = useState(true)
  const [serviceCharge, setServiceCharge] = useState(true)
  const [ouvertes, setOuvertes] = useState<AlerteLegere[]>([])
  const [mesPrises, setMesPrises] = useState<AlerteLegere[]>([])
  const [loading, setLoading] = useState(true)
  const [erreur, setErreur] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [photoOuverte, setPhotoOuverte] = useState<string | null>(null)

  useEffect(() => {
    let annule = false
    api.get('/api/me/disponibilite')
      .then(({ data }) => {
        if (!annule && typeof data?.enService === 'boolean') setEnService(data.enService)
      })
      .catch(() => undefined)
      .finally(() => {
        if (!annule) setServiceCharge(false)
      })
    return () => {
      annule = true
    }
  }, [])

  const charger = useCallback(async () => {
    try {
      const { data } = await api.get('/api/ambulancier/sos')
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

  const basculerService = async (next: boolean) => {
    try {
      await api.patch('/api/me/disponibilite', { enService: next })
      setEnService(next)
    } catch {
      toast.error(t('personnel.commun.erreur'))
    }
  }

  const msgErreur = (err: unknown): string => {
    const data = (err as any)?.response?.data
    return data?.detail || data?.message || t('personnel.ambulance.actionErreur')
  }

  const prendre = async (sos: AlerteLegere) => {
    setBusyId(sos.id)
    setActionError(null)
    try {
      await api.post(`/api/sos/${sos.id}/prise-en-charge`)
      toast.success(t('personnel.ambulance.priseOk'))
      await charger()
    } catch (err) {
      setActionError(msgErreur(err))
    } finally {
      setBusyId(null)
    }
  }

  const cloturer = async (sos: AlerteLegere) => {
    setBusyId(sos.id)
    setActionError(null)
    try {
      await api.post(`/api/sos/${sos.id}/cloturer`, {})
      toast.success(t('personnel.ambulance.clotureOk'))
      await charger()
    } catch (err) {
      setActionError(msgErreur(err))
    } finally {
      setBusyId(null)
    }
  }

  const carte = (sos: AlerteLegere, mode: 'ouverte' | 'prise') => {
    const lat = coordonnee(sos.latitude)
    const lng = coordonnee(sos.longitude)
    return (
      <li
        key={sos.id}
        className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900"
      >
        <div className="flex items-start gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${mode === 'prise' ? 'bg-mint-100 text-primary-600 dark:bg-primary-500/15 dark:text-mint-400' : 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400'}`}>
            {mode === 'prise' ? <Stethoscope className="h-5 w-5" /> : <Siren className="h-5 w-5 animate-pulse" />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                {t(`sos.gravite.${sos.gravite || 'LEGERE'}`)}
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500">
                {new Date(sos.createdAt).toLocaleString(locale)}
              </span>
            </div>
            <p className="mt-1.5 line-clamp-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
              {sos.description || <span className="font-normal italic text-slate-400">{t('personnel.ambulance.pasDescription')}</span>}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1">
                <UserRound className="h-3.5 w-3.5" />
                {sos.nom || t('personnel.ambulance.anonyme')}
              </span>
              {lat != null && lng != null && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {lat.toFixed(4)}, {lng.toFixed(4)}
                </span>
              )}
              {sos.agePatient != null && <span>{t('sos.agePatient', { age: sos.agePatient })}</span>}
              {sos.enceinte && <span className="font-semibold text-pink-600 dark:text-pink-400">{t('sos.enceinteBadge')}</span>}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {sos.preuvePhoto && (
                <button
                  type="button"
                  onClick={() => setPhotoOuverte(sos.preuvePhoto)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                >
                  {t('personnel.ambulance.preuve')}
                </button>
              )}
              {lat != null && lng != null && (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-primary-200 px-3 py-1.5 text-xs font-bold text-primary-700 transition hover:bg-primary-50 dark:border-mint-500/30 dark:text-mint-300 dark:hover:bg-mint-500/10"
                >
                  <Navigation className="h-3.5 w-3.5" />
                  {t('personnel.ambulance.itineraire')}
                </a>
              )}
              {mode === 'ouverte' ? (
                <button
                  type="button"
                  onClick={() => void prendre(sos)}
                  disabled={busyId === sos.id}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
                >
                  {busyId === sos.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ambulance className="h-3.5 w-3.5" />}
                  {t('personnel.ambulance.prendre')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void cloturer(sos)}
                  disabled={busyId === sos.id}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  {busyId === sos.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  {t('personnel.ambulance.cloturer')}
                </button>
              )}
            </div>
          </div>
        </div>
      </li>
    )
  }

  if (loading) {
    return <LoadingSpinner label={t('personnel.ambulance.chargement')} />
  }

  return (
    <div className="mx-auto w-full max-w-4xl min-w-0 px-3 py-6 sm:px-6">
      <SectionHeader
        title={t('personnel.ambulance.titre')}
        description={t('personnel.ambulance.intro')}
      />

      {actionError && (
        <div role="alert" className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {actionError}
        </div>
      )}

      {!serviceCharge && (
        <GlassCard className="mb-4 p-5">
          <Toggle
            checked={enService}
            onChange={(next) => void basculerService(next)}
            label={t('personnel.ambulance.enServiceLabel')}
            description={t('personnel.ambulance.enServiceDesc')}
          />
        </GlassCard>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
            <Clock className="h-4 w-4" />
            {t('personnel.ambulance.ouvertesTitre')} ({ouvertes.length})
          </h2>
          {erreur ? (
            <p className="text-sm text-red-600">{t('personnel.ambulance.actionErreur')}</p>
          ) : ouvertes.length === 0 ? (
            <p className="text-sm text-slate-400">{t('personnel.ambulance.aucunOuvert')}</p>
          ) : (
            <ul className="space-y-3">{ouvertes.map((sos) => carte(sos, 'ouverte'))}</ul>
          )}
        </section>
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
            <CheckCircle2 className="h-4 w-4" />
            {t('personnel.ambulance.mesPrisesTitre')} ({mesPrises.length})
          </h2>
          {mesPrises.length === 0 ? (
            <p className="text-sm text-slate-400">{t('personnel.ambulance.aucunePrise')}</p>
          ) : (
            <ul className="space-y-3">{mesPrises.map((sos) => carte(sos, 'prise'))}</ul>
          )}
        </section>
      </div>

      {photoOuverte && (
        <div
          className="fixed inset-0 z-[2500] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setPhotoOuverte(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-full w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
            {photoOuverte.startsWith('data:video/') ? (
              <video src={photoOuverte} controls playsInline preload="metadata" className="max-h-[70vh] w-full bg-black" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- preuve image base64 serveur
              <img src={photoOuverte} alt="" className="max-h-[70vh] w-full object-contain bg-slate-100 dark:bg-slate-950" />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
