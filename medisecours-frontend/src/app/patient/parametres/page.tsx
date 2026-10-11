'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RotateCcw, Save } from 'lucide-react'
import api from '../../../api/axios'
import { useToast } from '../../../components/ui/Toast'
import GlassCard from '../../../components/ui/GlassCard'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import SectionHeader from '../../../components/ui/SectionHeader'
import Toggle from '../../../components/ui/Toggle'

type PatientPrefs = {
  language: 'fr' | 'en'
  weekStart: 'monday' | 'sunday'
  compact: boolean
  animations: boolean
  notifications: {
    consultations: boolean
    messages: boolean
    sos: boolean
    avis: boolean
    etablissements: boolean
  }
}

function defaultPrefs(): PatientPrefs {
  return {
    language: 'fr',
    weekStart: 'monday',
    compact: false,
    animations: true,
    notifications: { consultations: true, messages: true, sos: true, avis: true, etablissements: true },
  }
}

function normalizePrefs(parsed: Partial<PatientPrefs> | null | undefined): PatientPrefs {
  return {
    language: parsed?.language === 'en' ? 'en' : 'fr',
    weekStart: parsed?.weekStart === 'sunday' ? 'sunday' : 'monday',
    compact: Boolean(parsed?.compact),
    animations: parsed?.animations !== false,
    notifications: {
      consultations: parsed?.notifications?.consultations !== false,
      messages: parsed?.notifications?.messages !== false,
      sos: parsed?.notifications?.sos !== false,
      avis: parsed?.notifications?.avis !== false,
      etablissements: parsed?.notifications?.etablissements !== false,
    },
  }
}

export default function PatientParametresPage() {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const [prefs, setPrefs] = useState<PatientPrefs>(defaultPrefs)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    api
      .get<{ preferences: Partial<PatientPrefs> }>('/api/me/preferences')
      .then(({ data }) => {
        if (cancelled || !data?.preferences) return
        const remote = normalizePrefs(data.preferences)
        setPrefs(remote)
        if (remote.language !== (i18n.language?.split('-')[0] ?? 'fr')) {
          void i18n.changeLanguage(remote.language)
        }
      })
      .catch(() => {
        // hors ligne : les réglages locaux restent applicables
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [i18n])

  const save = async () => {
    if (saving) return
    setSaving(true)
    try {
      const { data } = await api.patch<{ preferences: Partial<PatientPrefs> }>('/api/me/preferences', prefs)
      setPrefs(normalizePrefs(data?.preferences ?? prefs))
      toast.success(t('patient.settings.saved'))
    } catch {
      toast.error(t('patient.settings.saveError'))
    } finally {
      setSaving(false)
    }
  }

  const reset = () => {
    setPrefs(defaultPrefs())
    toast.success(t('patient.settings.resetDone'))
  }

  if (loading) {
    return <LoadingSpinner label={t('patient.settings.loading')} />
  }

  return (
    <div className="mx-auto w-full max-w-3xl min-w-0 px-3 py-6 sm:px-6">
      <SectionHeader title={t('patient.settings.title')} description={t('patient.settings.subtitle')} />

      <GlassCard className="mt-6 p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.04em] text-slate-400">{t('patient.settings.appearanceTitle')}</p>
        <div className="mt-3 space-y-3">
          <Toggle
            checked={prefs.compact}
            onChange={(value) => setPrefs((current) => ({ ...current, compact: value }))}
            label={t('patient.settings.compactLabel')}
            description={t('patient.settings.compactDesc')}
          />
          <Toggle
            checked={prefs.animations}
            onChange={(value) => setPrefs((current) => ({ ...current, animations: value }))}
            label={t('patient.settings.animationsLabel')}
            description={t('patient.settings.animationsDesc')}
          />
        </div>
      </GlassCard>

      <GlassCard className="mt-4 p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.04em] text-slate-400">{t('patient.settings.notificationsTitle')}</p>
        <div className="mt-3 space-y-3">
          <Toggle
            checked={prefs.notifications.consultations}
            onChange={(value) => setPrefs((current) => ({ ...current, notifications: { ...current.notifications, consultations: value } }))}
            label={t('patient.settings.notifConsultations')}
            description={t('patient.settings.notifConsultationsDesc')}
          />
          <Toggle
            checked={prefs.notifications.messages}
            onChange={(value) => setPrefs((current) => ({ ...current, notifications: { ...current.notifications, messages: value } }))}
            label={t('patient.settings.notifMessages')}
            description={t('patient.settings.notifMessagesDesc')}
          />
          <Toggle
            checked={prefs.notifications.sos}
            onChange={(value) => setPrefs((current) => ({ ...current, notifications: { ...current.notifications, sos: value } }))}
            label={t('patient.settings.notifSos')}
            description={t('patient.settings.notifSosDesc')}
          />
          <Toggle
            checked={prefs.notifications.avis}
            onChange={(value) => setPrefs((current) => ({ ...current, notifications: { ...current.notifications, avis: value } }))}
            label={t('patient.settings.notifAvis')}
            description={t('patient.settings.notifAvisDesc')}
          />
          <Toggle
            checked={prefs.notifications.etablissements}
            onChange={(value) => setPrefs((current) => ({ ...current, notifications: { ...current.notifications, etablissements: value } }))}
            label={t('patient.settings.notifEtablissements')}
            description={t('patient.settings.notifEtablissementsDesc')}
          />
        </div>
      </GlassCard>

      <GlassCard className="mt-4 p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.04em] text-slate-400">{t('patient.settings.languageRegionTitle')}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{t('patient.settings.languageLabel')}</span>
            <select
              value={prefs.language}
              onChange={(event) => {
                const language = event.target.value as 'fr' | 'en'
                setPrefs((current) => ({ ...current, language }))
                if (language !== i18n.language?.split('-')[0]) void i18n.changeLanguage(language)
              }}
              className="mt-1.5 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="fr">{t('patient.settings.languageFr')}</option>
              <option value="en">{t('patient.settings.languageEn')}</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{t('patient.settings.weekStartLabel')}</span>
            <select
              value={prefs.weekStart}
              onChange={(event) => setPrefs((current) => ({ ...current, weekStart: event.target.value as 'monday' | 'sunday' }))}
              className="mt-1.5 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="monday">{t('patient.settings.weekStartMonday')}</option>
              <option value="sunday">{t('patient.settings.weekStartSunday')}</option>
            </select>
          </label>
        </div>
      </GlassCard>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-mint-500 px-4 text-xs font-bold text-primary-900 transition hover:bg-mint-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? <RotateCcw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {saving ? t('patient.settings.saving') : t('patient.settings.save')}
        </button>
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-4 text-xs font-bold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {t('patient.settings.reset')}
        </button>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-400 dark:text-slate-500">{t('patient.settings.resetDesc')}</p>
    </div>
  )
}
