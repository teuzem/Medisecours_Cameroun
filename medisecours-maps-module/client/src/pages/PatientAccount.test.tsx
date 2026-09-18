// @vitest-environment jsdom
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const mutations = vi.hoisted(() => ({ updateCollectionNote: vi.fn(), removeManyFromCollection: vi.fn(), updateProfile: vi.fn() }));

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: 4, name: "Patient test", email: "patient@example.org", role: "user" }, loading: false, logout: vi.fn() }) }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    account: {
      dashboard: { useQuery: () => ({ data: { places: [], history: [], routes: [], collections: [{ collection: { id: 10, name: "Proches", color: "#0B8A96" }, items: [{ item: { id: 81, facilityId: 1, googlePlaceId: null, privateNote: "Entrée arrière", createdAt: new Date() }, facility: { name: "Centre A", address: "Douala", googlePlaceId: null } }, { item: { id: 82, facilityId: 2, googlePlaceId: null, privateNote: null, createdAt: new Date() }, facility: { name: "Centre B", address: "Douala", googlePlaceId: null } }] }] }, isLoading: false, refetch: vi.fn() }) },
      clinicalDashboard: { useQuery: () => ({ data: { episodes: [], events: [], appointments: [], notifications: [] }, isLoading: false, refetch: vi.fn() }) },
      createCollection: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      deleteCollection: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      updateCollectionNote: { useMutation: () => ({ mutate: mutations.updateCollectionNote, isPending: false }) },
      removeFromCollection: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      removeManyFromCollection: { useMutation: () => ({ mutate: mutations.removeManyFromCollection, isPending: false }) },
      updateProfile: { useMutation: () => ({ mutate: mutations.updateProfile, isPending: false }) },
      createCareRequest: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      markNotificationRead: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
    facilities: { liveByPlaceId: { useQuery: () => ({ data: undefined }) } },
  },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import PatientAccount from "./PatientAccount";

describe("PatientAccount — collections privées", () => {
  it("enregistre une note privée et retire plusieurs éléments depuis une collection", async () => {
    const user = userEvent.setup();
    render(<PatientAccount />);

    const note = screen.getByDisplayValue("Entrée arrière");
    await user.clear(note);
    await user.type(note, "Accès par la porte bleue");
    await user.click(screen.getAllByRole("button", { name: "Enregistrer" })[0]);
    await user.click(screen.getByRole("button", { name: "Tout retirer" }));

    expect(mutations.updateCollectionNote).toHaveBeenCalledWith({ itemId: 81, privateNote: "Accès par la porte bleue" });
    expect(mutations.removeManyFromCollection).toHaveBeenCalledWith({ itemIds: [81, 82] });
  });
});
