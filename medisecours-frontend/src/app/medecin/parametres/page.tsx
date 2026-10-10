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

type MedecinPrefs = {
  language: 'fr' | 'en'
  weekStart: 'monday' | 'sunday'
  compact: boolean
  animations: boolean
  notifications: {
    consultations: boolean
    messages: boolean
    sos: boolean
    avis: boolean
  }
}

function defaultPrefs(): MedecinPrefs {
  return {
    language: 'fr',
    weekStart: 'monday',
    compact: false,
    animations: true,
    notifications: { consultations: true, messages: true, sos: true, avis: true },
  }
}

function normalizePrefs(parsed: Partial<MedecinPrefs> | null | undefined): MedecinPrefs {
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
    },
  }
}

export default function ParametresPage() {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const [prefs, setPrefs] = useState<MedecinPrefs>(defaultPrefs)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    api
      .get<{ preferences: Partial<MedecinPrefs> }>('/api/me/preferences')
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
      const { data } = await api.patch<{ preferences: Partial<MedecinPrefs> }>('/api/me/preferences', prefs)
      setPrefs(normalizePrefs(data?.preferences ?? prefs))
      toast.success(t('medecin.settings.saved'))
    } catch {
      toast.error(t('medecin.settings.saveError'))
    } finally {
      setSaving(false)
    }
  }

  const reset = () => {
    setPrefs(defaultPrefs())
    toast.success(t('medecin.settings.resetDone'))
  }

  if (loading) {
    return <LoadingSpinner label={t('medecin.settings.loading')} />
  }

  return (
    <div className="mx-auto w-full max-w-3xl min-w-0 px-3 py-6 sm:px-6">
      <SectionHeader
        title={t('medecin.settings.title')}
        description={t('medecin.settings.description')}
      />

      <GlassCard className="mt-6 p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.04em] text-slate-400">{t('medecin.settings.appearanceTitle')}</p>
        <div className="mt-3 space-y-3">
          <Toggle
            checked={prefs.compact}
            onChange={(value) => setPrefs((current) => ({ ...current, compact: value }))}
            label={t('medecin.settings.compactLabel')}
            description={t('medecin.settings.compactDesc')}
          />
          <Toggle
            checked={prefs.animations}
            onChange={(value) => setPrefs((current) => ({ ...current, animations: value }))}
            label={t('medecin.settings.animationsLabel')}
            description={t('medecin.settings.animationsDesc')}
          />
        </div>
      </GlassCard>

      <GlassCard className="mt-4 p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.04em] text-slate-400">{t('medecin.settings.notificationsTitle')}</p>
        <div className="mt-3 space-y-3">
          <Toggle
            checked={prefs.notifications.consultations}
            onChange={(value) => setPrefs((current) => ({ ...current, notifications: { ...current.notifications, consultations: value } }))}
            label={t('medecin.settings.notifConsultations')}
            description={t('medecin.settings.notifConsultationsDesc')}
          />
          <Toggle
            checked={prefs.notifications.messages}
            onChange={(value) => setPrefs((current) => ({ ...current, notifications: { ...current.notifications, messages: value } }))}
            label={t('medecin.settings.notifMessages')}
            description={t('medecin.settings.notifMessagesDesc')}
          />
          <Toggle
            checked={prefs.notifications.sos}
            onChange={(value) => setPrefs((current) => ({ ...current, notifications: { ...current.notifications, sos: value } }))}
            label={t('medecin.settings.notifSos')}
            description={t('medecin.settings.notifSosDesc')}
          />
          <Toggle
            checked={prefs.notifications.avis}
            onChange={(value) => setPrefs((current) => ({ ...current, notifications: { ...current.notifications, avis: value } }))}
            label={t('medecin.settings.notifAvis')}
            description={t('medecin.settings.notifAvisDesc')}
          />
        </div>
      </GlassCard>

      <GlassCard className="mt-4 p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.04em] text-slate-400">{t('medecin.settings.languageRegionTitle')}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{t('medecin.settings.languageLabel')}</span>
            <select
              value={prefs.language}
              onChange={(event) => {
                const language = event.target.value as 'fr' | 'en'
                setPrefs((current) => ({ ...current, language }))
                if (language !== i18n.language?.split('-')[0]) void i18n.changeLanguage(language)
              }}
              className="mt-1.5 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="fr">{t('medecin.settings.languageFr')}</option>
              <option value="en">{t('medecin.settings.languageEn')}</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{t('medecin.settings.weekStartLabel')}</span>
            <select
              value={prefs.weekStart}
              onChange={(event) => setPrefs((current) => ({ ...current, weekStart: event.target.value as 'monday' | 'sunday' }))}
              className="mt-1.5 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="monday">{t('medecin.settings.weekStartMonday')}</option>
              <option value="sunday">{t('medecin.settings.weekStartSunday')}</option>
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
          {saving ? t('medecin.settings.saving') : t('medecin.settings.save')}
        </button>
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-4 text-xs font-bold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {t('medecin.settings.reset')}
        </button>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-400 dark:text-slate-500">{t('medecin.settings.resetDesc')}</p>
    </div>
  )
}
