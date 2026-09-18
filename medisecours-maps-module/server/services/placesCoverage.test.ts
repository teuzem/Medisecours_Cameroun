import { describe, expect, it } from "vitest";
import { CAMEROON_REGIONAL_HUBS, buildPlacesSearchCenters, radiusForPlacesBounds } from "./placesCoverage";

describe("placesCoverage", () => {
  it("couvre les pôles régionaux lorsque l’emprise est nationale", () => {
    const centers = buildPlacesSearchCenters({ bounds: { north: 14.9, south: 1.6, east: 16.2, west: 8.2 }, maxSectors: 12 });
    expect(centers).toHaveLength(CAMEROON_REGIONAL_HUBS.length);
  });

  it("échantillonne une emprise locale avec plusieurs secteurs dans la limite autorisée", () => {
    const centers = buildPlacesSearchCenters({ bounds: { north: 4.3, south: 3.8, east: 10.1, west: 9.6 }, maxSectors: 9 });
    expect(centers).toHaveLength(9);
    expect(radiusForPlacesBounds({ north: 4.3, south: 3.8, east: 10.1, west: 9.6 })).toBeGreaterThanOrEqual(5_000);
  });

  it("privilégie strictement la géolocalisation utilisateur", () => {
    expect(buildPlacesSearchCenters({ location: { lat: 4.05, lng: 9.76 }, maxSectors: 12 })).toEqual([{ lat: 4.05, lng: 9.76 }]);
  });
});
