import { describe, expect, it, vi } from "vitest";
import { encodeOAuthState, OAUTH_STATE_COOKIE } from "../shared/const";

const mocks = vi.hoisted(() => ({
  upsertUser: vi.fn(),
  exchangeCodeForToken: vi.fn(),
  getUserInfo: vi.fn(),
  createSessionToken: vi.fn(),
}));

vi.mock("./db", () => ({ upsertUser: mocks.upsertUser }));
vi.mock("./_core/sdk", () => ({
  sdk: {
    exchangeCodeForToken: mocks.exchangeCodeForToken,
    getUserInfo: mocks.getUserInfo,
    createSessionToken: mocks.createSessionToken,
  },
}));

import { registerOAuthRoutes } from "./_core/oauth";

describe("retour OAuth MediSecours", () => {
  it("redirige tout utilisateur authentifié vers le tableau de bord patient", async () => {
    mocks.exchangeCodeForToken.mockResolvedValue({ accessToken: "token" });
    mocks.getUserInfo.mockResolvedValue({ openId: "owner-or-patient", name: "Compte de test" });
    mocks.createSessionToken.mockResolvedValue("session-token");
    mocks.upsertUser.mockResolvedValue(undefined);

    let callback: ((req: any, res: any) => Promise<void>) | undefined;
    registerOAuthRoutes({ get: (_path: string, handler: (req: any, res: any) => Promise<void>) => { callback = handler; } } as any);

    const nonce = "nonce-protected";
    const req = {
      query: { code: "code", state: encodeOAuthState({ redirectUri: "https://example.test/callback", nonce }) },
      headers: { cookie: `${OAUTH_STATE_COOKIE}=${nonce}` },
      protocol: "https",
    };
    const redirect = vi.fn();
    const res = { clearCookie: vi.fn(), cookie: vi.fn(), redirect, status: vi.fn().mockReturnThis(), json: vi.fn() };

    await callback?.(req, res);

    expect(redirect).toHaveBeenCalledWith(302, "/espace-patient");
  });
});
