export type FacilityMapTarget = {
  id: number;
  isLive?: boolean;
  googlePlaceId?: string;
  name: string;
  latitude: number;
  longitude: number;
};

export function facilityStorageKey(facility: FacilityMapTarget) {
  return facility.isLive ? facility.googlePlaceId || String(facility.id) : String(facility.id);
}

export function googleMapsPlaceUrl(facility: FacilityMapTarget) {
  if (facility.googlePlaceId) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(facility.name)}&query_place_id=${encodeURIComponent(facility.googlePlaceId)}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${facility.latitude},${facility.longitude}`;
}

export function googleDirectionsUrl(facility: FacilityMapTarget) {
  return `https://www.google.com/maps/dir/?api=1&destination=${facility.latitude},${facility.longitude}`;
}

export function googleNearbyHealthUrl(facility: FacilityMapTarget) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("formation sanitaire")}&center=${facility.latitude},${facility.longitude}`;
}

export function googlePlacePhotoProxyUrl(photoReference: string, maxWidth = 1200) {
  return `/api/maps/photo?maxWidth=${Math.min(Math.max(maxWidth, 200), 1600)}&reference=${encodeURIComponent(photoReference)}`;
}

export function phoneSmsUrl(facility: FacilityMapTarget) {
  const message = `${facility.name}\n${googleMapsPlaceUrl(facility)}`;
  return `sms:?&body=${encodeURIComponent(message)}`;
}

export function toggleSavedFacility(storage: Pick<Storage, "getItem" | "setItem">, facility: FacilityMapTarget) {
  const key = `medisecours-saved-${facilityStorageKey(facility)}`;
  const saved = storage.getItem(key) !== "1";
  storage.setItem(key, saved ? "1" : "0");
  return saved;
}
