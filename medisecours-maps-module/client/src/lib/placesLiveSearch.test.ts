// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { buildLiveSearchInput, liveSearchCacheScope, mergePlacesPage, PLACES_SEARCH_CACHE_TTL_MS, readCachedPlacesSearch, writeCachedPlacesSearch } from "./placesLiveSearch";

describe("placesLiveSearch", () => {
  beforeEach(() => window.localStorage.clear());
  it("conserve l’emprise et la géolocalisation dans la requête de recherche dynamique", () => {
    const input = buildLiveSearchInput({
      query: "clinique",
      category: "clinic",
      location: { lat: 4.0511, lng: 9.7679 },
      bounds: { north: 4.3, south: 3.8, east: 10.1, west: 9.6 },
      pageTokens: [],
    });
    expect(input.location).toEqual({ lat: 4.0511, lng: 9.7679 });
    expect(input.bounds?.north).toBe(4.3);
    expect(input.pageTokens).toBeUndefined();
  });

  it("transmet les jetons de page et déduplique les résultats accumulés", () => {
    const input = buildLiveSearchInput({ query: "", category: "all", pageTokens: ["page-1", "page-2"] });
    expect(input.pageTokens).toEqual(["page-1", "page-2"]);
    expect(mergePlacesPage([{ placeId: "a", name: "A" }], [{ placeId: "a", name: "A nouveau" }, { placeId: "b", name: "B" }])).toEqual([{ placeId: "a", name: "A nouveau" }, { placeId: "b", name: "B" }]);
  });

  it("conserve les derniers résultats de la même recherche puis les expire", () => {
    const scope = liveSearchCacheScope({ query: "clinique douala", category: "clinic", location: { lat: 4.05, lng: 9.76 } });
    writeCachedPlacesSearch(scope, [{ placeId: "cached-1", name: "Clinique enregistrée" }], 1_000);

    expect(readCachedPlacesSearch(scope, 1_000 + PLACES_SEARCH_CACHE_TTL_MS - 1)?.places).toEqual([{ placeId: "cached-1", name: "Clinique enregistrée" }]);
    expect(readCachedPlacesSearch(scope, 1_000 + PLACES_SEARCH_CACHE_TTL_MS + 1)).toBeNull();
    expect(readCachedPlacesSearch(liveSearchCacheScope({ query: "hôpital", category: "hospital" }), 1_100)).toBeNull();
  });
});
