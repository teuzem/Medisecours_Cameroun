import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  createCareRequest: vi.fn(),
  searchFacilities: vi.fn(),
}));

vi.mock("./clinical", () => ({
  createCareRequest: mocks.createCareRequest,
  createAppointment: vi.fn(),
  getAdminClinicalSnapshot: vi.fn(),
  getPatientDashboard: vi.fn(),
  listAdminCareRequests: vi.fn(),
  listRecentAuditLogs: vi.fn(),
  markPatientNotificationRead: vi.fn(),
  updateCareRequestStatus: vi.fn(),
  writeAuditLog: vi.fn(),
}));
vi.mock("./db", () => ({
  searchFacilities: mocks.searchFacilities,
  addPlaceToUserCollection: vi.fn(),
  createUserPlaceCollection: vi.fn(),
  deleteUserPlaceCollection: vi.fn(),
  getDb: vi.fn(),
  getFacilityById: vi.fn(),
  getLatestSyncRuns: vi.fn(),
  getPlaceContributions: vi.fn(),
  getUserProfile: vi.fn(),
  listUserPlaceCollections: vi.fn(),
  listUserPlaceLists: vi.fn(),
  listUserRouteHistory: vi.fn(),
  listUserSearchHistory: vi.fn(),
  recordUserRoute: vi.fn(),
  recordUserSearch: vi.fn(),
  removeUserCollectionItem: vi.fn(),
  removeUserCollectionItems: vi.fn(),
  refreshMedisecoursRating: vi.fn(),
  toggleUserPlaceList: vi.fn(),
  updateUserCollectionItemNote: vi.fn(),
  upsertUserProfile: vi.fn(),
}));

import { appRouter } from "./routers";

describe("account.triggerSos", () => {
  it("crée une demande urgente et renvoie les formations de santé les plus proches", async () => {
    mocks.createCareRequest.mockResolvedValue({ id: 77 });
    mocks.searchFacilities.mockResolvedValue([
      { id: 1, name: "Hôpital voisin", category: "hospital", address: "Yaoundé", latitude: "3.867", longitude: "11.517", phones: ["+237 6 90 00 00 00"] },
      { id: 2, name: "Centre de santé", category: "health_center", address: "Yaoundé", latitude: "3.88", longitude: "11.53", phones: null },
      { id: 3, name: "Lieu non sanitaire", category: "other", address: "Yaoundé", latitude: "3.866", longitude: "11.516", phones: null },
    ]);
    const ctx = {
      user: { id: 9, openId: "patient", name: "Patient", email: null, loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
      req: {} as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    } as TrpcContext;

    const result = await appRouter.createCaller(ctx).account.triggerSos({ facilityId: 1, location: { lat: 3.8667, lng: 11.5167 }, consent: true });

    expect(mocks.createCareRequest).toHaveBeenCalledTimes(1);
    expect(mocks.createCareRequest).toHaveBeenCalledWith(9, expect.objectContaining({ facilityId: 1, requestType: "admission", urgency: "emergency" }), expect.stringContaining("Hôpital voisin"));
    expect(result).toMatchObject({ success: true, requestId: 77 });
    expect(result.nearbyFacilities.map(item => item.name)).toEqual(["Hôpital voisin", "Centre de santé"]);
  });
});
