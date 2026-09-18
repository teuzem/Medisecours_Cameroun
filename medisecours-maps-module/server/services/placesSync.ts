import { eq, inArray } from "drizzle-orm";
import { placeIndex, syncRuns } from "../../drizzle/schema";
import { getDb } from "../db";
import { makeRequest, type PlacesSearchResult } from "../_core/map";
import { notifyOwner } from "../_core/notification";

export type SyncSector = { label: string; region: string; lat: number; lng: number; radius: number };

/** Maillage tournant : au moins trois points par région, quatre dans le Sud-Ouest. */
export const CAMEROON_SECTORS: SyncSector[] = [
  { label: "Yaoundé", region: "Centre", lat: 3.848, lng: 11.5021, radius: 28000 }, { label: "Mbalmayo", region: "Centre", lat: 3.516, lng: 11.501, radius: 26000 }, { label: "Obala", region: "Centre", lat: 4.166, lng: 11.533, radius: 26000 },
  { label: "Douala", region: "Littoral", lat: 4.0511, lng: 9.7679, radius: 28000 }, { label: "Édéa", region: "Littoral", lat: 3.799, lng: 10.135, radius: 26000 }, { label: "Nkongsamba", region: "Littoral", lat: 4.954, lng: 9.94, radius: 26000 },
  { label: "Bafoussam", region: "Ouest", lat: 5.4778, lng: 10.4176, radius: 24000 }, { label: "Dschang", region: "Ouest", lat: 5.443, lng: 10.056, radius: 24000 }, { label: "Mbouda", region: "Ouest", lat: 5.626, lng: 10.255, radius: 22000 },
  { label: "Bamenda", region: "Nord-Ouest", lat: 5.9597, lng: 10.1459, radius: 24000 }, { label: "Kumbo", region: "Nord-Ouest", lat: 6.208, lng: 10.681, radius: 24000 }, { label: "Wum", region: "Nord-Ouest", lat: 6.383, lng: 10.067, radius: 24000 },
  { label: "Garoua", region: "Nord", lat: 9.3014, lng: 13.3977, radius: 28000 }, { label: "Poli", region: "Nord", lat: 8.475, lng: 13.238, radius: 26000 }, { label: "Pitoa", region: "Nord", lat: 9.401, lng: 13.505, radius: 22000 },
  { label: "Maroua", region: "Extrême-Nord", lat: 10.5909, lng: 14.3159, radius: 28000 }, { label: "Mokolo", region: "Extrême-Nord", lat: 10.742, lng: 13.803, radius: 26000 }, { label: "Kousséri", region: "Extrême-Nord", lat: 12.076, lng: 15.03, radius: 28000 },
  { label: "Ngaoundéré", region: "Adamaoua", lat: 7.3277, lng: 13.5847, radius: 26000 }, { label: "Meiganga", region: "Adamaoua", lat: 6.516, lng: 14.299, radius: 26000 }, { label: "Tibati", region: "Adamaoua", lat: 6.465, lng: 12.628, radius: 26000 },
  { label: "Bertoua", region: "Est", lat: 4.5773, lng: 13.6846, radius: 28000 }, { label: "Abong-Mbang", region: "Est", lat: 3.983, lng: 13.183, radius: 28000 }, { label: "Batouri", region: "Est", lat: 4.433, lng: 14.367, radius: 28000 },
  { label: "Ebolowa", region: "Sud", lat: 2.9002, lng: 11.1516, radius: 26000 }, { label: "Sangmélima", region: "Sud", lat: 2.934, lng: 11.987, radius: 26000 }, { label: "Kribi", region: "Sud", lat: 2.9373, lng: 9.9077, radius: 26000 },
  { label: "Buea", region: "Sud-Ouest", lat: 4.152, lng: 9.241, radius: 24000 }, { label: "Limbe", region: "Sud-Ouest", lat: 4.0167, lng: 9.2167, radius: 24000 }, { label: "Kumba", region: "Sud-Ouest", lat: 4.6363, lng: 9.4469, radius: 24000 }, { label: "Mamfe", region: "Sud-Ouest", lat: 5.756, lng: 9.313, radius: 24000 },
];

export const HEALTH_QUERIES = ["hôpital", "clinique", "centre de santé", "pharmacie", "laboratoire médical", "maternité", "centre médical spécialisé"];
export const SYNC_SECTORS_PER_RUN = 3;
export const SYNC_QUERIES_PER_RUN = 3;
export const MAX_NEARBY_PAGES = 3;
type PaginatedPlacesSearchResult = PlacesSearchResult & { next_page_token?: string };

export function rotatingBatch<T>(items: T[], size: number, offset: number) {
  return Array.from({ length: Math.min(size, items.length) }, (_, index) => items[(offset + index) % items.length]);
}

export async function fetchNearbyPages(params: { location: string; radius: number; keyword: string }, request = makeRequest) {
  const responses: PaginatedPlacesSearchResult[] = [];
  let response = await request<PaginatedPlacesSearchResult>("/maps/api/place/nearbysearch/json", params);
  responses.push(response);
  for (let page = 1; page < MAX_NEARBY_PAGES && response.next_page_token; page += 1) {
    response = await request<PaginatedPlacesSearchResult>("/maps/api/place/nearbysearch/json", { pagetoken: response.next_page_token });
    responses.push(response);
  }
  return responses;
}

export type SyncResult = { runId: number; searchedAreas: number; discoveredCount: number; updatedCount: number; skippedCount: number; sectors: string[]; queries: string[] };

/**
 * Balaye en continu un maillage national et ne conserve que les identifiants Places et métriques de déduplication.
 * Les détails et médias Places restent demandés à la source lors de l’ouverture d’une fiche.
 */
export async function runFacilityDiscoverySync(now = new Date()): Promise<SyncResult> {
  const db = await getDb();
  if (!db) throw new Error("Base de données indisponible pour la synchronisation.");
  const hourBucket = Math.floor(now.getTime() / 3_600_000);
  const sectors = rotatingBatch(CAMEROON_SECTORS, SYNC_SECTORS_PER_RUN, (hourBucket * SYNC_SECTORS_PER_RUN) % CAMEROON_SECTORS.length);
  const queries = rotatingBatch(HEALTH_QUERIES, SYNC_QUERIES_PER_RUN, (hourBucket * SYNC_QUERIES_PER_RUN) % HEALTH_QUERIES.length);
  const run = await db.insert(syncRuns).values({ status: "running", searchedAreas: sectors.length });
  const runId = Number(run[0].insertId);
  let discoveredCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  try {
    for (const sector of sectors) {
      for (const keyword of queries) {
        const responses = await fetchNearbyPages({ location: `${sector.lat},${sector.lng}`, radius: sector.radius, keyword });
        const allResults = responses.flatMap(response => response.results ?? []);
        const placeIds = Array.from(new Set(allResults.map(result => result.place_id).filter(Boolean)));
        if (!placeIds.length) continue;
        const existing = await db.select({ googlePlaceId: placeIndex.googlePlaceId }).from(placeIndex).where(inArray(placeIndex.googlePlaceId, placeIds));
        const knownIds = new Set(existing.map(item => item.googlePlaceId));
        const firstSeenIds = placeIds.filter(id => !knownIds.has(id));
        discoveredCount += firstSeenIds.length;
        updatedCount += placeIds.length - firstSeenIds.length;
        for (const googlePlaceId of placeIds) await db.insert(placeIndex).values({ googlePlaceId, lastSyncRunId: runId }).onDuplicateKeyUpdate({ set: { lastSyncRunId: runId, lastSeenAt: now } });
        skippedCount += Math.max(0, allResults.length - placeIds.length);
      }
    }
    await db.update(syncRuns).set({ status: "success", discoveredCount, updatedCount, skippedCount, completedAt: new Date() }).where(eq(syncRuns.id, runId));
    if (discoveredCount > 0) await notifyOwner({ title: "MediSecours : nouveaux établissements détectés", content: `${discoveredCount} identifiant(s) Places détectés dans ${sectors.map(item => `${item.label} (${item.region})`).join(", ")} pour ${queries.join(" et ")}. Exécution #${runId}.` });
    return { runId, searchedAreas: sectors.length, discoveredCount, updatedCount, skippedCount, sectors: sectors.map(item => item.label), queries };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue de synchronisation";
    await db.update(syncRuns).set({ status: "failed", errorMessage: message.slice(0, 6000), completedAt: new Date() }).where(eq(syncRuns.id, runId));
    await notifyOwner({ title: "MediSecours : erreur critique de synchronisation", content: `Synchronisation Places #${runId} : ${sectors.map(item => item.label).join(", ")}. Erreur : ${message}` });
    throw error;
  }
}
