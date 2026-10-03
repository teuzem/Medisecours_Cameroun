'use client'

import { useMemo, useState } from 'react'
import { LocateFixed, LoaderCircle, MapPin, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getMapboxToken } from '../../lib/mapboxMaps'
import { loadGoogleMaps } from '../../lib/googleMaps'
import {
  CAMEROON_ARRONDISSEMENTS,
  CAMEROON_DEPARTMENTS,
  CAMEROON_REGIONS,
  isCameroonCoordinate,
  matchesGeography,
  type CameroonArrondissement,
  type CameroonDepartment,
  type CameroonRegion,
} from '../../lib/cameroonGeography'

export type GeographyValue = {
  region: string
  regionCode: string
  departement: string
  departementCode: string
  arrondissement: string
  arrondissementCode: string
  latitude?: number
  longitude?: number
}

type Props = {
  value: GeographyValue
  onChange: (value: GeographyValue) => void
  inputClass: string
  error?: string
  compact?: boolean
}

function label(item: { nameLocal: string; nameEn: string }, language: string) {
  return language.startsWith('fr') ? item.nameLocal : item.nameEn
}

export default function CameroonGeographyFields({ value, onChange, inputClass, error, compact = false }: Props) {
  const { t, i18n } = useTranslation()
  const [regionQuery, setRegionQuery] = useState('')
  const [departmentQuery, setDepartmentQuery] = useState('')
  const [arrondissementQuery, setArrondissementQuery] = useState('')
  const [locating, setLocating] = useState(false)
  const [locationMessage, setLocationMessage] = useState('')
  const region = CAMEROON_REGIONS.find((item) => item.id === value.regionCode)
  const departments = useMemo(
    () => CAMEROON_DEPARTMENTS.filter((item) => item.regionId === value.regionCode && matchesGeography(item, departmentQuery)).slice(0, 40),
    [departmentQuery, value.regionCode],
  )
  const arrondissements = useMemo(
    () => CAMEROON_ARRONDISSEMENTS.filter((item) => item.departmentId === value.departementCode && matchesGeography(item, arrondissementQuery)).slice(0, 40),
    [arrondissementQuery, value.departementCode],
  )
  const regions = useMemo(
    () => CAMEROON_REGIONS.filter((item) => matchesGeography(item, regionQuery)),
    [regionQuery],
  )

  const update = (next: Partial<GeographyValue>) => onChange({
    region: next.region ?? value.region,
    regionCode: next.regionCode ?? value.regionCode,
    departement: next.departement ?? value.departement,
    departementCode: next.departementCode ?? value.departementCode,
    arrondissement: next.arrondissement ?? value.arrondissement,
    arrondissementCode: next.arrondissementCode ?? value.arrondissementCode,
    latitude: next.latitude ?? value.latitude,
    longitude: next.longitude ?? value.longitude,
  })

  const chooseRegion = (item: CameroonRegion) => update({
    region: item.nameLocal,
    regionCode: item.id,
    departement: '',
    departementCode: '',
    arrondissement: '',
    arrondissementCode: '',
  })
  const chooseDepartment = (item: CameroonDepartment) => update({
    departement: item.nameLocal,
    departementCode: item.id,
    arrondissement: '',
    arrondissementCode: '',
  })
  const chooseArrondissement = (item: CameroonArrondissement) => update({
    arrondissement: item.nameLocal,
    arrondissementCode: item.id,
  })

  const reverseGeocode = async (latitude: number, longitude: number) => {
    const token = getMapboxToken()
    if (token) {
      const params = new URLSearchParams({
        longitude: String(longitude),
        latitude: String(latitude),
        language: i18n.language.startsWith('fr') ? 'fr' : 'en',
        access_token: token,
      })
      const response = await fetch(`https://api.mapbox.com/search/geocode/v6/reverse?${params}`)
      if (response.ok) {
        const data = await response.json()
        const feature = data.features?.[0]
        const context = feature?.properties?.context ?? {}
        return {
          region: context.region?.name ?? '',
          departement: context.district?.name ?? context.county?.name ?? '',
          arrondissement: context.locality?.name ?? context.place?.name ?? '',
          adresse: feature?.properties?.full_address ?? feature?.properties?.name ?? '',
        }
      }
    }
    try {
      const google = await loadGoogleMaps()
      if (google.loaded) {
        const geocoder = new window.google.maps.Geocoder()
        const response = await geocoder.geocode({ location: { lat: latitude, lng: longitude } })
        const components = response.results[0]?.address_components ?? []
        const get = (types: string[]) => components.find((item) => types.some((type) => item.types.includes(type)))?.long_name ?? ''
        return {
          region: get(['administrative_area_level_1']),
          departement: get(['administrative_area_level_2']),
          arrondissement: get(['administrative_area_level_3', 'locality']),
          adresse: response.results[0]?.formatted_address ?? '',
        }
      }
    } catch {
      // Manual selection remains available when reverse geocoding is unavailable.
    }
    return null
  }

  const locate = () => {
    if (!navigator.geolocation) {
      setLocationMessage(t('visitor.register.geolocationUnavailable'))
      return
    }
    setLocating(true)
    setLocationMessage('')
    navigator.geolocation.getCurrentPosition(async (position) => {
      const latitude = position.coords.latitude
      const longitude = position.coords.longitude
      if (!isCameroonCoordinate(latitude, longitude)) {
        setLocationMessage(t('visitor.register.geolocationOutsideCameroon'))
        setLocating(false)
        return
      }
      const resolved = await reverseGeocode(latitude, longitude)
      if (resolved) {
        const regionMatch = CAMEROON_REGIONS.find((item) => matchesGeography(item, resolved.region))
        const departmentMatch = CAMEROON_DEPARTMENTS.find((item) => item.regionId === regionMatch?.id && matchesGeography(item, resolved.departement))
        const arrondissementMatch = CAMEROON_ARRONDISSEMENTS.find((item) => item.departmentId === departmentMatch?.id && matchesGeography(item, resolved.arrondissement))
        update({
          region: regionMatch?.nameLocal ?? value.region,
          regionCode: regionMatch?.id ?? value.regionCode,
          departement: departmentMatch?.nameLocal ?? value.departement,
          departementCode: departmentMatch?.id ?? value.departementCode,
          arrondissement: arrondissementMatch?.nameLocal ?? value.arrondissement,
          arrondissementCode: arrondissementMatch?.id ?? value.arrondissementCode,
          latitude,
          longitude,
        })
        setLocationMessage(t('visitor.register.geolocationSuccess'))
      } else {
        update({ latitude, longitude })
        setLocationMessage(t('visitor.register.geolocationCoordinatesOnly'))
      }
      setLocating(false)
    }, () => {
      setLocating(false)
      setLocationMessage(t('visitor.register.geolocationDenied'))
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 300000 })
  }

  return (
    <div className={`space-y-3 ${compact ? '' : 'rounded-lg border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-900/40'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t('visitor.register.geographyTitle')}</p>
          <p className="text-[11px] leading-4 text-slate-500 dark:text-slate-400">{t('visitor.register.geographyHint')}</p>
        </div>
        <button type="button" onClick={locate} disabled={locating} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 text-xs font-bold text-blue-700 hover:border-blue-400 hover:bg-blue-50 disabled:opacity-60 dark:border-blue-900 dark:bg-slate-950 dark:text-blue-300">
          {locating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
          {locating ? t('visitor.register.geolocating') : t('visitor.register.useCurrentLocation')}
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <SearchableSelect label={t('visitor.register.regionLabel')} query={regionQuery} setQuery={setRegionQuery} value={region ? label(region, i18n.language) : value.region} placeholder={t('visitor.register.regionPlaceholder')} items={regions} onSelect={chooseRegion} inputClass={inputClass} disabled={false} />
        <SearchableSelect label={t('visitor.register.departmentLabel')} query={departmentQuery} setQuery={setDepartmentQuery} value={value.departement} placeholder={value.regionCode ? t('visitor.register.departmentPlaceholder') : t('visitor.register.selectRegionFirst')} items={departments} onSelect={chooseDepartment} inputClass={inputClass} disabled={!value.regionCode} />
        <SearchableSelect label={t('visitor.register.arrondissementLabel')} query={arrondissementQuery} setQuery={setArrondissementQuery} value={value.arrondissement} placeholder={value.departementCode ? t('visitor.register.arrondissementPlaceholder') : t('visitor.register.selectDepartmentFirst')} items={arrondissements} onSelect={chooseArrondissement} inputClass={inputClass} disabled={!value.departementCode} />
      </div>
      {(value.latitude != null && value.longitude != null) && (
        <p className="flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-300"><MapPin className="h-3.5 w-3.5" />{t('visitor.register.coordinatesDetected', { lat: value.latitude.toFixed(5), lng: value.longitude.toFixed(5) })}</p>
      )}
      {locationMessage && <p role="status" className="text-[11px] text-slate-600 dark:text-slate-300">{locationMessage}</p>}
      {error && <p className="text-xs font-medium text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}

function SearchableSelect<T extends { id: string; nameLocal: string; nameEn: string }>({
  label,
  query,
  setQuery,
  value,
  placeholder,
  items,
  onSelect,
  inputClass,
  disabled,
}: {
  label: string
  query: string
  setQuery: (value: string) => void
  value: string
  placeholder: string
  items: T[]
  onSelect: (item: T) => void
  inputClass: string
  disabled: boolean
}) {
  const { i18n } = useTranslation()
  return (
    <label className="relative block text-xs font-semibold text-slate-700 dark:text-slate-200">
      {label}
      <div className="relative mt-1.5">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <input disabled={disabled} value={query || value} onChange={(event) => setQuery(event.target.value)} placeholder={placeholder} className={`${inputClass} pl-9 text-xs`} autoComplete="off" />
      </div>
      {!disabled && query && items.length > 0 && (
        <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-950">
          {items.map((item) => <button type="button" key={item.id} onClick={() => { onSelect(item); setQuery('') }} className="block w-full rounded-md px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-blue-50 dark:text-slate-200 dark:hover:bg-blue-950/40">{i18n.language.startsWith('fr') ? item.nameLocal : item.nameEn}</button>)}
        </div>
      )}
    </label>
  )
}
