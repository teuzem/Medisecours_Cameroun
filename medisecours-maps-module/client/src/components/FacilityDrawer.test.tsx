import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/const", () => ({ startLogin: vi.fn() }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    account: {
      dashboard: { useQuery: () => ({ data: { places: [], collections: [] }, refetch: vi.fn() }) },
      togglePlace: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      recordRoute: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      createCollection: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      addToCollection: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
    facilities: {
      submitReview: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      submitPlaceReview: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      submitMedia: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      suggestEdit: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { FacilityDrawer, hasMobileDrawerScrollContract } from "./FacilityDrawer";

const detail = {
  facility: {
    id: 7, name: "Centre de santé MediSecours", category: "health_center", categoryLabel: "Centre de santé",
    address: "Yaoundé, Cameroun", city: "Yaoundé", district: null, region: "Centre", latitude: 3.8667, longitude: 11.5167,
    phones: ["+237 6 00 00 00 00"], website: null, openingHours: [], about: "Information institutionnelle validée par l’administration.", aboutStatus: "published" as const, aboutApprovedAt: new Date(),
    googleRating: "4.2", googleRatingCount: 10, medisecoursRating: "4.5", medisecoursRatingCount: 2, isOpenNow: true, verificationStatus: "verified" as const, lastSyncedAt: null,
  },
  media: [], reviews: [],
};

describe("FacilityDrawer", () => {
  it("affiche les onglets, les actions de parcours et le panneau d’information validé", () => {
    const markup = renderToStaticMarkup(<FacilityDrawer detail={detail} loading={false} isAuthenticated={false} onClose={vi.fn()} />);
    ["Infos", "Photos &amp; vidéos", "Avis", "À propos", "Itinéraire", "Enregistrer", "À proximité", "Vers téléphone", "Partager", "SOS urgence", "Ouvert actuellement"].forEach(label => expect(markup).toContain(label));
    ["Coordonnées et contacts", "Informations de la fiche"].forEach(label => expect(markup).toContain(label));
  });

  it("présente la couverture et les filtres de la galerie quand un média est validé", () => {
    const markup = renderToStaticMarkup(<FacilityDrawer detail={{ ...detail, media: [{ id: 4, url: "https://media.example/cover.jpg", mediaType: "image", caption: "Façade principale" }] }} loading={false} isAuthenticated={false} onClose={vi.fn()} initialTab="Photos & vidéos" />);
    ["Tout (1)", "Photos (1)", "Vidéos (0)", "Façade principale", "cover.jpg"].forEach(label => expect(markup).toContain(label));
  });

  it("conserve un accès attribué aux médias Google Maps quand la galerie MediSecours est vide", () => {
    const markup = renderToStaticMarkup(<FacilityDrawer detail={detail} loading={false} isAuthenticated={false} onClose={vi.fn()} initialTab="Photos & vidéos" />);
    expect(markup).toContain("Voir les médias publics sur Google Maps");
  });

  it("présente la contribution d’avis avec pièce jointe et l’affichage d’un média lié", () => {
    const enrichedDetail = { ...detail, media: [{ id: 8, reviewId: 71, url: "https://media.example/review-proof.jpg", mediaType: "image" as const, caption: "Pièce jointe à l’avis" }], reviews: [{ review: { id: 71, rating: 5, title: "Très bon accueil", content: "Contribution de test", createdAt: new Date() }, author: "Membre MediSecours" }] };
    const markup = renderToStaticMarkup(<FacilityDrawer detail={enrichedDetail} loading={false} isAuthenticated={false} onClose={vi.fn()} initialTab="Avis" />);
    ["Rédiger un avis", "Joindre un média à l’avis", "rattaché à votre avis", "Membre MediSecours", "Pièce jointe à l’avis"].forEach(label => expect(markup).toContain(label));
  });

  it("rend les photos et avis Places à la demande avec attribution et recommandations proches", () => {
    const liveDetail = {
      ...detail,
      facility: { ...detail.facility, id: -1, isLive: true, googlePlaceId: "place-live", googleBusinessStatus: "OPERATIONAL", googleTypes: ["health", "point_of_interest"], googlePlusCode: "6FGX+3Q Douala", googleUtcOffsetMinutes: 60, googleMapsUrl: "https://maps.google.com/?cid=live" },
      media: [{ id: -1, url: "", photoReference: "place-photo-token", mediaType: "image" as const, caption: "Photo publique Google Maps", source: "google" as const }],
      reviews: [{ review: { id: -1, rating: 5, title: "Avis Google Maps", content: "Très bonne prise en charge.", createdAt: new Date("2026-08-17") }, author: "Awa", authorAttribution: { displayName: "Awa", uri: "https://maps.google.com/user/awa", photoUri: null }, relativeTimeDescription: "il y a un mois", source: "google" as const }],
    };
    const similar = [{ placeId: "nearby-place", name: "Centre voisin", address: "Douala, Cameroun", latitude: 4.05, longitude: 9.7, googleRating: "4.6", googleRatingCount: 21, category: "health_center", categoryLabel: "Centre de santé" }];
    const photosMarkup = renderToStaticMarkup(<FacilityDrawer detail={liveDetail} loading={false} isAuthenticated={false} onClose={vi.fn()} initialTab="Photos & vidéos" />);
    const reviewsMarkup = renderToStaticMarkup(<FacilityDrawer detail={liveDetail} loading={false} isAuthenticated={false} onClose={vi.fn()} initialTab="Avis" />);
    const infoMarkup = renderToStaticMarkup(<FacilityDrawer detail={liveDetail} loading={false} isAuthenticated={false} onClose={vi.fn()} similar={similar} />);

    ["api/maps/photo", "Photo publique Google Maps", "Awa", "Très bonne prise en charge.", "Source : Google Maps", "Profil Google Maps", "il y a un mois", "10 avis Google au total", "Google retourne le compteur total exact", "Rédiger un avis MediSecours", "OPERATIONAL", "health, point_of_interest", "6FGX+3Q Douala", "UTC+1", "Ouvrir la fiche Google Maps", "Établissements similaires", "Centre voisin"].forEach(label => expect(`${photosMarkup}${reviewsMarkup}${infoMarkup}`).toContain(label));
  });

  it("préserve un panneau plein écran avec défilement borné dans le viewport mobile", () => {
    expect(hasMobileDrawerScrollContract()).toBe(true);
  });
});
