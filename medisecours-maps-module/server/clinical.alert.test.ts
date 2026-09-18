import { describe, expect, it } from "vitest";
import { buildOwnerCareRequestAlert } from "./clinical";

describe("buildOwnerCareRequestAlert", () => {
  it("signale explicitement une urgence sans exposer la note du patient", () => {
    const alert = buildOwnerCareRequestAlert(42, {
      facilityId: 17,
      requestType: "admission",
      urgency: "emergency",
      patientNote: "Information clinique confidentielle",
    });

    expect(alert.title).toBe("ALERTE URGENCE — demande #42");
    expect(alert.content).toContain("Niveau déclaré : Urgence");
    expect(alert.content).toContain("établissement #17");
    expect(alert.content).not.toContain("Information clinique confidentielle");
  });

  it("génère également une notification opérationnelle pour une demande non urgente", () => {
    const alert = buildOwnerCareRequestAlert(7, {
      googlePlaceId: "place-123",
      requestType: "orientation",
      urgency: "soon",
    });

    expect(alert.title).toBe("Nouvelle demande de secours — demande #7");
    expect(alert.content).toContain("À traiter rapidement");
    expect(alert.content).toContain("établissement Google Maps sélectionné");
  });
});

