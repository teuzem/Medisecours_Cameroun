import { describe, expect, it } from "vitest";
import { rotatingBatch } from "./placesSync";

describe("rotatingBatch", () => {
  it("sélectionne une tranche de taille contrôlée", () => {
    expect(rotatingBatch(["A", "B", "C"], 2, 0)).toEqual(["A", "B"]);
  });

  it("reprend au début de la liste pour répartir les exécutions", () => {
    expect(rotatingBatch(["A", "B", "C"], 2, 2)).toEqual(["C", "A"]);
  });
});
