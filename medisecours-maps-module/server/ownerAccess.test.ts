import { describe, expect, it } from "vitest";
import { isDesignatedOwner } from "./_core/trpc";

describe("isDesignatedOwner", () => {
  it("autorise uniquement l’identifiant propriétaire configuré", () => {
    expect(isDesignatedOwner("owner-001", "owner-001")).toBe(true);
    expect(isDesignatedOwner("other-admin", "owner-001")).toBe(false);
    expect(isDesignatedOwner("owner-001", "")).toBe(false);
  });
});
