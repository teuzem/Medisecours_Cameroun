import { describe, expect, it, vi } from "vitest";
import { buildRouteFallbackUrl, isMapsQuotaError, requestNativeMapRoute } from "./MapDirectory";

describe("itinéraire cartographique", () => {
  it("calcule et rend un itinéraire natif quand les capacités Google Maps sont disponibles", () => {
    const route = vi.fn();
    const setMap = vi.fn();
    const setDirections = vi.fn();
    const result = { routes: [{ legs: [{ duration: { text: "12 min" }, distance: { text: "4 km" } }] }] };
    class DirectionsService {
      route(request: unknown, callback: (response: typeof result | null, status: string) => void) {
        route(request);
        callback(result, "OK");
      }
    }
    class DirectionsRenderer {
      setMap = setMap;
      setDirections = setDirections;
    }
    const onSuccess = vi.fn();
    const onFailure = vi.fn();

    const response = requestNativeMapRoute({
      api: { DirectionsService, DirectionsRenderer, TravelMode: { DRIVING: "DRIVE", WALKING: "WALK", BICYCLING: "BIKE" } },
      map: { id: "map" },
      origin: { lat: 3.8667, lng: 11.5167 },
      destination: { lat: 4.0511, lng: 9.7679 },
      travelMode: "DRIVING",
      onSuccess,
      onFailure,
    });

    expect(response.started).toBe(true);
    expect(route).toHaveBeenCalledWith(expect.objectContaining({ travelMode: "DRIVE" }));
    expect(setMap).toHaveBeenCalledWith({ id: "map" });
    expect(setDirections).toHaveBeenCalledWith(result);
    expect(onSuccess).toHaveBeenCalledWith(result);
    expect(onFailure).not.toHaveBeenCalled();
  });

  it("classe les réponses 412 et RESOURCE_EXHAUSTED comme un quota Maps", () => {
    expect(isMapsQuotaError(new Error("Google Maps API request failed (412 Precondition Failed): RESOURCE_EXHAUSTED"))).toBe(true);
    expect(isMapsQuotaError(new Error("Google Maps proxy credentials missing"))).toBe(false);
  });

  it("signale l’indisponibilité native et forme une URL de repli utilisable", () => {
    const unavailable = requestNativeMapRoute({
      map: null,
      origin: { lat: 3.8667, lng: 11.5167 },
      destination: { lat: 4.0511, lng: 9.7679 },
      travelMode: "WALKING",
      onSuccess: vi.fn(),
      onFailure: vi.fn(),
    });
    const fallback = new URL(buildRouteFallbackUrl({ lat: 4.0511, lng: 9.7679 }, "WALKING"));

    expect(unavailable).toEqual({ started: false });
    expect(fallback.searchParams.get("destination")).toBe("4.0511,9.7679");
    expect(fallback.searchParams.get("travelmode")).toBe("walking");
  });
});
