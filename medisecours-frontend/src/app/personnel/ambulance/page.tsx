'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AlertTriangle,
  Ambulance,
  CheckCircle2,
  Clock,
  History,
  Loader2,
  MapPin,
  RefreshCw,
  Siren,
  Stethoscope,
  UserRound,
} from 'lucide-react'
import api from '../../../api/axios'
import { useToast } from '../../../components/ui/Toast'
import GlassCard from '../../../components/ui/GlassCard'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import Toggle from '../../../components/ui/Toggle'
import SectionHeader from '../../../components/ui/SectionHeader'
import { SosJournal } from '../../../components/sos/SosJournal'
import { SosPosition } from '../../../components/sos/SosPosition'
import { SosPreuve } from '../../../components/sos/SosPreuve'
import { SosProgression } from '../../../components/sos/SosProgression'
import { SosStatsTiles } from '../../../components/sos/SosStatsTiles'
import { useSosFeedback, useSosFeed } from '../../../hooks/useSosFeed'
import { messageErreur, type AlerteSos } from '../../../lib/sosWorkflow'

function coordonnee(value: number | number[] | null): number | null {
  if (typeof value === 'number') return value
  if (Array.isArray(value) && typeof value[0] === 'number') return value[0]
  return null
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * Espace amblancier : cas LÃ‰GERS vÃ©rifiÃ©s de l'Ã©tablissement + interventions.
 * Les cas urgents/critiques restent rÃ©servÃ©s aux mÃ©decins (tri Ã  la lecture).
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
export default function PersonnelAmbulancePage() {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const locale = i18n.language === 'en' ? 'en-US' : 'fr-FR'

  const [enService, setEnService] = useState(true)
  const [serviceCharge, setServiceCharge] = useState(true)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [journalId, setJournalId] = useState<number | null>(null)

  const { ouvertes, mesPrises, stats, loading, erreur, rafraichissement, rafraichir } = useSosFeed('/api/ambulancier/sos')
  const { erreur: actionError, signalerErreur, signalerSucces, reinitialiser } = useSosFeedback()

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

  const basculerService = async (next: boolean) => {
    try {
      await api.patch('/api/me/disponibilite', { enService: next })
      setEnService(next)
    } catch {
      toast.error(t('personnel.commun.erreur'))
    }
  }

  const prendre = async (sos: AlerteSos) => {
    setBusyId(sos.id)
    reinitialiser()
    try {
      await api.post(`/api/sos/${sos.id}/prise-en-charge`)
      signalerSucces(t('personnel.ambulance.priseOk'))
      await rafraichir()
    } catch (err) {
      signalerErreur(err, 'personnel.ambulance.actionErreur')
    } finally {
      setBusyId(null)
    }
  }

  const carte = (sos: AlerteSos, mode: 'ouverte' | 'prise') => {
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
              <SosPreuve preuve={sos.preuvePhoto} type={sos.preuveType} />
              <button
                type="button"
                onClick={() => setJournalId(sos.id)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
              >
                <History className="h-3.5 w-3.5" />
                {t('sos.journal')}
              </button>
              {/* SosPosition porte la carte, l'itinÃ©raire, l'appel et les partages. */}
              <SosPosition latitude={lat} longitude={lng} nom={sos.nom} telephone={sos.telephone} />
              {mode === 'ouverte' && (
                <button
                  type="button"
                  onClick={() => void prendre(sos)}
                  disabled={busyId === sos.id || !enService}
                  title={!enService ? t('personnel.ambulance.horsService') : undefined}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busyId === sos.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ambulance className="h-3.5 w-3.5" />}
                  {t('personnel.ambulance.prendre')}
                </button>
              )}
            </div>
            {mode === 'prise' && (
              <SosProgression sos={sos} onChange={rafraichir} disabled={busyId === sos.id} />
            )}
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
      <div className="flex items-start gap-3">
        <SectionHeader title={t('personnel.ambulance.titre')} description={t('personnel.ambulance.intro')} />
        <button
          type="button"
          onClick={() => void rafraichir()}
          aria-label={t('sos.actualiser')}
          className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/5"
        >
          <RefreshCw className={`h-4 w-4 ${rafraichissement ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <SosStatsTiles stats={stats} />

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

      {journalId !== null && <SosJournal sosId={journalId} onClose={() => setJournalId(null)} />}
    </div>
  )
}

