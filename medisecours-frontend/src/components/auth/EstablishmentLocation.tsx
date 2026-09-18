'use client'

import { useEffect, useRef, useState } from 'react'
import { loadGoogleMaps } from '../../lib/googleMaps'
import { getMapboxToken } from '../../lib/mapboxMaps'

export type EstablishmentLocationValue = {
  adresse: string
  ville: string
  region: string
  latitude: number
  longitude: number
}

type Suggestion = { id: string; label: string; resolve: () => Promise<EstablishmentLocationValue> }

function normalizeRegion(value: string) {
  const normalized = value.replace(/ Region| Région| Province/gi, '').trim()
  const aliases: Record<string, string> = {
    Central: 'Centre', East: 'Est', West: 'Ouest', South: 'Sud', North: 'Nord',
    'Far North': 'Extrême-Nord', Northwest: 'Nord-Ouest', Southwest: 'Sud-Ouest', Adamawa: 'Adamaoua',
    'North-West': 'Nord-Ouest', 'South-West': 'Sud-Ouest',
  }
  return aliases[normalized] ?? normalized
}

export default function EstablishmentLocation({ onSelect }: { onSelect: (value: EstablishmentLocationValue) => void }) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const requestId = useRef(0)

  useEffect(() => {
    const id = ++requestId.current
    const controller = new AbortController()
    setSuggestions([])
    if (query.trim().length < 3) { setBusy(false); return }
    const timer = setTimeout(async () => {
      setBusy(true)
      setError('')
      try {
        const googleResult = await loadGoogleMaps()
        let items: Suggestion[] = []
        if (googleResult.loaded) {
          const places = await google.maps.importLibrary('places') as google.maps.PlacesLibrary
          const response = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input: query, includedRegionCodes: ['cm'], language: 'fr',
          })
          items = response.suggestions.flatMap(({ placePrediction }) => {
            if (!placePrediction) return []
            return [{
              id: placePrediction.placeId, label: placePrediction.text.toString(),
              resolve: async () => {
                const place = placePrediction.toPlace()
                await place.fetchFields({ fields: ['location', 'formattedAddress', 'addressComponents'] })
                if (!place.location) throw new Error('Adresse sans coordonnees')
                const component = (type: string) => place.addressComponents?.find(item => item.types.includes(type))?.longText ?? ''
                return {
                  adresse: place.formattedAddress ?? placePrediction.text.toString(),
                  ville: component('locality') || component('administrative_area_level_2'),
                  region: normalizeRegion(component('administrative_area_level_1')),
                  latitude: place.location.lat(), longitude: place.location.lng(),
                }
              },
            }]
          })
        } else if (getMapboxToken()) {
          const params = new URLSearchParams({ q: query, country: 'cm', language: 'fr', autocomplete: 'true', limit: '5', access_token: getMapboxToken() })
          const response = await fetch(`https://api.mapbox.com/search/geocode/v6/forward?${params}`, { signal: controller.signal })
          if (!response.ok) throw new Error('Recherche indisponible')
          const data = await response.json()
          items = (data.features ?? []).map((feature: any) => {
            const properties = feature.properties
            const context = properties.context ?? {}
            return {
              id: properties.mapbox_id, label: properties.full_address ?? properties.name,
              resolve: async () => ({
                adresse: properties.full_address ?? properties.name,
                ville: context.place?.name ?? context.locality?.name ?? '',
                region: normalizeRegion(context.region?.name ?? ''),
                longitude: feature.geometry.coordinates[0], latitude: feature.geometry.coordinates[1],
              }),
            }
          })
        } else {
          throw new Error('Recherche cartographique indisponible. Vous pouvez saisir les informations manuellement.')
        }
        if (id === requestId.current) setSuggestions(items)
      } catch (cause) {
        if (id === requestId.current && !controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Recherche indisponible')
      } finally {
        if (id === requestId.current) setBusy(false)
      }
    }, 300)
    return () => { clearTimeout(timer); controller.abort() }
  }, [query])

  return <div className="space-y-2">
    <label className="block text-sm font-medium text-slate-700">Localiser sur la carte
      <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Adresse, ville, quartier au Cameroun" autoComplete="off" className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm" />
    </label>
    {busy && <p role="status" className="text-xs text-slate-500">Recherche en cours...</p>}
    {error && <p role="status" className="text-xs text-amber-700">{error}</p>}
    {suggestions.length > 0 && <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
      {suggestions.map(item => <li key={item.id}><button type="button" className="w-full px-3 py-3 text-left text-sm hover:bg-blue-50" onClick={async () => {
        const id = requestId.current
        setBusy(true)
        try {
          const location = await item.resolve()
          if (id !== requestId.current) return
          onSelect(location)
          setSuggestions([])
          setError('')
        } catch { setError('Impossible de determiner la position de cette adresse.') }
        finally { setBusy(false) }
      }}>{item.label}</button></li>)}
    </ul>}
  </div>
}
