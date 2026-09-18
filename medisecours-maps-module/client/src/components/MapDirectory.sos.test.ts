import { describe, expect, it } from "vitest";
import { buildSosContactHref } from "./MapDirectory";

describe("buildSosContactHref", () => {
  it("prépare des liens directs et sûrs pour appeler ou écrire à une formation sanitaire", () => {
    expect(buildSosContactHref("+237 6 99-00-00-00", "call")).toBe("tel:+237699000000");
    expect(buildSosContactHref("+237 6 99-00-00-00", "sms")).toBe("sms:+237699000000");
  });
});

