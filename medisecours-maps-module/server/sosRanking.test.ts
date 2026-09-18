import { describe, expect, it } from "vitest";
import { rankNearbySosFacilities } from "./routers";

describe("rankNearbySosFacilities", () => {
  it("retient seulement les formations de soins et les classe par proximité", () => {
    const nearby = rankNearbySosFacilities(
      { lat: 3.8667, lng: 11.5167 },
      [
        { id: 1, name: "Hôpital proche", category: "hospital", address: "Yaoundé", latitude: "3.868", longitude: "11.517", phones: ["+237600000001"] },
        { id: 2, name: "Centre plus loin", category: "health_center", address: "Yaoundé", latitude: "3.89", longitude: "11.54", phones: null },
        { id: 3, name: "Point non clinique", category: "other", address: "Yaoundé", latitude: "3.867", longitude: "11.517", phones: null },
      ]
    );

    expect(nearby.map(item => item.name)).toEqual(["Hôpital proche", "Centre plus loin"]);
    expect(nearby[0]?.distanceKm).toBeLessThan(nearby[1]?.distanceKm ?? Number.POSITIVE_INFINITY);
  });
});

