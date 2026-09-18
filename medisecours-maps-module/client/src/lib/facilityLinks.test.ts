import { describe, expect, it } from "vitest";
import { facilityStorageKey, googleDirectionsUrl, googleMapsPlaceUrl, googleNearbyHealthUrl, phoneSmsUrl, toggleSavedFacility } from "./facilityLinks";

const facility = { id: 42, isLive: true, googlePlaceId: "place-test-42", name: "Centre Santé Yaoundé", latitude: 3.848, longitude: 11.502 };

describe("liens d’action de fiche", () => {
  it("construit les liens Google Maps officiels pour une fiche Places", () => {
    expect(googleMapsPlaceUrl(facility)).toContain("query_place_id=place-test-42");
    expect(googleDirectionsUrl(facility)).toContain("destination=3.848,11.502");
    expect(googleNearbyHealthUrl(facility)).toContain("formation%20sanitaire");
    expect(phoneSmsUrl(facility)).toContain("sms:?");
    expect(decodeURIComponent(phoneSmsUrl(facility))).toContain("place-test-42");
  });

  it("stabilise la clé locale d’enregistrement sans exposer les détails d’un lieu", () => {
    expect(facilityStorageKey(facility)).toBe("place-test-42");
    expect(googleMapsPlaceUrl({ ...facility, googlePlaceId: undefined })).toContain("query=3.848,11.502");
  });

  it("bascule l’état enregistré d’une fiche de manière prévisible", () => {
    const data = new Map<string, string>();
    const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) };
    expect(toggleSavedFacility(storage, facility)).toBe(true);
    expect(data.get("medisecours-saved-place-test-42")).toBe("1");
    expect(toggleSavedFacility(storage, facility)).toBe(false);
    expect(data.get("medisecours-saved-place-test-42")).toBe("0");
  });
});
