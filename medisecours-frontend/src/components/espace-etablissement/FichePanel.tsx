'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Building2,
  ExternalLink,
  Loader2,
  MapPin,
  Plus,
  Save,
  X,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import api from '../../api/axios'
import { useToast } from '../ui/Toast'
import { FACILITY_TYPES } from '../../lib/carte'

export type FicheCentre = {
  id: number
  nom: string
  type: string
  ville?: string | null
  region?: string | null
  quartier?: string | null
  adresse?: string | null
  telephone?: string | null
  email?: string | null
  siteWeb?: string | null
  horaires?: string | null
  urgences24h?: boolean
  description?: string | null
  services?: string[]
  specialites?: string[]
  latitude?: number | null
  longitude?: number | null
}

const REGIONS = [
  'Adamaoua',
  'Centre',
  'Est',
  'Extrême-Nord',
  'Littoral',
  'Nord',
  'Nord-Ouest',
  'Ouest',
  'Sud',
  'Sud-Ouest',
]

type Draft = {
  nom: string
  type: string
  adresse: string
  ville: string
  region: string
  quartier: string
  telephone: string
  email: string
  siteWeb: string
  horaires: string
  urgences24h: boolean
  description: string
}

const emptyDraft = (centre: FicheCentre): Draft => ({
  nom: centre.nom ?? '',
  type: centre.type || 'hopital_general',
  adresse: centre.adresse ?? '',
  ville: centre.ville ?? '',
  region: centre.region ?? '',
  quartier: centre.quartier ?? '',
  telephone: centre.telephone ?? '',
  email: centre.email ?? '',
  siteWeb: centre.siteWeb ?? '',
  horaires: centre.horaires ?? '',
  urgences24h: Boolean(centre.urgences24h),
  description: centre.description ?? '',
})

function TagEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string[]
  onChange: (next: string[]) => void
  placeholder: string
}) {
  const [draft, setDraft] = useState('')

  const commit = () => {
    const item = draft.trim()
    if (!item) return
    if (value.includes(item)) {
      setDraft('')
      return
    }
    onChange([...value, item])
    setDraft('')
  }

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((item) => (
            <span
              key={item}
              className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700 dark:bg-white/10 dark:text-slate-200"
            >
              {item}
              <button
                type="button"
                onClick={() => onChange(value.filter((existing) => existing !== item))}
                aria-label={`Retirer ${item}`}
                className="text-slate-400 transition hover:text-red-600"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ',') {
              event.preventDefault()
              commit()
            }
          }}
          className="min-h-10 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:bg-slate-900"
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={commit}
          disabled={!draft.trim()}
          className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

export default function FichePanel({
  centre,
  accent,
  onSaved,
}: {
  centre: FicheCentre
  accent: string
  onSaved: (centre: FicheCentre) => void
}) {
  const { t } = useTranslation()
  const toast = useToast()
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(centre))
  const [specialites, setSpecialites] = useState<string[]>(centre.specialites ?? [])
  const [services, setServices] = useState<string[]>(centre.services ?? [])
  const [saving, setSaving] = useState(false)
  const [prevCentre, setPrevCentre] = useState(centre)

  if (centre !== prevCentre) {
    setPrevCentre(centre)
    setDraft(emptyDraft(centre))
    setSpecialites(centre.specialites ?? [])
    setServices(centre.services ?? [])
  }

  const hasGps = centre.latitude != null && centre.longitude != null

  const update = (field: keyof Draft, nextValue: string | boolean) => {
    setDraft((current) => ({ ...current, [field]: nextValue }))
  }

  const handleSave = async () => {
    if (saving) return
    const nom = draft.nom.trim()
    const adresse = draft.adresse.trim()
    const ville = draft.ville.trim()
    if (nom.length < 2) {
      toast.error(t('etablissement.errFicheName'))
      return
    }
    if (adresse.length < 5) {
      toast.error(t('etablissement.errFicheAddress'))
      return
    }
    if (ville.length < 2) {
      toast.error(t('etablissement.errFicheCity'))
      return
    }
    if (!draft.region) {
      toast.error(t('etablissement.errFicheRegion'))
      return
    }

    setSaving(true)
    try {
      const { data } = await api.patch<{ centre: FicheCentre }>('/api/carte/mon-etablissement', {
        nom,
        type: draft.type,
        adresse,
        ville,
        region: draft.region,
        quartier: draft.quartier.trim() || null,
        telephone: draft.telephone.trim() || null,
        email: draft.email.trim() || null,
        siteWeb: draft.siteWeb.trim() || null,
        horaires: draft.horaires.trim() || null,
        urgences24h: draft.urgences24h,
        description: draft.description.trim() || null,
        specialites,
        services,
      })
      toast.success(t('etablissement.ficheSaved'))
      onSaved(data.centre)
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('etablissement.errFicheSave'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-2xl border border-white/80 bg-white/90 p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/80">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
            style={{ backgroundColor: accent }}
          >
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t('etablissement.ficheTitle')}
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
              {t('etablissement.ficheDesc')}
            </p>
          </div>
        </div>
        <Link
          href={`/carte?centre=${centre.id}`}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          {t('etablissement.fichePublicLink')}
        </Link>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* ── Informations générales ── */}
        <div className="space-y-3.5">
          <FieldLabel>{t('etablissement.ficheNameLabel')}</FieldLabel>
          <input
            value={draft.nom}
            onChange={(event) => update('nom', event.target.value)}
            className={inputCls}
            placeholder={t('etablissement.ficheNamePlaceholder')}
          />

          <FieldLabel>{t('etablissement.ficheCategoryLabel')}</FieldLabel>
          <select
            value={draft.type}
            onChange={(event) => update('type', event.target.value)}
            className={inputCls}
          >
            {FACILITY_TYPES.map((facilityType) => (
              <option key={facilityType} value={facilityType}>
                {t(`visitor.carte.type.${facilityType}`)}
              </option>
            ))}
          </select>

          <FieldLabel>{t('etablissement.ficheAddressLabel')}</FieldLabel>
          <input
            value={draft.adresse}
            onChange={(event) => update('adresse', event.target.value)}
            className={inputCls}
            placeholder={t('etablissement.ficheAddressPlaceholder')}
          />

          <div className="grid gap-3.5 sm:grid-cols-2">
            <div>
              <FieldLabel>{t('etablissement.ficheCityLabel')}</FieldLabel>
              <input
                value={draft.ville}
                onChange={(event) => update('ville', event.target.value)}
                className={inputCls}
                placeholder={t('etablissement.ficheCityPlaceholder')}
              />
            </div>
            <div>
              <FieldLabel>{t('etablissement.ficheRegionLabel')}</FieldLabel>
              <select
                value={draft.region}
                onChange={(event) => update('region', event.target.value)}
                className={inputCls}
              >
                <option value="">{t('etablissement.ficheRegionPlaceholder')}</option>
                {REGIONS.map((region) => (
                  <option key={region} value={region}>
                    {region}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <FieldLabel>{t('etablissement.ficheDistrictLabel')}</FieldLabel>
          <input
            value={draft.quartier}
            onChange={(event) => update('quartier', event.target.value)}
            className={inputCls}
            placeholder={t('etablissement.ficheDistrictPlaceholder')}
          />
        </div>

        {/* ── Coordonnées + présentation ── */}
        <div className="space-y-3.5">
          <div className="grid gap-3.5 sm:grid-cols-2">
            <div>
              <FieldLabel>{t('etablissement.fichePhoneLabel')}</FieldLabel>
              <input
                value={draft.telephone}
                onChange={(event) => update('telephone', event.target.value)}
                className={inputCls}
                placeholder="+237 6 00 00 00 00"
              />
            </div>
            <div>
              <FieldLabel>{t('etablissement.ficheEmailLabel')}</FieldLabel>
              <input
                value={draft.email}
                onChange={(event) => update('email', event.target.value)}
                className={inputCls}
                placeholder="contact@exemple.cm"
              />
            </div>
          </div>

          <FieldLabel>{t('etablissement.ficheWebsiteLabel')}</FieldLabel>
          <input
            value={draft.siteWeb}
            onChange={(event) => update('siteWeb', event.target.value)}
            className={inputCls}
            placeholder="https://…"
          />

          <FieldLabel>{t('etablissement.ficheHoursLabel')}</FieldLabel>
          <input
            value={draft.horaires}
            onChange={(event) => update('horaires', event.target.value)}
            className={inputCls}
            placeholder={t('etablissement.ficheHoursPlaceholder')}
          />

          <div
            className={`flex items-center gap-2 rounded-lg border px-3.5 py-2.5 text-xs font-semibold ${
              hasGps
                ? 'border-emerald-200 bg-emerald-50/60 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300'
                : 'border-amber-200 bg-amber-50/60 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300'
            }`}
          >
            <MapPin className="h-4 w-4 shrink-0" />
            {hasGps
              ? `${centre.latitude?.toFixed(6)}, ${centre.longitude?.toFixed(6)}`
              : t('etablissement.ficheNoGps')}
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 dark:border-slate-700 dark:bg-slate-950/40">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              {t('etablissement.ficheUrgencyLabel')}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={draft.urgences24h}
              onClick={() => update('urgences24h', !draft.urgences24h)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition ${draft.urgences24h ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'}`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                  draft.urgences24h ? 'left-[22px]' : 'left-0.5'
                }`}
              />
            </button>
          </div>

          <FieldLabel>{t('etablissement.ficheDescriptionLabel')}</FieldLabel>
          <textarea
            value={draft.description}
            onChange={(event) => update('description', event.target.value)}
            className={`${inputCls} min-h-24 resize-y`}
            placeholder={t('etablissement.ficheDescriptionPlaceholder')}
          />
        </div>

        {/* ── Tags : spécialités + services ── */}
        <div className="space-y-3.5 lg:col-span-2">
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <FieldLabel>{t('etablissement.ficheSpecialitiesLabel')}</FieldLabel>
              <TagEditor
                value={specialites}
                onChange={setSpecialites}
                placeholder={t('etablissement.ficheTagsHint')}
              />
            </div>
            <div>
              <FieldLabel>{t('etablissement.ficheServicesLabel')}</FieldLabel>
              <TagEditor
                value={services}
                onChange={setServices}
                placeholder={t('etablissement.ficheTagsHint')}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg px-6 text-sm font-bold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
          style={{ backgroundColor: accent }}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? t('etablissement.ficheSaving') : t('etablissement.ficheSave')}
        </button>
      </div>
    </section>
  )
}

const inputCls =
  'min-h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:bg-slate-900'

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-300">{children}</label>
}