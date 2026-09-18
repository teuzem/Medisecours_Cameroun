export type LiveSearchLocation = { lat: number; lng: number };
export type LiveSearchBounds = { north: number; south: number; east: number; west: number };

export const PLACES_SEARCH_CACHE_TTL_MS = 30 * 60 * 1000;
const PLACES_SEARCH_CACHE_KEY = "medisecours:places-search-cache:v1";

export type CachedPlacesSearch<T extends { placeId: string }> = {
  savedAt: number;
  scope: string;
  places: T[];
};

export function buildLiveSearchInput<TCategory extends string>(input: {
  query: string;
  category: TCategory;
  location?: LiveSearchLocation;
  bounds?: LiveSearchBounds;
  pageTokens: string[];
  maxSectors?: number;
}) {
  return {
    query: input.query.trim() || undefined,
    category: input.category,
    location: input.location,
    bounds: input.bounds,
    pageTokens: input.pageTokens.length ? input.pageTokens : undefined,
    maxSectors: input.maxSectors ?? 10,
  };
}

export function liveSearchCacheScope(input: { query?: string; category?: string; location?: LiveSearchLocation; bounds?: LiveSearchBounds }) {
  return JSON.stringify({ query: input.query?.trim().toLocaleLowerCase("fr-CM") || "", category: input.category || "all", location: input.location || null, bounds: input.bounds || null });
}

export function readCachedPlacesSearch<T extends { placeId: string }>(scope: string, now = Date.now()): CachedPlacesSearch<T> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PLACES_SEARCH_CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as CachedPlacesSearch<T>;
    if (cached.scope !== scope || !Array.isArray(cached.places) || now - cached.savedAt > PLACES_SEARCH_CACHE_TTL_MS) return null;
    return cached;
  } catch {
    return null;
  }
}

export function writeCachedPlacesSearch<T extends { placeId: string }>(scope: string, places: T[], now = Date.now()) {
  if (typeof window === "undefined" || !places.length) return;
  try {
    window.localStorage.setItem(PLACES_SEARCH_CACHE_KEY, JSON.stringify({ savedAt: now, scope, places: places.slice(0, 600) } satisfies CachedPlacesSearch<T>));
  } catch {
    // Le cache est un confort ; l’application reste utilisable sans localStorage.
  }
}

export function mergePlacesPage<T extends { placeId: string }>(current: T[], incoming: T[], replace = false) {
  if (replace) return incoming;
  const merged = new Map(current.map(place => [place.placeId, place]));
  incoming.forEach(place => merged.set(place.placeId, place));
  return Array.from(merged.values());
}
