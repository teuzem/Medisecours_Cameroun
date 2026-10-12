export interface ClusterPoint {
  id: number
  latitude?: number | null
  longitude?: number | null
}

export interface ClusterGroup {
  lat: number
  lng: number
  ids: number[]
}

/**
 * Zoom à partir duquel les épingles s'affichent toutes (rues visibles) :
 * en dessous, les structures proches sont regroupées (anti-chevauchement,
 * façon Google Maps). Le moteur Google utilise son MarkerClusterer natif ;
 * ce regroupement grille couvre Leaflet et Mapbox sans dépendance.
 */
export const CLUSTER_MAX_ZOOM = 15

export function clusterPoints(points: ClusterPoint[], zoom: number): ClusterGroup[] {
  const valides = points.filter(
    (point): point is ClusterPoint & { latitude: number; longitude: number } =>
      point.latitude != null && point.longitude != null,
  )
  if (zoom >= CLUSTER_MAX_ZOOM) {
    return valides.map((point) => ({ lat: point.latitude, lng: point.longitude, ids: [point.id] }))
  }
  const cellule = 360 / Math.pow(2, Math.max(Math.floor(zoom), 1)) / 6
  const grille = new Map<string, typeof valides>()
  for (const point of valides) {
    const cle = `${Math.floor(point.latitude / cellule)}:${Math.floor(point.longitude / cellule)}`
    const groupe = grille.get(cle)
    if (groupe) groupe.push(point)
    else grille.set(cle, [point])
  }
  return [...grille.values()].map((groupe) => ({
    lat: groupe.reduce((somme, point) => somme + point.latitude, 0) / groupe.length,
    lng: groupe.reduce((somme, point) => somme + point.longitude, 0) / groupe.length,
    ids: groupe.map((point) => point.id),
  }))
}

/** Pastille de comptage d'un regroupement (même langage que les épingles). */
export function clusterBubbleHtml(count: number): string {
  const label = count > 99 ? '99+' : String(count)
  return `<div class="maps-cluster-bubble" role="button" tabindex="0" aria-label="${label} établissements"><span>${label}</span></div>`
}
