import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  makeRequest: vi.fn(),
  notifyOwner: vi.fn(),
}));

vi.mock("../db", () => ({ getDb: mocks.getDb }));
vi.mock("../_core/map", () => ({ makeRequest: mocks.makeRequest }));
vi.mock("../_core/notification", () => ({ notifyOwner: mocks.notifyOwner }));

import { placeIndex, syncRuns } from "../../drizzle/schema";
import { CAMEROON_SECTORS, fetchNearbyPages, runFacilityDiscoverySync } from "./placesSync";

describe("runFacilityDiscoverySync", () => {
  beforeEach(() => vi.clearAllMocks());

  it("journalise une découverte par secteurs, indexe les identifiants et alerte le propriétaire", async () => {
    const onDuplicateKeyUpdate = vi.fn().mockResolvedValue(undefined);
    const valuesPlaceIndex = vi.fn().mockReturnValue({ onDuplicateKeyUpdate });
    const valuesSyncRun = vi.fn().mockResolvedValue([{ insertId: 77 }]);
    const updateWhere = vi.fn().mockResolvedValue(undefined);
    const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
    const db = {
      insert: vi.fn((table: unknown) => table === syncRuns ? { values: valuesSyncRun } : { values: valuesPlaceIndex }),
      select: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) }),
      update: vi.fn().mockReturnValue({ set: updateSet }),
    };
    mocks.getDb.mockResolvedValue(db);
    mocks.makeRequest.mockResolvedValue({ results: [{ place_id: "place-a" }, { place_id: "place-b" }] });
    mocks.notifyOwner.mockResolvedValue(undefined);

    const result = await runFacilityDiscoverySync(new Date("2026-08-17T12:00:00.000Z"));

    expect(result.runId).toBe(77);
    expect(result.searchedAreas).toBe(3);
    expect(mocks.makeRequest).toHaveBeenCalledTimes(9);
    expect(db.insert).toHaveBeenCalledWith(placeIndex);
    expect(mocks.notifyOwner).toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringContaining("nouveaux établissements") }));
  });

  it("maillage les dix régions et suit jusqu’à trois pages de résultats par recherche", async () => {
    const regions = new Set(CAMEROON_SECTORS.map(sector => sector.region));
    const request = vi.fn()
      .mockResolvedValueOnce({ results: [{ place_id: "a" }], next_page_token: "page-two" })
      .mockResolvedValueOnce({ results: [{ place_id: "b" }], next_page_token: "page-three" })
      .mockResolvedValueOnce({ results: [{ place_id: "c" }] });

    const pages = await fetchNearbyPages({ location: "3.848,11.502", radius: 28000, keyword: "hôpital" }, request);

    expect(regions.size).toBe(10);
    expect(pages).toHaveLength(3);
    expect(request).toHaveBeenLastCalledWith("/maps/api/place/nearbysearch/json", { pagetoken: "page-three" });
  });
});
