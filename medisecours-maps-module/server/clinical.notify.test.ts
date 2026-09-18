import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  notifyOwner: vi.fn(),
}));

vi.mock("./db", () => ({ getDb: mocks.getDb }));
vi.mock("./_core/notification", () => ({ notifyOwner: mocks.notifyOwner }));

import { createCareRequest } from "./clinical";

describe("createCareRequest", () => {
  beforeEach(() => {
    let insertCount = 0;
    const values = vi.fn(() => {
      insertCount += 1;
      if (insertCount === 1) return [{ insertId: 42 }];
      if (insertCount === 2) return [{ insertId: 81 }];
      return [{ insertId: 0 }];
    });
    mocks.getDb.mockResolvedValue({
      insert: vi.fn(() => ({ values })),
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([{ id: 42 }]) })),
        })),
      })),
    });
    mocks.notifyOwner.mockResolvedValue(true);
  });

  it("notifie automatiquement le propriétaire lorsqu’une urgence est créée", async () => {
    await createCareRequest(7, {
      facilityId: 19,
      requestType: "admission",
      urgency: "emergency",
      patientNote: "Donnée clinique qui ne doit pas apparaître dans l’alerte.",
    });

    expect(mocks.notifyOwner).toHaveBeenCalledTimes(1);
    expect(mocks.notifyOwner).toHaveBeenCalledWith(expect.objectContaining({
      title: "ALERTE URGENCE — demande #42",
      content: expect.stringContaining("établissement #19"),
    }));
    expect(mocks.notifyOwner.mock.calls[0]?.[0]?.content).not.toContain("Donnée clinique");
  });
});
