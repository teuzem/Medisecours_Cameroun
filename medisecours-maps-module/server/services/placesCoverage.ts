export type PlacesBounds = { north: number; south: number; east: number; west: number };
export type PlacesPoint = { lat: number; lng: number };

export const CAMEROON_REGIONAL_HUBS: PlacesPoint[] = [
  { lat: 3.848, lng: 11.502 }, // Yaoundé
  { lat: 4.051, lng: 9.767 }, // Douala
  { lat: 5.963, lng: 10.159 }, // Bafoussam
  { lat: 5.959, lng: 10.146 }, // Bamenda
  { lat: 9.307, lng: 13.398 }, // Garoua
  { lat: 10.591, lng: 14.315 }, // Maroua
  { lat: 4.575, lng: 13.684 }, // Bertoua
  { lat: 2.902, lng: 11.151 }, // Ebolowa
  { lat: 4.152, lng: 9.241 }, // Buea
  { lat: 7.327, lng: 13.584 }, // Ngaoundéré
];

function pointIsInsideBounds(point: PlacesPoint, bounds: PlacesBounds) {
  return point.lat >= bounds.south && point.lat <= bounds.north && point.lng >= bounds.west && point.lng <= bounds.east;
}

export function buildPlacesSearchCenters(input: { location?: PlacesPoint; bounds?: PlacesBounds; maxSectors?: number }) {
  const maxSectors = Math.min(Math.max(input.maxSectors ?? 10, 1), 12);
  if (input.location) return [input.location];
  if (!input.bounds) return CAMEROON_REGIONAL_HUBS.slice(0, maxSectors);
  const bounds = input.bounds;

  const latSpan = Math.abs(bounds.north - bounds.south);
  const lngSpan = Math.abs(bounds.east - bounds.west);
  if (latSpan > 4 || lngSpan > 4) {
    const hubs = CAMEROON_REGIONAL_HUBS.filter(hub => pointIsInsideBounds(hub, bounds));
    return (hubs.length ? hubs : CAMEROON_REGIONAL_HUBS).slice(0, maxSectors);
  }

  const rows = 3;
  const columns = 3;
  const centers: PlacesPoint[] = [];
  for (let row = 0; row < rows && centers.length < maxSectors; row += 1) {
    for (let column = 0; column < columns && centers.length < maxSectors; column += 1) {
      centers.push({
        lat: bounds.south + ((row + 0.5) / rows) * latSpan,
        lng: bounds.west + ((column + 0.5) / columns) * lngSpan,
      });
    }
  }
  return centers;
}

export function radiusForPlacesBounds(bounds?: PlacesBounds) {
  if (!bounds) return 50_000;
  const latKm = Math.abs(bounds.north - bounds.south) * 111;
  const lngKm = Math.abs(bounds.east - bounds.west) * 111;
  return Math.min(50_000, Math.max(5_000, Math.round((Math.max(latKm, lngKm) / 3) * 1000)));
}
