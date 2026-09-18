import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { facilities, facilityCategories, facilityMedia, facilityReviews, facilitySuggestions, placeContributionMedia, placeContributions } from "../drizzle/schema";
import {
  addPlaceToUserCollection,
  createUserPlaceCollection,
  deleteUserPlaceCollection,
  getDb,
  getFacilityById,
  getLatestSyncRuns,
  getUserProfile,
  getPlaceContributions,
  listUserPlaceCollections,
  listUserPlaceLists,
  listUserRouteHistory,
  listUserSearchHistory,
  recordUserSearch,
  recordUserRoute,
  removeUserCollectionItem,
  removeUserCollectionItems,
  refreshMedisecoursRating,
  searchFacilities,
  toggleUserPlaceList,
  upsertUserProfile,
  updateUserCollectionItemNote,
} from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";
import { getMapsQuotaCooldownRemaining, hasMapsServerConfiguration, makeRequest, MapsServiceError } from "./_core/map";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { storagePut } from "./storage";
import { COOKIE_NAME } from "@shared/const";
import { buildPlacesSearchCenters, radiusForPlacesBounds, type PlacesBounds } from "./services/placesCoverage";
import { createAppointment, createCareRequest, getAdminClinicalSnapshot, getPatientDashboard, listAdminCareRequests, listRecentAuditLogs, markPatientNotificationRead, updateCareRequestStatus, writeAuditLog } from "./clinical";
import { runFacilityDiscoverySync } from "./services/placesSync";

const categorySchema = z.enum(facilityCategories);
const locationSchema = z.object({ lat: z.number(), lng: z.number() });
const personalTargetSchema = z.object({ facilityId: z.number().int().positive().optional(), googlePlaceId: z.string().min(3).max(255).optional() }).refine(input => Boolean(input.facilityId || input.googlePlaceId), "Sélectionnez un établissement.");
const liveCategoryLabels: Record<string, string> = {
  all: "formation sanitaire",
  hospital: "hôpital",
  clinic: "clinique",
  health_center: "centre de santé",
  pharmacy: "pharmacie",
  laboratory: "laboratoire médical",
  maternity: "maternité",
  specialized_center: "centre médical spécialisé",
  dental_center: "centre dentaire",
  medical_office: "cabinet médical",
  other: "établissement de santé",
};

const liveGoogleTypeByCategory: Partial<Record<string, string>> = {
  hospital: "hospital",
  clinic: "doctor",
  health_center: "doctor",
  pharmacy: "pharmacy",
  laboratory: "doctor",
  maternity: "hospital",
  specialized_center: "doctor",
};

function createFacilitySlug(name: string, city?: string | null) {
  const base = `${name}-${city || "cameroun"}`.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `${base || "formation-sanitaire"}-${Date.now()}`.slice(0, 280);
}

function isMapsConfigurationError(error: unknown): error is MapsServiceError {
  return error instanceof MapsServiceError && error.kind === "configuration_missing";
}

function kilometersBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const earthRadiusKm = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(earthRadiusKm * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)) * 10) / 10;
}

const sosCategories = new Set(["hospital", "clinic", "health_center", "maternity", "specialized_center"]);

export function rankNearbySosFacilities(origin: { lat: number; lng: number }, candidates: Array<{ id: number; name: string; category: string; address: string; latitude: string; longitude: string; phones: string[] | null }>) {
  return candidates
    .filter(item => sosCategories.has(item.category))
    .map(item => ({ ...item, latitude: Number(item.latitude), longitude: Number(item.longitude) }))
    .filter(item => Number.isFinite(item.latitude) && Number.isFinite(item.longitude))
    .map(item => ({ ...item, distanceKm: kilometersBetween(origin, { lat: item.latitude, lng: item.longitude }) }))
    .sort((left, right) => left.distanceKm - right.distanceKm)
    .slice(0, 5);
}

function toBase64Payload(dataUrl: string) {
  const match = dataUrl.match(/^data:([a-zA-Z0-9/+.-]+);base64,(.+)$/);
  if (!match) throw new TRPCError({ code: "BAD_REQUEST", message: "Fichier média invalide." });
  const [, mimeType, payload] = match;
  const bytes = Buffer.from(payload, "base64");
  if (bytes.byteLength > 7 * 1024 * 1024) {
    throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Le média ne doit pas dépasser 7 Mo." });
  }
  return { mimeType, bytes };
}

type DbClient = Exclude<Awaited<ReturnType<typeof getDb>>, null>;

async function assertFacilityExists(db: DbClient, facilityId: number) {
  const facility = (await db.select({ id: facilities.id }).from(facilities).where(eq(facilities.id, facilityId)).limit(1))[0];
  if (!facility) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Cet établissement n’existe plus ou n’est pas disponible." });
  }
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user ? { ...opts.ctx.user, isOwner: opts.ctx.user.openId === ENV.ownerOpenId } : null),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  account: router({
    dashboard: protectedProcedure.query(async ({ ctx }) => {
      const [places, history, collections, routes, profile] = await Promise.all([
        listUserPlaceLists(ctx.user.id),
        listUserSearchHistory(ctx.user.id),
        listUserPlaceCollections(ctx.user.id),
        listUserRouteHistory(ctx.user.id),
        getUserProfile(ctx.user.id),
      ]);
      return { user: ctx.user, places, history, collections, routes, profile };
    }),
    updateProfile: protectedProcedure
      .input(z.object({ phone: z.string().trim().max(40).nullable(), city: z.string().trim().max(120).nullable(), preferredCategories: z.array(categorySchema).max(8), communicationConsent: z.boolean() }))
      .mutation(async ({ ctx, input }) => ({ success: true, profile: await upsertUserProfile(ctx.user.id, input) })),
    clinicalDashboard: protectedProcedure.query(({ ctx }) => getPatientDashboard(ctx.user.id)),
    createCareRequest: protectedProcedure
      .input(z.object({ facilityId: z.number().int().positive().optional(), googlePlaceId: z.string().min(3).max(255).optional(), requestType: z.enum(["orientation", "appointment", "admission"]), urgency: z.enum(["routine", "soon", "urgent", "emergency"]), patientNote: z.string().trim().max(1200).optional(), preferredAt: z.coerce.date().optional(), consent: z.literal(true) }).refine(input => Boolean(input.facilityId || input.googlePlaceId), "Sélectionnez un établissement ou une destination."))
      .mutation(async ({ ctx, input }) => {
        const { consent: _consent, ...request } = input;
        return { success: true, request: await createCareRequest(ctx.user.id, request) };
      }),
    triggerSos: protectedProcedure
      .input(personalTargetSchema.and(z.object({ location: locationSchema, consent: z.literal(true) })))
      .mutation(async ({ ctx, input }) => {
        const { consent: _consent, location, ...destination } = input;
        const nearbyFacilities = rankNearbySosFacilities(location, await searchFacilities({ limit: 120 }));
        const targetSummary = nearbyFacilities.length
          ? nearbyFacilities.map(item => `${item.name} (${item.distanceKm.toLocaleString("fr-CM", { maximumFractionDigits: 1 })} km)`).join(" · ")
          : "Aucune formation sanitaire indexée à proximité immédiate.";
        const request = await createCareRequest(ctx.user.id, { ...destination, requestType: "admission", urgency: "emergency" }, `Formations sanitaires proches identifiées : ${targetSummary}. Une diffusion directe aux établissements nécessite un canal de contact autorisé et configuré.`);
        return { success: true, requestId: request.id, nearbyFacilities: nearbyFacilities.map(({ id, name, category, address, latitude, longitude, phones, distanceKm }) => ({ id, name, category, address, latitude, longitude, phones, distanceKm })) } as const;
      }),
    markNotificationRead: protectedProcedure
      .input(z.object({ notificationId: z.number().int().positive() }))
      .mutation(({ ctx, input }) => markPatientNotificationRead(ctx.user.id, input.notificationId)),
    togglePlace: protectedProcedure
      .input(z.object({ listType: z.enum(["saved", "wishlist"]), facilityId: z.number().int().positive().optional(), googlePlaceId: z.string().min(3).max(255).optional() }).refine(input => Boolean(input.facilityId || input.googlePlaceId), "Sélectionnez un établissement."))
      .mutation(async ({ ctx, input }) => {
        const result = await toggleUserPlaceList(ctx.user.id, input.listType, input);
        return { success: true, ...result };
      }),
    recordSearch: protectedProcedure
      .input(z.object({ searchText: z.string().trim().min(2).max(120), category: z.string().max(80).optional(), source: z.enum(["map", "sidebar"]).optional() }))
      .mutation(async ({ ctx, input }) => {
        await recordUserSearch(ctx.user.id, input);
        return { success: true };
      }),
    createCollection: protectedProcedure
      .input(z.object({ name: z.string().trim().min(2).max(80), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional() }))
      .mutation(async ({ ctx, input }) => ({ success: true, collection: await createUserPlaceCollection(ctx.user.id, input) })),
    deleteCollection: protectedProcedure
      .input(z.object({ collectionId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        try {
          await deleteUserPlaceCollection(ctx.user.id, input.collectionId);
          return { success: true };
        } catch (error) {
          if ((error as Error).message === "Collection inaccessible.") throw new TRPCError({ code: "FORBIDDEN", message: "Cette collection ne vous appartient pas." });
          throw error;
        }
      }),
    addToCollection: protectedProcedure
      .input(z.object({ collectionId: z.number().int().positive() }).and(personalTargetSchema))
      .mutation(async ({ ctx, input }) => {
        try {
          const { collectionId, ...target } = input;
          return { success: true, ...(await addPlaceToUserCollection(ctx.user.id, collectionId, target)) };
        } catch (error) {
          if ((error as Error).message === "Collection inaccessible.") throw new TRPCError({ code: "FORBIDDEN", message: "Cette collection ne vous appartient pas." });
          throw error;
        }
      }),
    updateCollectionNote: protectedProcedure
      .input(z.object({ itemId: z.number().int().positive(), privateNote: z.string().trim().max(600).nullable() }))
      .mutation(async ({ ctx, input }) => {
        try {
          await updateUserCollectionItemNote(ctx.user.id, input.itemId, input.privateNote);
          return { success: true };
        } catch (error) {
          if ((error as Error).message === "Élément de collection inaccessible.") throw new TRPCError({ code: "FORBIDDEN", message: "Cet élément ne vous appartient pas." });
          throw error;
        }
      }),
    removeFromCollection: protectedProcedure
      .input(z.object({ itemId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        try {
          await removeUserCollectionItem(ctx.user.id, input.itemId);
          return { success: true };
        } catch (error) {
          if ((error as Error).message === "Élément de collection inaccessible.") throw new TRPCError({ code: "FORBIDDEN", message: "Cet élément ne vous appartient pas." });
          throw error;
        }
      }),
    removeManyFromCollection: protectedProcedure
      .input(z.object({ itemIds: z.array(z.number().int().positive()).min(2).max(50) }))
      .mutation(async ({ ctx, input }) => {
        try {
          return { success: true, ...(await removeUserCollectionItems(ctx.user.id, input.itemIds)) };
        } catch (error) {
          if ((error as Error).message === "Élément de collection inaccessible.") throw new TRPCError({ code: "FORBIDDEN", message: "Un ou plusieurs éléments ne vous appartiennent pas." });
          throw error;
        }
      }),
    recordRoute: protectedProcedure
      .input(personalTargetSchema.and(z.object({ travelMode: z.enum(["DRIVING", "WALKING", "BICYCLING"]) })))
      .mutation(async ({ ctx, input }) => ({ success: true, ...(await recordUserRoute(ctx.user.id, input)) })),
  }),
  facilities: router({
    mapsStatus: publicProcedure.query(() => ({
      configured: hasMapsServerConfiguration(),
      provider: "manus-proxy" as const,
      quotaCooldownSeconds: Math.ceil(getMapsQuotaCooldownRemaining() / 1000),
      message: hasMapsServerConfiguration() ? "Services cartographiques disponibles." : "Configuration cartographique serveur manquante.",
    })),
    categories: publicProcedure.query(() => [
      { id: "all", label: "Tous", icon: "MapPin" },
      { id: "hospital", label: "Hôpitaux", icon: "Hospital" },
      { id: "clinic", label: "Cliniques", icon: "Stethoscope" },
      { id: "health_center", label: "Centres de santé", icon: "HeartPulse" },
      { id: "pharmacy", label: "Pharmacies", icon: "Pill" },
      { id: "laboratory", label: "Laboratoires", icon: "FlaskConical" },
      { id: "maternity", label: "Maternités", icon: "Baby" },
      { id: "specialized_center", label: "Centres spécialisés", icon: "Cross" },
    ]),
    search: publicProcedure
      .input(
        z.object({
          query: z.string().max(120).optional(),
          category: categorySchema.or(z.literal("all")).optional(),
          bounds: z
            .object({ north: z.number(), south: z.number(), east: z.number(), west: z.number() })
            .optional(),
          userLocation: locationSchema.optional(),
          limit: z.number().int().min(1).max(120).optional(),
        })
      )
      .query(async ({ input }) => {
        const results = await searchFacilities(input);
        return results.map(facility => {
          const latitude = Number(facility.latitude);
          const longitude = Number(facility.longitude);
          return {
            ...facility,
            latitude,
            longitude,
            distanceKm: input.userLocation
              ? kilometersBetween(input.userLocation, { lat: latitude, lng: longitude })
              : null,
          };
        });
      }),
    autocomplete: publicProcedure
      .input(z.object({ input: z.string().trim().min(2).max(120), location: locationSchema.optional() }))
      .query(async ({ input }) => {
        try {
          const response = await makeRequest<{
            predictions?: Array<{ description: string; place_id: string; structured_formatting?: { main_text: string; secondary_text: string } }>;
          }>("/maps/api/place/autocomplete/json", {
            input: input.input,
            components: "country:cm",
            ...(input.location ? { location: `${input.location.lat},${input.location.lng}`, radius: 50000 } : {}),
          });
          return response.predictions ?? [];
        } catch (error) {
          if (isMapsConfigurationError(error)) return [];
          throw error;
        }
      }),
    liveSearch: publicProcedure
      .input(
        z.object({
          query: z.string().trim().max(120).optional(),
          category: categorySchema.or(z.literal("all")).optional(),
          location: locationSchema.optional(),
          bounds: z.object({ north: z.number(), south: z.number(), east: z.number(), west: z.number() }).optional(),
          pageTokens: z.array(z.string().min(8).max(1024)).max(36).optional(),
          maxSectors: z.number().int().min(1).max(10).optional(),
        })
      )
      .query(async ({ input }) => {
        try {
          const category = input.category ?? "all";
        const query = input.query || undefined;
        const bounds = input.bounds as PlacesBounds | undefined;
        const centers = buildPlacesSearchCenters({ location: input.location, bounds, maxSectors: input.maxSectors });
        const radius = radiusForPlacesBounds(bounds);
        const googleTypes = query ? [undefined] : category === "all" ? ["hospital", "doctor", "pharmacy"] : [liveGoogleTypeByCategory[category]];
        type PlacesResponse = {
          results?: Array<{
            place_id: string;
            name: string;
            formatted_address: string;
            geometry: { location: { lat: number; lng: number } };
            rating?: number;
            user_ratings_total?: number;
            business_status?: string;
          }>;
          next_page_token?: string;
        };
        const responses = await Promise.all(
          input.pageTokens?.length
            ? input.pageTokens.map(pageToken => makeRequest<PlacesResponse>("/maps/api/place/nearbysearch/json", { pagetoken: pageToken }))
            : centers.flatMap(center => googleTypes.map(type => makeRequest<PlacesResponse>("/maps/api/place/nearbysearch/json", {
              location: `${center.lat},${center.lng}`,
              radius,
              ...(query ? { keyword: query } : {}),
              ...(type ? { type } : {}),
            })))
        );
        const seen = new Set<string>();
        const places = responses.flatMap(response => response.results ?? []).filter(place => {
          if (seen.has(place.place_id)) return false;
          seen.add(place.place_id);
          return true;
        });
          return {
            places: places.map(place => ({
          placeId: place.place_id,
          name: place.name,
          address: place.formatted_address,
          latitude: place.geometry.location.lat,
          longitude: place.geometry.location.lng,
          googleRating: place.rating ?? null,
          googleRatingCount: place.user_ratings_total ?? 0,
          isOpenNow: null,
          category,
          categoryLabel: liveCategoryLabels[category],
          verificationStatus: "unverified" as const,
          isLive: true as const,
          })),
          nextPageTokens: responses.map(response => response.next_page_token).filter((token): token is string => Boolean(token)),
          searchedSectors: input.pageTokens?.length || centers.length,
          isNationalCoverage: !input.location && !input.bounds,
          serviceStatus: "available" as const,
        };
        } catch (error) {
          if (isMapsConfigurationError(error)) {
            return {
              places: [],
              nextPageTokens: [],
              searchedSectors: 0,
              isNationalCoverage: !input.location && !input.bounds,
              serviceStatus: "configuration_missing" as const,
            };
          }
          throw error;
        }
      }),
    liveByPlaceId: publicProcedure
      .input(z.object({ placeId: z.string().min(3).max(255), category: categorySchema.or(z.literal("all")) }))
      .query(async ({ input }) => {
        const response = await makeRequest<{
          result?: {
            place_id: string;
            name: string;
            formatted_address: string;
            formatted_phone_number?: string;
            international_phone_number?: string;
            website?: string;
            rating?: number;
            user_ratings_total?: number;
            url?: string;
            business_status?: string;
            types?: string[];
            utc_offset?: number;
            plus_code?: { compound_code?: string; global_code?: string };
            editorial_summary?: { overview?: string };
            photos?: Array<{ photo_reference: string; html_attributions?: string[] }>;
            reviews?: Array<{ author_name: string; author_url?: string; profile_photo_url?: string; rating: number; text: string; time: number; relative_time_description?: string }>;
            opening_hours?: { open_now?: boolean; weekday_text?: string[] };
            geometry: { location: { lat: number; lng: number } };
          };
        }>('/maps/api/place/details/json', {
          place_id: input.placeId,
          fields: "place_id,name,formatted_address,formatted_phone_number,international_phone_number,website,rating,user_ratings_total,opening_hours,geometry,photos,reviews,url,editorial_summary,business_status,types,utc_offset,plus_code",
        });
        const place = response.result;
        if (!place) throw new TRPCError({ code: "NOT_FOUND", message: "Détail Google Places indisponible." });
        const native = await getPlaceContributions(place.place_id);
        return {
          facility: {
            id: -1,
            isLive: true,
            googlePlaceId: place.place_id,
            name: place.name,
            category: input.category,
            categoryLabel: liveCategoryLabels[input.category],
            address: place.formatted_address,
            city: null,
            district: null,
            region: null,
            latitude: place.geometry.location.lat,
            longitude: place.geometry.location.lng,
            phones: [place.international_phone_number || place.formatted_phone_number].filter(Boolean) as string[],
            website: place.website || null,
            openingHours: place.opening_hours?.weekday_text?.map(day => ({ day })) ?? null,
            googleRating: place.rating ? String(place.rating) : null,
            googleRatingCount: place.user_ratings_total ?? 0,
            medisecoursRating: null,
            medisecoursRatingCount: 0,
            isOpenNow: place.opening_hours?.open_now ?? null,
            verificationStatus: "unverified" as const,
            lastSyncedAt: null,
            about: place.editorial_summary?.overview || null,
            aboutStatus: "published" as const,
            aboutApprovedAt: null,
            googleMapsUrl: place.url || null,
            googleBusinessStatus: place.business_status || null,
            googleTypes: place.types ?? [],
            googleUtcOffsetMinutes: place.utc_offset ?? null,
            googlePlusCode: place.plus_code?.compound_code || place.plus_code?.global_code || null,
          },
          media: [
            ...(place.photos ?? []).slice(0, 10).map((photo, index) => ({ id: -(index + 1), url: "", photoReference: photo.photo_reference, mediaType: "image" as const, caption: "Photo publique Google Maps", source: "google" as const })),
            ...native.media.map(({ media }) => ({ id: media.id, url: media.url, mediaType: media.mediaType, caption: media.caption, reviewId: media.contributionId, source: "medisecours" as const })),
          ],
          reviews: [
            ...(place.reviews ?? []).map((review, index) => ({ review: { id: -(index + 1), rating: review.rating, title: "Avis Google Maps", content: review.text, createdAt: new Date(review.time * 1000) }, author: review.author_name, authorAttribution: { displayName: review.author_name, uri: review.author_url || null, photoUri: review.profile_photo_url || null }, relativeTimeDescription: review.relative_time_description || null, source: "google" as const })),
            ...native.contributions.map(({ contribution, author }) => ({ review: { id: contribution.id, rating: contribution.rating, title: contribution.title, content: contribution.content, createdAt: contribution.createdAt }, author: author || "Membre MediSecours", source: "medisecours" as const })),
          ],
        };
      }),
    similar: publicProcedure
      .input(z.object({ latitude: z.number(), longitude: z.number(), category: categorySchema.or(z.literal("all")), excludePlaceId: z.string().optional() }))
      .query(async ({ input }) => {
        const response = await makeRequest<{
          results?: Array<{
            place_id: string;
            name: string;
            formatted_address: string;
            geometry: { location: { lat: number; lng: number } };
            rating?: number;
            user_ratings_total?: number;
          }>;
        }>("/maps/api/place/nearbysearch/json", {
          location: `${input.latitude},${input.longitude}`,
          radius: 5000,
          keyword: liveCategoryLabels[input.category] || "formation sanitaire",
        });
        return (response.results ?? [])
          .filter(place => place.place_id !== input.excludePlaceId)
          .slice(0, 6)
          .map(place => ({
            placeId: place.place_id,
            name: place.name,
            address: place.formatted_address,
            latitude: place.geometry.location.lat,
            longitude: place.geometry.location.lng,
            googleRating: place.rating === undefined ? null : String(place.rating),
            googleRatingCount: place.user_ratings_total ?? 0,
            category: input.category,
            categoryLabel: liveCategoryLabels[input.category] || liveCategoryLabels.all,
          }));
      }),
    byId: publicProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ input }) => {
      const detail = await getFacilityById(input.id);
      if (!detail) throw new TRPCError({ code: "NOT_FOUND", message: "Établissement introuvable." });
      const facility = detail.facility;
      const enrichment = [
        facility.services?.length ? `Services proposés : ${facility.services.join(", ")}` : null,
        facility.infrastructure?.length ? `Infrastructures et atouts : ${facility.infrastructure.join(", ")}` : null,
        facility.benefits?.length ? `Avantages : ${facility.benefits.join(", ")}` : null,
        facility.updates?.length ? `Actualités : ${facility.updates.map(update => update.title).join(" · ")}` : null,
        facility.enrichmentSourceUrl ? `Source institutionnelle : ${facility.enrichmentSourceUrl}` : null,
      ].filter(Boolean).join("\n\n");
      return {
        ...detail,
        facility: {
          ...facility,
          about: [facility.about, enrichment].filter(Boolean).join("\n\n") || null,
          latitude: Number(facility.latitude),
          longitude: Number(facility.longitude),
        },
        media: [
          ...detail.media,
          ...(facility.officialVideoUrl ? [{ id: -9_999, url: facility.officialVideoUrl, mediaType: "video" as const, caption: "Vidéo officielle de l’établissement", source: "verified_establishment" as const }] : []),
        ],
      };
    }),
    submitReview: protectedProcedure
      .input(
        z.object({
          facilityId: z.number().int().positive(),
          rating: z.number().int().min(1).max(5),
          title: z.string().trim().max(120).optional(),
          content: z.string().trim().max(1500).optional(),
          media: z.union([z.object({ dataUrl: z.string().min(32), caption: z.string().trim().max(280).optional() }), z.array(z.object({ dataUrl: z.string().min(32), caption: z.string().trim().max(280).optional() })).max(5)]).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Base de données indisponible." });
        await assertFacilityExists(db, input.facilityId);
        await db
          .insert(facilityReviews)
          .values({
            facilityId: input.facilityId,
            userId: ctx.user.id,
            rating: input.rating,
            title: input.title || null,
            content: input.content ?? "",
            status: "published",
          })
          .onDuplicateKeyUpdate({
            set: { rating: input.rating, title: input.title || null, content: input.content ?? "", status: "published" },
          });
        const reviewMedia = input.media ? (Array.isArray(input.media) ? input.media : [input.media]) : [];
        if (reviewMedia.length) {
          const review = (await db.select({ id: facilityReviews.id }).from(facilityReviews).where(and(eq(facilityReviews.facilityId, input.facilityId), eq(facilityReviews.userId, ctx.user.id))).limit(1))[0];
          if (!review) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Impossible de rattacher le média à votre avis." });
          for (const media of reviewMedia) {
          const { mimeType, bytes } = toBase64Payload(media.dataUrl);
          if (!mimeType.startsWith("image/") && !mimeType.startsWith("video/")) throw new TRPCError({ code: "BAD_REQUEST", message: "Seuls les images et les vidéos sont acceptés." });
          const mediaType = mimeType.startsWith("video/") ? "video" : "image";
          const extension = mimeType.split("/")[1]?.replace("jpeg", "jpg") || "bin";
          if (mimeType.startsWith("image/") && bytes.length > 2 * 1024 * 1024) throw new TRPCError({ code: "BAD_REQUEST", message: "Each image must be 2 MB or smaller." });
          const uploaded = await storagePut(`facilities/${input.facilityId}/reviews/${review.id}-${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`, bytes, mimeType);
          await db.insert(facilityMedia).values({ facilityId: input.facilityId, reviewId: review.id, submittedByUserId: ctx.user.id, mediaType, storageKey: uploaded.key, url: uploaded.url, caption: media.caption || null, status: "published" });
          }
        }
        const summary = await refreshMedisecoursRating(input.facilityId);
        return { success: true, summary, message: input.media ? "Votre avis et son média sont publiés." : "Votre avis est publié." };
      }),
    submitPlaceReview: protectedProcedure
      .input(z.object({ googlePlaceId: z.string().min(3).max(255), rating: z.number().int().min(1).max(5), title: z.string().trim().max(120).optional(), content: z.string().trim().max(1500).optional(), media: z.union([z.object({ dataUrl: z.string().min(32), caption: z.string().trim().max(280).optional() }), z.array(z.object({ dataUrl: z.string().min(32), caption: z.string().trim().max(280).optional() })).max(5)]).optional() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Base de données indisponible." });
        await db.insert(placeContributions).values({ googlePlaceId: input.googlePlaceId, userId: ctx.user.id, rating: input.rating, title: input.title || null, content: input.content ?? "", status: "published" }).onDuplicateKeyUpdate({ set: { rating: input.rating, title: input.title || null, content: input.content ?? "", status: "published" } });
        const contribution = (await db.select({ id: placeContributions.id }).from(placeContributions).where(and(eq(placeContributions.googlePlaceId, input.googlePlaceId), eq(placeContributions.userId, ctx.user.id))).limit(1))[0];
        if (!contribution) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Impossible d’associer votre contribution à cette fiche." });
        const reviewMedia = input.media ? (Array.isArray(input.media) ? input.media : [input.media]) : [];
        if (reviewMedia.length) {
          for (const media of reviewMedia) {
          const { mimeType, bytes } = toBase64Payload(media.dataUrl);
          if (!mimeType.startsWith("image/") && !mimeType.startsWith("video/")) throw new TRPCError({ code: "BAD_REQUEST", message: "Seuls les images et les vidéos sont acceptés." });
          const mediaType = mimeType.startsWith("video/") ? "video" : "image";
          const extension = mimeType.split("/")[1]?.replace("jpeg", "jpg") || "bin";
          if (mimeType.startsWith("image/") && bytes.length > 2 * 1024 * 1024) throw new TRPCError({ code: "BAD_REQUEST", message: "Each image must be 2 MB or smaller." });
          const uploaded = await storagePut(`places/${input.googlePlaceId}/contributions/${contribution.id}-${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`, bytes, mimeType);
          await db.insert(placeContributionMedia).values({ contributionId: contribution.id, submittedByUserId: ctx.user.id, mediaType, storageKey: uploaded.key, url: uploaded.url, caption: media.caption || null, status: "published" });
          }
        }
        return { success: true, message: input.media ? "Votre avis et son média sont publiés sur cette fiche." : "Votre avis est publié sur cette fiche." };
      }),
    submitMedia: protectedProcedure
      .input(
        z.object({
          facilityId: z.number().int().positive(),
          dataUrl: z.string().min(32),
          caption: z.string().trim().max(280).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Base de données indisponible." });
        await assertFacilityExists(db, input.facilityId);
        const { mimeType, bytes } = toBase64Payload(input.dataUrl);
        const mediaType = mimeType.startsWith("video/") ? "video" : "image";
        if (!mimeType.startsWith("image/") && !mimeType.startsWith("video/")) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Seuls les images et les vidéos sont acceptés." });
        }
        const extension = mimeType.split("/")[1]?.replace("jpeg", "jpg") || "bin";
        const uploaded = await storagePut(
          `facilities/${input.facilityId}/contributions/${ctx.user.id}-${Date.now()}.${extension}`,
          bytes,
          mimeType
        );
        await db.insert(facilityMedia).values({
          facilityId: input.facilityId,
          submittedByUserId: ctx.user.id,
          mediaType,
          storageKey: uploaded.key,
          url: uploaded.url,
          caption: input.caption || null,
          status: "published",
        });
        return { success: true, message: "Votre média est publié." };
      }),
    suggestEdit: protectedProcedure
      .input(
        z.object({
          facilityId: z.number().int().positive(),
          fieldName: z.enum(["name", "address", "phone", "website", "hours", "category", "other"]),
          proposedValue: z.string().trim().min(2).max(2000),
          message: z.string().trim().max(1500).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Base de données indisponible." });
        await assertFacilityExists(db, input.facilityId);
        await db.insert(facilitySuggestions).values({
          facilityId: input.facilityId,
          userId: ctx.user.id,
          fieldName: input.fieldName,
          proposedValue: input.proposedValue,
          message: input.message || null,
        });
        return { success: true, message: "Votre suggestion a été enregistrée." };
      }),
  }),
  admin: router({
    syncRuns: adminProcedure.query(() => getLatestSyncRuns()),
    runFacilitySync: adminProcedure.mutation(async ({ ctx }) => { const result = await runFacilityDiscoverySync(); await writeAuditLog({ actorUserId: ctx.user.id, action: "facility_sync.manual_run", entityType: "sync_run", entityId: result.runId, metadata: { discoveredCount: result.discoveredCount, searchedAreas: result.searchedAreas } }); return result; }),
    clinicalSnapshot: adminProcedure.query(() => getAdminClinicalSnapshot()),
    careRequests: adminProcedure.query(() => listAdminCareRequests()),
    auditLogs: adminProcedure.query(() => listRecentAuditLogs()),
    updateCareRequestStatus: adminProcedure
      .input(z.object({ requestId: z.number().int().positive(), status: z.enum(["submitted", "accepted", "scheduled", "in_progress", "completed", "cancelled", "rejected"]), message: z.string().trim().max(600).optional() }))
      .mutation(({ ctx, input }) => updateCareRequestStatus(ctx.user.id, input.requestId, input.status, input.message)),
    createAppointment: adminProcedure
      .input(z.object({ requestId: z.number().int().positive(), scheduledAt: z.coerce.date(), mode: z.enum(["onsite", "remote"]), note: z.string().trim().max(600).optional() }))
      .mutation(({ ctx, input }) => createAppointment(ctx.user.id, input)),
    createFacility: adminProcedure
      .input(z.object({ name: z.string().trim().min(3).max(255), address: z.string().trim().min(5).max(1000), city: z.string().trim().max(120).optional(), district: z.string().trim().max(120).optional(), region: z.string().trim().max(120).optional(), category: categorySchema, latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), phones: z.array(z.string().trim().max(40)).max(5).optional(), website: z.string().url().max(500).optional(), sourceUrl: z.string().url().max(1000), verificationStatus: z.enum(["unverified", "verified", "claimed"]).default("unverified") }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Base de données indisponible." });
        const normalizedName = input.name.toLocaleLowerCase("fr-CM").normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").trim();
        const result = await db.insert(facilities).values({ name: input.name, normalizedName, slug: createFacilitySlug(input.name, input.city), category: input.category, categoryLabel: liveCategoryLabels[input.category], address: input.address, city: input.city || null, district: input.district || null, region: input.region || null, latitude: String(input.latitude), longitude: String(input.longitude), phones: input.phones || [], website: input.website || null, source: "medisecours", verificationStatus: input.verificationStatus, enrichmentSourceUrl: input.sourceUrl, lastSyncedAt: new Date() });
        await writeAuditLog({ actorUserId: ctx.user.id, action: "facility.created", entityType: "facility", entityId: Number(result[0].insertId), metadata: { source: "medisecours", verificationStatus: input.verificationStatus } });
        return { success: true, facilityId: Number(result[0].insertId) } as const;
      }),
    updateFacilityVerification: adminProcedure
      .input(z.object({ facilityId: z.number().int().positive(), verificationStatus: z.enum(["unverified", "verified", "claimed"]) }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Base de données indisponible." });
        await db.update(facilities).set({ verificationStatus: input.verificationStatus, updatedAt: new Date() }).where(eq(facilities.id, input.facilityId));
        await writeAuditLog({ actorUserId: ctx.user.id, action: "facility.verification_changed", entityType: "facility", entityId: input.facilityId, metadata: { verificationStatus: input.verificationStatus } });
        return { success: true } as const;
      }),
    facilityAbout: adminProcedure
      .input(z.object({ facilityId: z.number().int().positive() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const facility = (await db.select({ id: facilities.id, name: facilities.name, about: facilities.about, aboutStatus: facilities.aboutStatus, aboutApprovedAt: facilities.aboutApprovedAt }).from(facilities).where(eq(facilities.id, input.facilityId)).limit(1))[0];
        if (!facility) throw new TRPCError({ code: "NOT_FOUND", message: "Établissement introuvable." });
        return facility;
      }),
    facilityEnrichment: adminProcedure
      .input(z.object({ facilityId: z.number().int().positive() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const facility = (await db.select({ id: facilities.id, name: facilities.name, services: facilities.services, infrastructure: facilities.infrastructure, benefits: facilities.benefits, updates: facilities.updates, officialVideoUrl: facilities.officialVideoUrl, enrichmentSourceUrl: facilities.enrichmentSourceUrl, enrichmentUpdatedAt: facilities.enrichmentUpdatedAt }).from(facilities).where(eq(facilities.id, input.facilityId)).limit(1))[0];
        if (!facility) throw new TRPCError({ code: "NOT_FOUND", message: "Établissement introuvable." });
        return facility;
      }),
    publishFacilityAbout: adminProcedure
      .input(z.object({ facilityId: z.number().int().positive(), about: z.string().trim().min(20).max(5000) }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await assertFacilityExists(db, input.facilityId);
        await db.update(facilities).set({ about: input.about, aboutStatus: "published", aboutApprovedAt: new Date(), aboutApprovedByUserId: ctx.user.id }).where(eq(facilities.id, input.facilityId));
        return { success: true, about: input.about };
      }),
    publishFacilityEnrichment: adminProcedure
      .input(z.object({
        facilityId: z.number().int().positive(),
        services: z.array(z.string().trim().min(2).max(120)).max(40),
        infrastructure: z.array(z.string().trim().min(2).max(120)).max(40),
        benefits: z.array(z.string().trim().min(2).max(120)).max(40),
        updates: z.array(z.object({ title: z.string().trim().min(3).max(160), content: z.string().trim().max(1200).optional(), url: z.string().url().max(1000).optional(), publishedAt: z.string().datetime().optional() })).max(20),
        officialVideoUrl: z.string().url().max(1000).nullable(),
        sourceUrl: z.string().url().max(1000),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await assertFacilityExists(db, input.facilityId);
        await db.update(facilities).set({ services: input.services, infrastructure: input.infrastructure, benefits: input.benefits, updates: input.updates, officialVideoUrl: input.officialVideoUrl, enrichmentSourceUrl: input.sourceUrl, enrichmentUpdatedAt: new Date() }).where(eq(facilities.id, input.facilityId));
        return { success: true };
      }),
    pendingReviews: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(facilityReviews).where(eq(facilityReviews.status, "pending"));
    }),
    publishReview: adminProcedure
      .input(z.object({ id: z.number().int().positive(), publish: z.boolean() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const review = (await db.select().from(facilityReviews).where(eq(facilityReviews.id, input.id)).limit(1))[0];
        if (!review) throw new TRPCError({ code: "NOT_FOUND", message: "Avis introuvable." });
        await db
          .update(facilityReviews)
          .set({ status: input.publish ? "published" : "hidden" })
          .where(eq(facilityReviews.id, input.id));
        const summary = await refreshMedisecoursRating(review.facilityId);
        return { success: true, summary };
      }),
    pendingMedia: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(facilityMedia).where(eq(facilityMedia.status, "pending"));
    }),
    publishMedia: adminProcedure
      .input(z.object({ id: z.number().int().positive(), publish: z.boolean() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db
          .update(facilityMedia)
          .set({ status: input.publish ? "published" : "rejected" })
          .where(eq(facilityMedia.id, input.id));
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
