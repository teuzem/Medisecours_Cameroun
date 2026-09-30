'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  BadgeCheck,
  Building2,
  Clock,
  ExternalLink,
  FileImage,
  Loader2,
  MapPin,
  Navigation,
  Plus,
  Search,
  Save,
  ShieldCheck,
  Star,
  X,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import api from '../../api/axios'
import { useToast } from '../ui/Toast'
import { FACILITY_TYPES } from '../../lib/carte'
import {
  SERVICE_CATALOG,
  SPECIALITY_CATALOG,
  type HealthCatalogItem,
  type HealthCatalogKind,
} from '../../lib/healthCatalog'

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
  verificationStatut?: string | null
  statut?: string | null
  noteMoyenne?: number | null
  totalAvis?: number
  images?: { id: number; contentUrl: string; kind: 'image' | 'video' }[]
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

const REGION_KEYS = [
  'adamaoua',
  'centre',
  'est',
  'extremeNord',
  'littoral',
  'nord',
  'nordOuest',
  'ouest',
  'sud',
  'sudOuest',
] as const

const SERVICE_RELATIONS: Record<string, string[]> = {
  'emergency-department': ['intensive-care', 'critical-care', 'ambulance', 'medical-imaging', 'laboratory', 'inpatient-care'],
  'outpatient-consultations': ['follow-up', 'second-opinion', 'teleconsultation', 'medical-certificates'],
  maternity: ['prenatal-care', 'delivery', 'postnatal-care', 'neonatal-intensive-care', 'family-planning'],
  'prenatal-care': ['maternity', 'delivery', 'postnatal-care', 'maternal-health', 'family-planning'],
  delivery: ['maternity', 'prenatal-care', 'postnatal-care', 'neonatal-intensive-care'],
  pediatrics: ['child-health', 'vaccination', 'neonatal-intensive-care', 'screening'],
  laboratory: ['rapid-tests', 'blood-bank', 'pathology-lab', 'home-sampling', 'genetic-testing'],
  'medical-imaging': ['x-ray', 'ultrasound', 'ct-scan', 'mri', 'mammography'],
  'operating-room': ['anesthesia', 'inpatient-care', 'wound-care', 'burns-care'],
  'intensive-care': ['critical-care', 'emergency-department', 'inpatient-care', 'medical-imaging'],
  pharmacy: ['vaccination', 'medical-device-rental', 'rapid-tests', 'follow-up'],
  dialysis: ['laboratory', 'medical-imaging', 'patient-transport', 'follow-up'],
  oncology: ['chemotherapy', 'radiotherapy', 'medical-imaging', 'laboratory', 'palliative-care-unit'],
  'mental-health': ['psychological-support', 'social-work', 'teleconsultation', 'follow-up'],
  rehabilitation: ['physiotherapy-unit', 'prosthetics', 'occupational-therapy', 'speech-therapy-service'],
}

const canonicalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()

function getCatalogItem(label: string, catalog: HealthCatalogItem[]) {
  const normalized = canonicalize(label)
  return catalog.find(
    (item) =>
      canonicalize(item.id) === normalized ||
      canonicalize(item.fr) === normalized ||
      canonicalize(item.en) === normalized,
  )
}

function recommendedServices(selected: string[]): HealthCatalogItem[] {
  const selectedItems = selected
    .map((label) => getCatalogItem(label, SERVICE_CATALOG))
    .filter(Boolean) as HealthCatalogItem[]
  const selectedIds = new Set(selectedItems.map((item) => item.id))
  const relatedIds = new Set(selectedItems.flatMap((item) => SERVICE_RELATIONS[item.id] ?? []))
  const selectedTokens = selectedItems.flatMap((item) =>
    `${item.id} ${item.fr} ${item.en}`.split(/[-\s/&,]+/).filter((token) => token.length > 3),
  )

  const ranked = SERVICE_CATALOG
    .filter((item) => !selectedIds.has(item.id))
    .map((item) => {
      const text = `${item.id} ${item.fr} ${item.en}`.toLocaleLowerCase()
      const tokenScore = selectedTokens.reduce(
        (score, token) => score + (text.includes(token.toLocaleLowerCase()) ? 1 : 0),
        0,
      )
      return { item, score: (relatedIds.has(item.id) ? 10 : 0) + tokenScore }
    })
    .sort((left, right) => right.score - left.score || left.item.fr.localeCompare(right.item.fr))
    .slice(0, 8)
    .map(({ item }) => item)
  return ranked.length > 0 ? ranked : SERVICE_CATALOG.slice(0, 8)
}

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

function CatalogTagEditor({
  value,
  onChange,
  placeholder,
  kind,
  accent,
  recommendations = [],
}: {
  value: string[]
  onChange: (next: string[]) => void
  placeholder: string
  kind: HealthCatalogKind
  accent: string
  recommendations?: HealthCatalogItem[]
}) {
  const [draft, setDraft] = useState('')
  const [open, setOpen] = useState(false)
  const { t, i18n } = useTranslation()
  const language = i18n.language === 'en' ? 'en' : 'fr'
  const catalog = kind === 'service' ? SERVICE_CATALOG : SPECIALITY_CATALOG
  const normalized = draft.trim().toLocaleLowerCase(language)
  const suggestions = useMemo(
    () =>
      catalog
        .filter((item) => !value.some((existing) => canonicalize(existing) === canonicalize(item.fr) || canonicalize(existing) === canonicalize(item.en)))
        .filter((item) => {
          if (!normalized) return true
          return [item.fr, item.en, item.id].some((candidate) =>
            canonicalize(candidate).includes(canonicalize(normalized)),
          )
        })
        .slice(0, 10),
    [catalog, normalized, value],
  )

  const commit = (label = draft) => {
    const item = label.trim()
    if (!item) return
    const match = catalog.find(
      (candidate) =>
        canonicalize(candidate.fr) === canonicalize(item) ||
        canonicalize(candidate.en) === canonicalize(item),
    )
    const valueToAdd = match?.fr ?? item
    if (value.some((existing) => canonicalize(existing) === canonicalize(valueToAdd))) {
      setDraft('')
      return
    }
    onChange([...value, valueToAdd])
    setDraft('')
    setOpen(false)
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
              {(() => {
                const known = catalog.find(
                  (candidate) => canonicalize(candidate.fr) === canonicalize(item) || canonicalize(candidate.en) === canonicalize(item),
                )
                return known ? (language === 'en' ? known.en : known.fr) : item
              })()}
              <button
                type="button"
                onClick={() => onChange(value.filter((existing) => existing !== item))}
                aria-label={t('etablissement.removeTag', { item: (() => {
                  const known = catalog.find(
                    (candidate) => canonicalize(candidate.fr) === canonicalize(item) || canonicalize(candidate.en) === canonicalize(item),
                  )
                  return known ? (language === 'en' ? known.en : known.fr) : item
                })() })}
                className="text-slate-400 transition hover:text-red-600"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      {kind === 'service' && recommendations.length > 0 && (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/70 p-2.5 dark:border-slate-700 dark:bg-slate-950/40">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
            {value.length > 0 ? t('etablissement.ficheRelatedServices') : t('etablissement.fichePopularServices')}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {recommendations.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => commit(item.fr)}
                className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-600 transition hover:border-transparent hover:text-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                onMouseEnter={(event) => { event.currentTarget.style.backgroundColor = accent }}
                onMouseLeave={(event) => { event.currentTarget.style.backgroundColor = '' }}
              >
                {language === 'en' ? item.en : item.fr}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="relative flex gap-2">
        <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" aria-hidden="true" />
        <input
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ',') {
              event.preventDefault()
              commit()
            }
          }}
          className="min-h-10 flex-1 rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:bg-slate-900"
          placeholder={placeholder}
          aria-label={placeholder}
          aria-autocomplete="list"
        />
        {open && suggestions.length > 0 && (
          <div className="absolute left-0 right-12 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
            {suggestions.map((item: HealthCatalogItem) => (
              <button
                key={item.id}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault()
                  commit(language === 'en' ? item.en : item.fr)
                }}
                className="flex w-full items-start justify-between gap-3 rounded-md px-3 py-2 text-left text-xs transition hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <span className="min-w-0">
                  <span className="block truncate font-bold text-slate-800 dark:text-slate-100">
                    {language === 'en' ? item.en : item.fr}
                  </span>
                  <span className="block truncate text-[10px] text-slate-400">
                    {language === 'en' ? item.fr : item.en}
                  </span>
                </span>
                <span className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-white" style={{ backgroundColor: accent }}>
                  {kind === 'service' ? t('etablissement.ficheServicesLabel') : t('etablissement.ficheSpecialitiesLabel')}
                </span>
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => commit()}
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
  const mapsUrl =
    hasGps ? `https://www.google.com/maps?q=${centre.latitude},${centre.longitude}` : null
  const serviceRecommendations = useMemo(() => recommendedServices(services), [services])
  const completionItems = [
    { key: 'identity', label: t('etablissement.ficheCompletionIdentity'), complete: draft.nom.trim().length >= 2 && Boolean(draft.type) },
    { key: 'location', label: t('etablissement.ficheCompletionLocation'), complete: draft.adresse.trim().length >= 5 && draft.ville.trim().length >= 2 && Boolean(draft.region) },
    { key: 'coordinates', label: t('etablissement.ficheCompletionCoordinates'), complete: hasGps },
    { key: 'contact', label: t('etablissement.ficheCompletionContact'), complete: Boolean(draft.telephone.trim() || draft.email.trim()) },
    { key: 'hours', label: t('etablissement.ficheCompletionHours'), complete: Boolean(draft.horaires.trim()) },
    { key: 'description', label: t('etablissement.ficheCompletionDescription'), complete: draft.description.trim().length >= 40 },
    { key: 'specialities', label: t('etablissement.ficheCompletionSpecialities'), complete: specialites.length > 0 },
    { key: 'services', label: t('etablissement.ficheCompletionServices'), complete: services.length > 0 },
    { key: 'media', label: t('etablissement.ficheCompletionMedia'), complete: (centre.images?.length ?? 0) > 0 },
  ]
  const completionCount = completionItems.filter((item) => item.complete).length
  const completionPercent = Math.round((completionCount / completionItems.length) * 100)

  const verificationChip = (() => {
    const status = centre.verificationStatut
    if (status === 'VERIFIE') {
      return {
        label: t('etablissement.verificationOk'),
        cls: 'border-mint-200 bg-mint-50 text-mint-700 dark:border-mint-500/25 dark:bg-mint-500/15 dark:text-mint-300',
        Icon: BadgeCheck,
      }
    }
    if (status === 'EN_COURS') {
      return {
        label: t('etablissement.verificationPending'),
        cls: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/15 dark:text-amber-300',
        Icon: Clock,
      }
    }
    if (status) {
      return {
        label: t('etablissement.verificationNone'),
        cls: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-300',
        Icon: ShieldCheck,
      }
    }
    return null
  })()

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

      {(verificationChip || centre.noteMoyenne != null) && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {verificationChip && (
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${verificationChip.cls}`}>
              <verificationChip.Icon className="h-3.5 w-3.5" />
              {verificationChip.label}
            </span>
          )}
          {centre.noteMoyenne != null && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/15 dark:text-amber-300">
              <Star className="h-3.5 w-3.5 fill-current" />
              {Number(centre.noteMoyenne).toFixed(1)}/5 · {centre.totalAvis ?? 0} {t('etablissement.avisCountLabel')}
            </span>
          )}
          {!!centre.images?.length && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-bold text-sky-700 dark:border-sky-500/25 dark:bg-sky-500/15 dark:text-sky-300">
              <FileImage className="h-3.5 w-3.5" />
              {centre.images.length} {t('etablissement.ficheMediaCount')}
            </span>
          )}
        </div>
      )}

      <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-950/40">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
              {t('etablissement.ficheCompletionTitle')}
            </p>
            <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
              {completionPercent === 100
                ? t('etablissement.ficheCompletionReady')
                : t('etablissement.ficheCompletionProgress', { count: completionPercent })}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {t('etablissement.ficheCompletionHint')}
            </p>
          </div>
          <span className="text-2xl font-black text-slate-900 dark:text-white">{completionPercent}%</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div className="h-full rounded-full transition-all" style={{ width: `${completionPercent}%`, backgroundColor: accent }} />
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {completionItems.map((item) => (
            <div key={item.key} className={`flex items-center gap-2 text-xs font-semibold ${item.complete ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-500 dark:text-slate-400'}`}>
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black ${item.complete ? 'bg-emerald-100 dark:bg-emerald-500/20' : 'bg-slate-200 dark:bg-slate-800'}`}>
                {item.complete ? '✓' : '·'}
              </span>
              {item.label}
            </div>
          ))}
        </div>
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
                {REGIONS.map((region, index) => (
                  <option key={region} value={region}>
                    {t(`etablissement.regions.${REGION_KEYS[index]}`, { defaultValue: region })}
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
                placeholder={t('etablissement.fichePhonePlaceholder')}
              />
            </div>
            <div>
              <FieldLabel>{t('etablissement.ficheEmailLabel')}</FieldLabel>
              <input
                value={draft.email}
                onChange={(event) => update('email', event.target.value)}
                className={inputCls}
                placeholder={t('etablissement.ficheEmailPlaceholder')}
              />
            </div>
          </div>

          <FieldLabel>{t('etablissement.ficheWebsiteLabel')}</FieldLabel>
          <input
            value={draft.siteWeb}
            onChange={(event) => update('siteWeb', event.target.value)}
            className={inputCls}
            placeholder={t('etablissement.ficheWebsitePlaceholder')}
          />

          <FieldLabel>{t('etablissement.ficheHoursLabel')}</FieldLabel>
          <input
            value={draft.horaires}
            onChange={(event) => update('horaires', event.target.value)}
            className={inputCls}
            placeholder={t('etablissement.ficheHoursPlaceholder')}
          />

          <div
            className={`flex items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 text-xs font-semibold ${
              hasGps
                ? 'border-emerald-200 bg-emerald-50/60 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300'
                : 'border-amber-200 bg-amber-50/60 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300'
            }`}
          >
            <span className="flex min-w-0 items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {hasGps
                  ? `${centre.latitude?.toFixed(6)}, ${centre.longitude?.toFixed(6)}`
                  : t('etablissement.ficheNoGps')}
              </span>
            </span>
            {hasGps && mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-lg border border-emerald-300/60 bg-white/60 px-2.5 text-[10px] font-bold text-emerald-700 transition hover:bg-white dark:border-emerald-700/60 dark:bg-slate-950/40 dark:text-emerald-300"
              >
                <Navigation className="h-3 w-3" />
                {t('etablissement.ficheGpsOpen')}
              </a>
            )}
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
              <CatalogTagEditor
                value={specialites}
                onChange={setSpecialites}
                placeholder={t('etablissement.ficheTagsHint')}
                kind="speciality"
                accent={accent}
              />
            </div>
            <div>
              <FieldLabel>{t('etablissement.ficheServicesLabel')}</FieldLabel>
              <CatalogTagEditor
                value={services}
                onChange={setServices}
                placeholder={t('etablissement.ficheTagsHint')}
                kind="service"
                accent={accent}
                recommendations={serviceRecommendations}
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
