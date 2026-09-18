import { describe, expect, it } from "vitest";
import { summarizeRatings } from "./reviewRatings";

describe("summarizeRatings", () => {
  it("retourne un résumé vide lorsqu’aucun avis n’est publié", () => {
    expect(summarizeRatings([])).toEqual({ average: null, count: 0 });
  });

  it("calcule et arrondit la note moyenne des avis validés", () => {
    expect(summarizeRatings([5, 4, 3])).toEqual({ average: 4, count: 3 });
    expect(summarizeRatings([5, 4, 4])).toEqual({ average: 4.33, count: 3 });
  });
});
