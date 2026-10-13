'use client'

import { useEffect, useRef, useState } from 'react'
import { MapPin } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { loadGoogleMaps } from '../../lib/googleMaps'
import { getMapboxToken } from '../../lib/mapboxMaps'

export type QuartierGeo = { latitude: number; longitude: number }

type QuartierSuggestion = {
  id: string
  label: string
  detail: string
  resolve: () => Promise<{ quartier: string; geo: QuartierGeo }>
}

function quartierLabel(parts: {
  name: string
  neighborhood: string
  sublocality: string
  locality: string
}): string {
  return (
    parts.neighborhood ||
    parts.sublocality ||
    parts.locality ||
    parts.name
  )
}

/**
 * Recherche instantanée du quartier de résidence (Google Places limité au
 * Cameroun, repli Mapbox), avec saisie manuelle systématique quand Google ne
 * trouve rien (« Utiliser tel quel »). La sélection remplit le quartier et,
 * quand le lieu est résolu, propose ses coordonnées au formulaire.
 */
export default function QuartierAutocomplete({
  value,
  onChange,
  onGeoSelect,
  inputClass = '',
  placeholder = '',
}: {
  value: string
  onChange: (quartier: string) => void
  onGeoSelect?: (geo: QuartierGeo) => void
  inputClass?: string
  placeholder?: string
}) {
  const { t, i18n } = useTranslation()
  const [suggestions, setSuggestions] = useState<QuartierSuggestion[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const requestId = useRef(0)
  const committed = useRef('')
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [])

  useEffect(() => {
    const id = ++requestId.current
    const controller = new AbortController()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSuggestions([])
    const query = value.trim()
    if (query.length < 2 || query === committed.current) {
      setBusy(false)
      return
    }
    const timer = setTimeout(async () => {
      setBusy(true)
      setError('')
      try {
        const googleResult = await loadGoogleMaps()
        let items: QuartierSuggestion[] = []
        if (googleResult.loaded) {
          const places = (await google.maps.importLibrary('places')) as google.maps.PlacesLibrary
          const response = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input: query,
            includedRegionCodes: ['cm'],
            language: i18n.language.toLowerCase().startsWith('en') ? 'en' : 'fr',
          })
          items = response.suggestions.flatMap(({ placePrediction }) => {
            if (!placePrediction) return []
            const mainText = placePrediction.mainText?.toString() ?? ''
            const secondaryText = placePrediction.secondaryText?.toString() ?? ''
            return [{
              id: placePrediction.placeId,
              label: mainText || placePrediction.text.toString(),
              detail: secondaryText,
              resolve: async () => {
                const place = placePrediction.toPlace()
                await place.fetchFields({ fields: ['location', 'displayName', 'addressComponents'] })
                if (!place.location) throw new Error('Lieu sans coordonnées')
                const component = (type: string) =>
                  place.addressComponents?.find((item) => item.types.includes(type))?.longText ?? ''
                return {
                  quartier: quartierLabel({
                    name: place.displayName ?? mainText,
                    neighborhood: component('neighborhood'),
                    sublocality:
                      component('sublocality_level_1') ||
                      component('sublocality') ||
                      component('administrative_area_level_3'),
                    locality: component('locality'),
                  }),
                  geo: { latitude: place.location.lat(), longitude: place.location.lng() },
                }
              },
            }]
          })
        } else if (getMapboxToken()) {
          const params = new URLSearchParams({
            q: query, country: 'cm', language: 'fr', autocomplete: 'true', limit: '5',
            access_token: getMapboxToken(),
          })
          const response = await fetch(`https://api.mapbox.com/search/geocode/v6/forward?${params}`, {
            signal: controller.signal,
          })
          if (!response.ok) throw new Error('Recherche indisponible')
          const data = await response.json()
          items = (data.features ?? []).map((feature: any) => {
            const properties = feature.properties ?? {}
            const context = properties.context ?? {}
            const name: string = properties.name ?? ''
            const neighborhood: string =
              context.neighborhood?.name ?? context.locality?.name ?? context.place?.name ?? ''
            return {
              id: String(properties.mapbox_id ?? name),
              label: neighborhood || name,
              detail: properties.full_address ?? properties.place_formatted ?? '',
              resolve: async () => ({
                quartier: neighborhood || name,
                geo: {
                  latitude: feature.geometry.coordinates[1],
                  longitude: feature.geometry.coordinates[0],
                },
              }),
            }
          })
        }
        if (id === requestId.current) {
          setSuggestions(items.slice(0, 6))
          setOpen(true)
        }
      } catch (cause) {
        if (id === requestId.current && !controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : t('visitor.register.locationSearchError'))
        }
      } finally {
        if (id === requestId.current) setBusy(false)
      }
    }, 300)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [i18n.language, t, value])

  const choose = async (item: QuartierSuggestion) => {
    setBusy(true)
    try {
      const resolved = await item.resolve()
      committed.current = resolved.quartier
      onChange(resolved.quartier)
      onGeoSelect?.(resolved.geo)
      setSuggestions([])
      setOpen(false)
      setError('')
    } catch {
      setError(t('visitor.register.locationResolveError'))
    } finally {
      setBusy(false)
    }
  }

  const useAsIs = () => {
    const trimmed = value.trim()
    if (!trimmed) return
    committed.current = trimmed
    onChange(trimmed)
    setSuggestions([])
    setOpen(false)
  }

  const trimmed = value.trim()

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={value}
          onChange={(event) => {
            committed.current = ''
            onChange(event.target.value)
            setOpen(true)
          }}
          onFocus={() => {
            if (suggestions.length > 0 || trimmed.length >= 2) setOpen(true)
          }}
          autoComplete="address-level3"
          className={`${inputClass} pl-10`}
          placeholder={placeholder || t('visitor.register.quartierPlaceholder')}
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-label={t('visitor.register.quartierLabel')}
        />
      </div>
      {busy && (
        <p role="status" className="mt-1.5 text-xs text-slate-500">
          {t('visitor.register.locationSearching')}
        </p>
      )}
      {error && (
        <p role="status" className="mt-1.5 text-xs text-amber-700">
          {error}
        </p>
      )}
      {open && trimmed.length >= 2 && (
        <ul
          role="listbox"
          aria-label={t('visitor.register.quartierLabel')}
          className="absolute inset-x-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
        >
          {suggestions.map((item) => (
            <li key={item.id} role="option" aria-selected="false">
              <button
                type="button"
                className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left hover:bg-mint-50 dark:hover:bg-white/5"
                onClick={() => void choose(item)}
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary-500" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {item.label}
                  </span>
                  {item.detail && (
                    <span className="block truncate text-xs text-slate-400">{item.detail}</span>
                  )}
                </span>
              </button>
            </li>
          ))}
          <li role="option" aria-selected="false">
            <button
              type="button"
              className="w-full px-3 py-2.5 text-left text-sm font-semibold text-primary-600 hover:bg-mint-50 dark:text-mint-300 dark:hover:bg-white/5"
              onClick={useAsIs}
            >
              {t('visitor.register.quartierUseAsIs', { query: trimmed })}
            </button>
          </li>
        </ul>
      )}
    </div>
  )
}
