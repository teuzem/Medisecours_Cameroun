'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  BadgeCheck,
  Accessibility,
  Ambulance,
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
import {
  getFacilityOptions,
  normalizeFacilityOptions,
  type FacilityOptionGroup,
} from '../../lib/facilityOptions'

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
  imageUrl?: string | null
  horaires?: string | null
  horairesDetails?: {
    weekly?: Record<string, { open?: string | null; close?: string | null; closed?: boolean }>
    holidays?: string[]
    exceptions?: string[]
  } | null
  accessibilite?: string[] | string
  ambulancesDisponibles?: boolean
  paiement?: string[] | string
  assurance?: string[] | string
  evacuationSanitaire?: string[] | string
  accesRoute?: string[] | string
  parking?: string[] | string
  langues?: string[] | string
  teleconsultation?: boolean
  priseRendezVous?: boolean
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

/**
 * Clinical service suggestions keyed by speciality. The catalogue remains
 * extensible: unknown/custom specialities still participate through the
 * multilingual token matcher below, while these explicit relations provide
 * high-confidence defaults for the common facility profiles.
 */
const SPECIALITY_SERVICE_RELATIONS: Record<string, string[]> = {
  'general-medicine': ['outpatient-consultations', 'emergency-department', 'follow-up', 'screening', 'vaccination', 'health-education'],
  'internal-medicine': ['outpatient-consultations', 'inpatient-care', 'laboratory', 'medical-imaging', 'follow-up'],
  cardiology: ['outpatient-consultations', 'emergency-department', 'medical-imaging', 'laboratory', 'cardiac-rehabilitation'],
  'cardiovascular-surgery': ['operating-room', 'intensive-care', 'inpatient-care', 'medical-imaging', 'laboratory'],
  'general-surgery': ['operating-room', 'inpatient-care', 'anesthesia', 'wound-care', 'emergency-department'],
  'digestive-surgery': ['operating-room', 'endoscopy', 'colonoscopy', 'inpatient-care', 'anesthesia'],
  'orthopedic-surgery': ['operating-room', 'medical-imaging', 'physiotherapy-unit', 'rehabilitation', 'prosthetics'],
  traumatology: ['emergency-department', 'operating-room', 'medical-imaging', 'wound-care', 'rehabilitation'],
  'pediatric-surgery': ['operating-room', 'child-health', 'anesthesia', 'inpatient-care'],
  'urologic-surgery': ['operating-room', 'endoscopy', 'inpatient-care', 'medical-imaging'],
  'plastic-surgery': ['operating-room', 'wound-care', 'burns-care', 'minor-surgery'],
  'maxillofacial-surgery': ['operating-room', 'dental-emergency', 'medical-imaging', 'wound-care'],
  'thoracic-surgery': ['operating-room', 'intensive-care', 'inpatient-care', 'medical-imaging'],
  neurosurgery: ['operating-room', 'intensive-care', 'medical-imaging', 'rehabilitation', 'inpatient-care'],
  pediatrics: ['child-health', 'vaccination', 'screening', 'neonatal-intensive-care', 'outpatient-consultations'],
  neonatology: ['neonatal-intensive-care', 'maternity', 'delivery', 'child-health', 'inpatient-care'],
  gynecology: ['maternity', 'prenatal-care', 'family-planning', 'outpatient-consultations', 'screening'],
  obstetrics: ['maternity', 'prenatal-care', 'delivery', 'cesarean-section', 'postnatal-care'],
  fertility: ['ivf', 'outpatient-consultations', 'laboratory', 'ultrasound', 'follow-up'],
  oncology: ['chemotherapy', 'radiotherapy', 'medical-imaging', 'laboratory', 'palliative-care-unit'],
  hematology: ['laboratory', 'blood-bank', 'inpatient-care', 'outpatient-consultations', 'follow-up'],
  nephrology: ['dialysis', 'laboratory', 'medical-imaging', 'outpatient-consultations', 'patient-transport'],
  urology: ['endoscopy', 'laboratory', 'medical-imaging', 'outpatient-consultations', 'minor-surgery'],
  gastroenterology: ['endoscopy', 'colonoscopy', 'medical-imaging', 'laboratory', 'outpatient-consultations'],
  hepatology: ['laboratory', 'medical-imaging', 'endoscopy', 'outpatient-consultations', 'follow-up'],
  pneumology: ['medical-imaging', 'laboratory', 'outpatient-consultations', 'emergency-department', 'follow-up'],
  endocrinology: ['outpatient-consultations', 'laboratory', 'follow-up', 'nutrition-counselling', 'screening'],
  diabetology: ['diabetes-clinic', 'laboratory', 'nutrition-counselling', 'follow-up', 'screening'],
  rheumatology: ['outpatient-consultations', 'laboratory', 'medical-imaging', 'physiotherapy-unit', 'follow-up'],
  dermatology: ['outpatient-consultations', 'screening', 'minor-surgery', 'follow-up', 'laboratory'],
  ophthalmology: ['eye-screening', 'outpatient-consultations', 'minor-surgery', 'medical-imaging', 'follow-up'],
  ent: ['hearing-test', 'outpatient-consultations', 'minor-surgery', 'speech-therapy-service', 'medical-imaging'],
  odontology: ['dental-emergency', 'oral-hygiene', 'outpatient-consultations', 'screening', 'minor-surgery'],
  psychiatry: ['mental-health', 'psychological-support', 'social-work', 'teleconsultation', 'follow-up'],
  psychology: ['psychological-support', 'mental-health', 'teleconsultation', 'follow-up', 'social-work'],
  'infectious-diseases': ['infectious-disease-clinic', 'hiv-care', 'tuberculosis-care', 'malaria-care', 'laboratory'],
  'tropical-medicine': ['malaria-care', 'infectious-disease-clinic', 'vaccination', 'screening', 'laboratory'],
  'emergency-medicine': ['emergency-department', 'ambulance', 'medical-imaging', 'laboratory', 'inpatient-care'],
  anesthesia: ['operating-room', 'intensive-care', 'critical-care', 'inpatient-care', 'emergency-department'],
  radiology: ['medical-imaging', 'x-ray', 'ultrasound', 'ct-scan', 'mri'],
  'nuclear-medicine': ['medical-imaging', 'oncology', 'screening', 'laboratory', 'follow-up'],
  pathology: ['pathology-lab', 'laboratory', 'rapid-tests', 'genetic-testing', 'home-sampling'],
  'medical-biology': ['laboratory', 'rapid-tests', 'home-sampling', 'genetic-testing', 'blood-bank'],
  'physical-rehabilitation': ['rehabilitation', 'physiotherapy-unit', 'prosthetics', 'occupational-therapy', 'speech-therapy-service'],
  physiotherapy: ['physiotherapy-unit', 'rehabilitation', 'home-care', 'follow-up', 'medical-imaging'],
  nutrition: ['nutrition-counselling', 'diabetes-clinic', 'maternal-health', 'child-health', 'follow-up'],
  geriatrics: ['outpatient-consultations', 'follow-up', 'home-care', 'physiotherapy-unit', 'social-work'],
  'occupational-medicine': ['occupational-health', 'screening', 'medical-certificates', 'follow-up', 'health-education'],
  'forensic-medicine': ['medical-certificates', 'laboratory', 'pathology-lab', 'follow-up'],
  allergology: ['outpatient-consultations', 'laboratory', 'emergency-department', 'follow-up', 'screening'],
  immunology: ['laboratory', 'vaccination', 'screening', 'follow-up', 'outpatient-consultations'],
  'medical-genetics': ['genetic-testing', 'laboratory', 'follow-up', 'screening', 'outpatient-consultations'],
  'vascular-medicine': ['medical-imaging', 'outpatient-consultations', 'wound-care', 'follow-up', 'laboratory'],
  angiology: ['medical-imaging', 'outpatient-consultations', 'wound-care', 'follow-up', 'laboratory'],
  'public-health': ['vaccination', 'screening', 'health-education', 'community-outreach', 'rapid-tests'],
  'community-medicine': ['community-outreach', 'health-education', 'vaccination', 'screening', 'maternal-health'],
  'family-medicine': ['outpatient-consultations', 'vaccination', 'maternal-health', 'child-health', 'follow-up'],
  'sports-medicine': ['physiotherapy-unit', 'rehabilitation', 'medical-imaging', 'follow-up', 'wound-care'],
  sexology: ['outpatient-consultations', 'psychological-support', 'family-planning', 'screening', 'follow-up'],
  addictology: ['mental-health', 'psychological-support', 'social-work', 'follow-up', 'teleconsultation'],
  'pain-medicine': ['pain-clinic', 'palliative-care-unit', 'physiotherapy-unit', 'follow-up', 'home-care'],
  'palliative-care': ['palliative-care-unit', 'pain-clinic', 'home-care', 'social-work', 'follow-up'],
  'sleep-medicine': ['outpatient-consultations', 'follow-up', 'medical-imaging', 'laboratory', 'teleconsultation'],
  'geriatric-psychiatry': ['mental-health', 'psychological-support', 'social-work', 'home-care', 'follow-up'],
  'speech-therapy': ['speech-therapy-service', 'occupational-therapy', 'rehabilitation', 'follow-up', 'child-health'],
  'occupational-therapy': ['occupational-therapy', 'rehabilitation', 'physiotherapy-unit', 'prosthetics', 'follow-up'],
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

function recommendedServices(selectedSpecialities: string[], selectedServices: string[]): HealthCatalogItem[] {
  const specialityItems = selectedSpecialities
    .map((label) => getCatalogItem(label, SPECIALITY_CATALOG))
    .filter(Boolean) as HealthCatalogItem[]
  const selectedItems = selectedServices
    .map((label) => getCatalogItem(label, SERVICE_CATALOG))
    .filter(Boolean) as HealthCatalogItem[]
  const selectedIds = new Set([...selectedItems.map((item) => item.id)])
  const specialityRelatedIds = new Set(
    specialityItems.flatMap((item) => SPECIALITY_SERVICE_RELATIONS[item.id] ?? []),
  )
  const serviceRelatedIds = new Set(selectedItems.flatMap((item) => SERVICE_RELATIONS[item.id] ?? []))
  const selectedTokens = [
    ...[...specialityItems, ...selectedItems].map((item) => `${item.id} ${item.fr} ${item.en}`),
    ...selectedSpecialities,
    ...selectedServices,
  ].flatMap((value) => value.split(/[-\s/&,]+/).filter((token) => token.length > 3))

  const ranked = SERVICE_CATALOG
    .filter((item) => !selectedIds.has(item.id))
    .map((item) => {
      const text = `${item.id} ${item.fr} ${item.en}`.toLocaleLowerCase()
      const tokenScore = selectedTokens.reduce(
        (score, token) => score + (text.includes(token.toLocaleLowerCase()) ? 1 : 0),
        0,
      )
      const specialityScore = specialityRelatedIds.has(item.id) ? 30 : 0
      const serviceScore = serviceRelatedIds.has(item.id) ? 12 : 0
      return { item, score: specialityScore + serviceScore + tokenScore }
    })
    .sort((left, right) => right.score - left.score || left.item.fr.localeCompare(right.item.fr))
    .slice(0, 8)
    .map(({ item }) => item)
  return ranked.length > 0
    ? ranked
    : SERVICE_CATALOG.filter((item) => !selectedIds.has(item.id)).slice(0, 8)
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
  horairesDetails: {
    weekly: Record<string, { open: string; close: string; closed: boolean }>
    holidays: string[]
    exceptions: string[]
  }
  accessibilite: string[]
  ambulancesDisponibles: boolean
  paiement: string[]
  assurance: string[]
  evacuationSanitaire: string[]
  accesRoute: string[]
  parking: string[]
  langues: string[]
  teleconsultation: boolean
  priseRendezVous: boolean
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
  horairesDetails: {
    weekly: Object.fromEntries(
      ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'].map((day) => [
        day,
        {
          open: centre.horairesDetails?.weekly?.[day]?.open ?? '',
          close: centre.horairesDetails?.weekly?.[day]?.close ?? '',
          closed: Boolean(centre.horairesDetails?.weekly?.[day]?.closed),
        },
      ]),
    ),
    holidays: centre.horairesDetails?.holidays ?? [],
    exceptions: centre.horairesDetails?.exceptions ?? [],
  },
  accessibilite: Array.isArray(centre.accessibilite) ? centre.accessibilite : typeof centre.accessibilite === 'string' ? centre.accessibilite.split(',').map((item) => item.trim()).filter(Boolean) : [],
  ambulancesDisponibles: Boolean(centre.ambulancesDisponibles),
  paiement: normalizeFacilityOptions(centre.paiement),
  assurance: normalizeFacilityOptions(centre.assurance),
  evacuationSanitaire: normalizeFacilityOptions(centre.evacuationSanitaire),
  accesRoute: normalizeFacilityOptions(centre.accesRoute),
  parking: normalizeFacilityOptions(centre.parking),
  langues: normalizeFacilityOptions(centre.langues),
  teleconsultation: Boolean(centre.teleconsultation),
  priseRendezVous: Boolean(centre.priseRendezVous),
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

function OptionMultiSelect({
  group,
  value,
  onChange,
  label,
  description,
}: {
  group: FacilityOptionGroup
  value: string[]
  onChange: (next: string[]) => void
  label: string
  description?: string
}) {
  const { t } = useTranslation()
  const selected = new Set(value)
  const options = getFacilityOptions(group)
  const toggle = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange([...next])
  }
  return (
    <fieldset className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-950/40">
      <legend className="px-1 text-xs font-bold text-slate-700 dark:text-slate-200">{label}</legend>
      {description && <p className="mb-2 text-[10px] leading-4 text-slate-500 dark:text-slate-400">{description}</p>}
      <div className="grid gap-1.5 sm:grid-cols-2">
        {options.map((option) => (
          <label key={option.id} className={`flex cursor-pointer items-start gap-2 rounded-lg border px-2.5 py-2 text-[11px] font-semibold transition ${selected.has(option.id) ? 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-500/50 dark:bg-blue-500/10 dark:text-blue-200' : 'border-transparent text-slate-600 hover:border-slate-200 hover:bg-white dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-900'}`}>
            <input type="checkbox" checked={selected.has(option.id)} onChange={() => toggle(option.id)} className="mt-0.5 accent-blue-600" />
            <span>{t(option.labelKey)}</span>
          </label>
        ))}
      </div>
    </fieldset>
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
  const serviceRecommendations = useMemo(
    () => recommendedServices(specialites, services),
    [services, specialites],
  )
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
        horairesDetails: draft.horairesDetails,
        accessibilite: draft.accessibilite,
        ambulancesDisponibles: draft.ambulancesDisponibles,
        paiement: draft.paiement,
        assurance: draft.assurance,
        evacuationSanitaire: draft.evacuationSanitaire,
        accesRoute: draft.accesRoute,
        parking: draft.parking,
        langues: draft.langues,
        teleconsultation: draft.teleconsultation,
        priseRendezVous: draft.priseRendezVous,
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

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-950/40">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">{t('etablissement.ficheHoursDetailsTitle')}</p>
            <div className="space-y-2">
              {Object.entries(draft.horairesDetails.weekly).map(([day, value]) => (
                <div key={day} className="grid grid-cols-[84px_minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2">
                  <span className="text-xs font-semibold capitalize text-slate-600 dark:text-slate-300">{day}</span>
                  <input type="time" value={value.open} disabled={value.closed} onChange={(event) => setDraft((current) => ({ ...current, horairesDetails: { ...current.horairesDetails, weekly: { ...current.horairesDetails.weekly, [day]: { ...value, open: event.target.value } } } }))} className={inputCls} />
                  <input type="time" value={value.close} disabled={value.closed} onChange={(event) => setDraft((current) => ({ ...current, horairesDetails: { ...current.horairesDetails, weekly: { ...current.horairesDetails.weekly, [day]: { ...value, close: event.target.value } } } }))} className={inputCls} />
                  <label className="flex items-center gap-1 text-[10px] font-semibold text-slate-500"><input type="checkbox" checked={value.closed} onChange={(event) => setDraft((current) => ({ ...current, horairesDetails: { ...current.horairesDetails, weekly: { ...current.horairesDetails.weekly, [day]: { ...value, closed: event.target.checked } } } }))} />{t('etablissement.ficheClosedLabel')}</label>
                </div>
              ))}
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <input value={draft.horairesDetails.holidays.join(', ')} onChange={(event) => setDraft((current) => ({ ...current, horairesDetails: { ...current.horairesDetails, holidays: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) } }))} className={inputCls} placeholder={t('etablissement.ficheHolidaysPlaceholder')} />
              <input value={draft.horairesDetails.exceptions.join(', ')} onChange={(event) => setDraft((current) => ({ ...current, horairesDetails: { ...current.horairesDetails, exceptions: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) } }))} className={inputCls} placeholder={t('etablissement.ficheExceptionsPlaceholder')} />
            </div>
          </div>

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

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-950/40">
            <div className="flex items-center gap-2">
              <Accessibility className="h-4 w-4 text-blue-600" />
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{t('etablissement.ficheAccessibilityLabel')}</p>
            </div>
            <p className="mt-1 text-[10px] leading-4 text-slate-500 dark:text-slate-400">{t('etablissement.ficheAccessibilityDescription')}</p>
            <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {getFacilityOptions('accessibility').map((option) => (
                <label key={option.id} className={`flex cursor-pointer items-start gap-2 rounded-lg border px-2.5 py-2 text-[11px] font-semibold transition ${draft.accessibilite.includes(option.id) ? 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-500/50 dark:bg-blue-500/10 dark:text-blue-200' : 'border-transparent text-slate-600 hover:border-slate-200 hover:bg-white dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-900'}`}>
                  <input type="checkbox" checked={draft.accessibilite.includes(option.id)} onChange={() => setDraft((current) => ({ ...current, accessibilite: current.accessibilite.includes(option.id) ? current.accessibilite.filter((item) => item !== option.id) : [...current.accessibilite, option.id] }))} className="mt-0.5 accent-blue-600" />
                  <span>{t(option.labelKey)}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 dark:border-slate-700 dark:bg-slate-950/40">
            <span className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <Ambulance className="h-4 w-4 text-red-600" />
              {t('etablissement.ficheAmbulanceLabel')}
            </span>
            <button type="button" role="switch" aria-checked={draft.ambulancesDisponibles} onClick={() => update('ambulancesDisponibles', !draft.ambulancesDisponibles)} className={`relative h-6 w-11 shrink-0 rounded-full transition ${draft.ambulancesDisponibles ? 'bg-red-600' : 'bg-slate-300 dark:bg-slate-700'}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${draft.ambulancesDisponibles ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <OptionMultiSelect
              group="payment"
              value={draft.paiement}
              onChange={(value) => setDraft((current) => ({ ...current, paiement: value }))}
              label={t('etablissement.fichePaymentLabel')}
              description={t('etablissement.fichePaymentDescription')}
            />
            <OptionMultiSelect
              group="insurance"
              value={draft.assurance}
              onChange={(value) => setDraft((current) => ({ ...current, assurance: value }))}
              label={t('etablissement.ficheInsuranceLabel')}
              description={t('etablissement.ficheInsuranceDescription')}
            />
            <OptionMultiSelect
              group="evacuation"
              value={draft.evacuationSanitaire}
              onChange={(value) => setDraft((current) => ({ ...current, evacuationSanitaire: value }))}
              label={t('etablissement.ficheEvacuationLabel')}
              description={t('etablissement.ficheEvacuationDescription')}
            />
            <OptionMultiSelect
              group="roadAccess"
              value={draft.accesRoute}
              onChange={(value) => setDraft((current) => ({ ...current, accesRoute: value }))}
              label={t('etablissement.ficheRoadAccessLabel')}
              description={t('etablissement.ficheRoadAccessDescription')}
            />
            <OptionMultiSelect
              group="parking"
              value={draft.parking}
              onChange={(value) => setDraft((current) => ({ ...current, parking: value }))}
              label={t('etablissement.ficheParkingLabel')}
              description={t('etablissement.ficheParkingDescription')}
            />
            <OptionMultiSelect
              group="languages"
              value={draft.langues}
              onChange={(value) => setDraft((current) => ({ ...current, langues: value }))}
              label={t('etablissement.ficheLanguagesLabel')}
              description={t('etablissement.ficheLanguagesDescription')}
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-300">
              <span>{t('etablissement.ficheTeleconsultationLabel')}</span>
              <input type="checkbox" checked={draft.teleconsultation} onChange={(event) => setDraft((current) => ({ ...current, teleconsultation: event.target.checked }))} className="h-4 w-4 accent-blue-600" />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-300">
              <span>{t('etablissement.ficheAppointmentsLabel')}</span>
              <input type="checkbox" checked={draft.priseRendezVous} onChange={(event) => setDraft((current) => ({ ...current, priseRendezVous: event.target.checked }))} className="h-4 w-4 accent-blue-600" />
            </label>
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
