'use client'

import { useEffect, useId, useState } from 'react'
import { Building2, Check, LoaderCircle, MapPin, Plus, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import api from '../../api/axios'
import { useDebounce } from '../../hooks/useDebounce'
import EstablishmentLocation from './EstablishmentLocation'
import {
  FACILITY_TYPES,
  type CarteCentre,
  type EtablissementType,
} from '../../lib/carte'

export type ManualEstablishment = {
  nom: string
  type: EtablissementType
  adresse: string
  ville: string
  region: string
  latitude?: number
  longitude?: number
}

export type EstablishmentChoice =
  | { mode: 'existing'; centre: CarteCentre }
  | { mode: 'manual'; establishment: ManualEstablishment }

type Props = {
  value: EstablishmentChoice | null
  error?: string
  inputClass: string
  onChange: (value: EstablishmentChoice | null) => void
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

const emptyManual: ManualEstablishment = {
  nom: '',
  type: 'hopital_general',
  adresse: '',
  ville: '',
  region: 'Centre',
}

function extractCentres(response: { data?: unknown }): CarteCentre[] {
  const data = response.data as {
    'hydra:member'?: unknown
    member?: unknown
  } | undefined
  const raw = data?.['hydra:member'] ?? data?.member ?? response.data
  return Array.isArray(raw) ? (raw as CarteCentre[]) : []
}

export default function EstablishmentSelector({ value, error, inputClass, onChange }: Props) {
  const { t } = useTranslation()
  const listId = useId()
  const [query, setQuery] = useState('')
  const [type, setType] = useState('')
  const [region, setRegion] = useState('')
  const [ville, setVille] = useState('')
  const [results, setResults] = useState<CarteCentre[]>([])
  const [loading, setLoading] = useState(true)
  const [searchError, setSearchError] = useState(false)
  const debouncedQuery = useDebounce(query, 250)
  const debouncedVille = useDebounce(ville, 250)

  useEffect(() => {
    if (value) return

    const controller = new AbortController()

    api
      .get('/api/carte/etablissements', {
        params: {
          q: debouncedQuery.trim() || undefined,
          type: type || undefined,
          region: region || undefined,
          ville: debouncedVille.trim() || undefined,
          limit: 20,
        },
        signal: controller.signal,
      })
      .then((response) => {
        setResults(extractCentres(response))
        setSearchError(false)
      })
      .catch((requestError: any) => {
        if (requestError?.name !== 'CanceledError' && requestError?.message !== 'canceled') {
          setResults([])
          setSearchError(true)
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [debouncedQuery, debouncedVille, region, type, value])

  const beginSearch = () => {
    setLoading(true)
    setSearchError(false)
  }

  const updateManual = (field: keyof ManualEstablishment, nextValue: string) => {
    const current = value?.mode === 'manual' ? value.establishment : emptyManual
    onChange({
      mode: 'manual',
      establishment: {
        ...current,
        ...(['adresse', 'ville', 'region'].includes(field) ? { latitude: undefined, longitude: undefined } : {}),
        [field]: nextValue,
      },
    })
  }

  if (value?.mode === 'manual') {
    const manual = value.establishment
    return (
      <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/40 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/15">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              {t('visitor.register.manualEstablishmentTitle')}
            </p>
            <p className="mt-1 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
              {t('visitor.register.manualEstablishmentDesc')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              beginSearch()
              onChange(null)
            }}
            className="shrink-0 text-xs font-bold text-blue-700 hover:text-blue-900 dark:text-blue-300"
          >
            {t('visitor.register.backToSearch')}
          </button>
        </div>

        <input
          value={manual.nom}
          onChange={(event) => updateManual('nom', event.target.value)}
          className={inputClass}
          placeholder={t('visitor.register.establishmentNamePlaceholder')}
          aria-invalid={Boolean(error)}
        />
        <EstablishmentLocation onSelect={(location) => onChange({
          mode: 'manual', establishment: { ...manual, ...location },
        })} />
        {manual.latitude != null && manual.longitude != null && <p className="text-xs text-emerald-700">Position selectionnee : {manual.latitude.toFixed(6)}, {manual.longitude.toFixed(6)}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <select
            value={manual.type}
            onChange={(event) => updateManual('type', event.target.value)}
            className={inputClass}
          >
            {FACILITY_TYPES.map((facilityType) => (
              <option key={facilityType} value={facilityType}>
                {t(`visitor.carte.type.${facilityType}`)}
              </option>
            ))}
          </select>
          <select
            value={manual.region}
            onChange={(event) => updateManual('region', event.target.value)}
            className={inputClass}
          >
            {REGIONS.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            value={manual.ville}
            onChange={(event) => updateManual('ville', event.target.value)}
            className={inputClass}
            placeholder={t('visitor.register.establishmentCityPlaceholder')}
          />
          <input
            value={manual.adresse}
            onChange={(event) => updateManual('adresse', event.target.value)}
            className={inputClass}
            placeholder={t('visitor.register.establishmentAddressPlaceholder')}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {value?.mode === 'existing' && (
        <div className="flex items-start gap-3 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 dark:border-emerald-900/70 dark:bg-emerald-950/25">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-emerald-950 dark:text-emerald-100">
              {value.centre.nom}
            </p>
            <p className="mt-0.5 truncate text-[11px] text-emerald-800/80 dark:text-emerald-300/80">
              {[value.centre.adresse, value.centre.ville, value.centre.region].filter(Boolean).join(' · ')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              beginSearch()
              onChange(null)
            }}
            className="shrink-0 text-xs font-bold text-emerald-800 hover:text-emerald-950 dark:text-emerald-200"
          >
            {t('visitor.register.changeEstablishment')}
          </button>
        </div>
      )}

      {!value && (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => {
                beginSearch()
                setQuery(event.target.value)
              }}
              className={`${inputClass} pl-10 pr-10`}
              placeholder={t('visitor.register.establishmentSearchPlaceholder')}
              role="combobox"
              aria-controls={listId}
              aria-expanded={results.length > 0}
              aria-invalid={Boolean(error)}
            />
            {loading && (
              <LoaderCircle className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-blue-600" />
            )}
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <select
              value={type}
              onChange={(event) => {
                beginSearch()
                setType(event.target.value)
              }}
              className={inputClass}
            >
              <option value="">{t('visitor.register.allEstablishmentTypes')}</option>
              {FACILITY_TYPES.map((facilityType) => (
                <option key={facilityType} value={facilityType}>
                  {t(`visitor.carte.type.${facilityType}`)}
                </option>
              ))}
            </select>
            <select
              value={region}
              onChange={(event) => {
                beginSearch()
                setRegion(event.target.value)
              }}
              className={inputClass}
            >
              <option value="">{t('visitor.register.allRegions')}</option>
              {REGIONS.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            <input
              value={ville}
              onChange={(event) => {
                beginSearch()
                setVille(event.target.value)
              }}
              className={inputClass}
              placeholder={t('visitor.register.establishmentCityFilter')}
            />
          </div>

          <div
            id={listId}
            className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950"
          >
            {searchError ? (
              <p className="px-4 py-5 text-center text-xs text-red-600 dark:text-red-300">
                {t('visitor.register.establishmentSearchError')}
              </p>
            ) : !loading && results.length === 0 ? (
              <p className="px-4 py-5 text-center text-xs text-slate-500 dark:text-slate-400">
                {t('visitor.register.noEstablishmentFound')}
              </p>
            ) : (
              results.map((centre) => (
                <button
                  key={centre.id}
                  type="button"
                  onClick={() => onChange({ mode: 'existing', centre })}
                  className="flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none dark:border-slate-800 dark:hover:bg-blue-950/30 dark:focus:bg-blue-950/30"
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-slate-900 dark:text-white">
                      {centre.nom}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-slate-500 dark:text-slate-400">
                      {[centre.adresse, centre.ville, centre.region].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>

          <button
            type="button"
            onClick={() => onChange({
              mode: 'manual',
              establishment: { ...emptyManual, nom: query.trim() },
            })}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 text-sm font-bold text-slate-700 transition hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:text-slate-200 dark:hover:border-blue-400 dark:hover:bg-blue-950/30"
          >
            <Plus className="h-4 w-4" />
            {t('visitor.register.addEstablishmentManually')}
          </button>
        </>
      )}

      {error && (
        <p className="flex items-start gap-1.5 text-xs font-medium text-red-600 dark:text-red-400">
          <Building2 className="mt-px h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  )
}
