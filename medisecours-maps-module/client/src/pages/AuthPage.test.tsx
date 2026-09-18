// @vitest-environment jsdom
import { render, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  useAuth: vi.fn(),
}));

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: mocks.useAuth }));
vi.mock("wouter", () => ({
  Link: ({ children, href, ...props }: React.ComponentProps<"a">) => <a href={href} {...props}>{children}</a>,
  useLocation: () => ["/connexion", mocks.navigate],
}));

import AuthPage from "./AuthPage";

describe("AuthPage", () => {
  afterEach(() => vi.clearAllMocks());

  it("redirige aussi le propriétaire vers le tableau de bord patient après le rendu", async () => {
    mocks.useAuth.mockReturnValue({
      isAuthenticated: true,
      loading: false,
      user: { role: "admin" },
    });

    render(<AuthPage mode="login" />);

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith("/espace-patient"));
  });

  it("redirige un patient authentifié vers son espace personnel", async () => {
    mocks.useAuth.mockReturnValue({
      isAuthenticated: true,
      loading: false,
      user: { role: "user" },
    });

    render(<AuthPage mode="register" />);

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith("/espace-patient"));
  });
});
