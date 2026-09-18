import { and, desc, eq, inArray, isNull, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  facilities,
  facilityMedia,
  facilityReviews,
  facilitySuggestions,
  placeContributionMedia,
  placeContributions,
  type FacilityCategory,
  type InsertUser,
  syncRuns,
  userPlaceCollectionItems,
  userPlaceCollections,
  userPlaceLists,
  userProfiles,
  userRouteHistory,
  userSearchHistory,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { summarizeRatings } from "./services/reviewRatings";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  (["name", "email", "loginMethod"] as const).forEach(field => {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  });
  values.lastSignedIn = user.lastSignedIn ?? new Date();
  updateSet.lastSignedIn = values.lastSignedIn;
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(users).where(eq(users.openId, openId)).limit(1))[0];
}

export async function getUserProfile(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1))[0];
}

export async function upsertUserProfile(userId: number, input: { phone: string | null; city: string | null; preferredCategories: string[]; communicationConsent: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(userProfiles).values({ userId, ...input }).onDuplicateKeyUpdate({ set: { ...input, updatedAt: new Date() } });
  return getUserProfile(userId);
}

type PersonalPlaceTarget = { facilityId?: number; googlePlaceId?: string };

function personalTargetKey(target: PersonalPlaceTarget) {
  if (target.facilityId) return `facility:${target.facilityId}`;
  if (target.googlePlaceId) return `place:${target.googlePlaceId}`;
  throw new Error("A facilityId or googlePlaceId is required.");
}

export async function toggleUserPlaceList(userId: number, listType: "saved" | "wishlist", target: PersonalPlaceTarget) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const targetKey = personalTargetKey(target);
  const existing = (await db.select({ id: userPlaceLists.id }).from(userPlaceLists).where(and(eq(userPlaceLists.userId, userId), eq(userPlaceLists.listType, listType), eq(userPlaceLists.targetKey, targetKey))).limit(1))[0];
  if (existing) {
    await db.delete(userPlaceLists).where(eq(userPlaceLists.id, existing.id));
    return { active: false, targetKey };
  }
  await db.insert(userPlaceLists).values({ userId, listType, targetKey, facilityId: target.facilityId ?? null, googlePlaceId: target.googlePlaceId ?? null });
  return { active: true, targetKey };
}

export async function listUserPlaceLists(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ item: userPlaceLists, facility: facilities })
    .from(userPlaceLists)
    .leftJoin(facilities, eq(userPlaceLists.facilityId, facilities.id))
    .where(eq(userPlaceLists.userId, userId))
    .orderBy(desc(userPlaceLists.createdAt));
}

export async function recordUserSearch(userId: number, input: { searchText: string; category?: string; source?: "map" | "sidebar" }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const searchText = input.searchText.trim();
  if (!searchText) return;
  const category = input.category || null;
  const categoryClause = category ? eq(userSearchHistory.category, category) : isNull(userSearchHistory.category);
  const duplicates = await db
    .select({ id: userSearchHistory.id })
    .from(userSearchHistory)
    .where(and(eq(userSearchHistory.userId, userId), eq(userSearchHistory.searchText, searchText), categoryClause));
  if (duplicates.length) await db.delete(userSearchHistory).where(inArray(userSearchHistory.id, duplicates.map(entry => entry.id)));
  await db.insert(userSearchHistory).values({ userId, searchText, category, source: input.source ?? "map" });
}

export function deduplicateUserSearchHistory<T extends { searchText: string; category: string | null }>(rows: T[], limit: number) {
  const seen: Record<string, true> = {};
  return rows.filter(entry => {
    const key = `${entry.searchText.trim().toLocaleLowerCase("fr-CM")}|${entry.category || ""}`;
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  }).slice(0, limit);
}

export async function listUserSearchHistory(userId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(userSearchHistory).where(eq(userSearchHistory.userId, userId)).orderBy(desc(userSearchHistory.createdAt)).limit(limit * 5);
  return deduplicateUserSearchHistory(rows, limit);
}

type PersonalCollectionTarget = { facilityId?: number; googlePlaceId?: string };

async function getOwnedCollection(userId: number, collectionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const collection = (await db.select().from(userPlaceCollections).where(and(eq(userPlaceCollections.id, collectionId), eq(userPlaceCollections.userId, userId))).limit(1))[0];
  if (!collection) throw new Error("Collection inaccessible.");
  return { db, collection };
}

export async function createUserPlaceCollection(userId: number, input: { name: string; color?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.insert(userPlaceCollections).values({ userId, name: input.name.trim(), color: input.color || "#0B8A96" });
  const id = Number(result[0].insertId);
  return (await db.select().from(userPlaceCollections).where(and(eq(userPlaceCollections.id, id), eq(userPlaceCollections.userId, userId))).limit(1))[0];
}

export async function deleteUserPlaceCollection(userId: number, collectionId: number) {
  const { db } = await getOwnedCollection(userId, collectionId);
  await db.delete(userPlaceCollections).where(and(eq(userPlaceCollections.id, collectionId), eq(userPlaceCollections.userId, userId)));
  return { deleted: true };
}

export async function addPlaceToUserCollection(userId: number, collectionId: number, target: PersonalCollectionTarget) {
  const { db } = await getOwnedCollection(userId, collectionId);
  const targetKey = personalTargetKey(target);
  const existing = (await db.select().from(userPlaceCollectionItems).where(and(eq(userPlaceCollectionItems.collectionId, collectionId), eq(userPlaceCollectionItems.targetKey, targetKey))).limit(1))[0];
  if (existing) return { added: false, item: existing };
  const result = await db.insert(userPlaceCollectionItems).values({ collectionId, targetKey, facilityId: target.facilityId ?? null, googlePlaceId: target.googlePlaceId ?? null });
  const id = Number(result[0].insertId);
  const item = (await db.select().from(userPlaceCollectionItems).where(eq(userPlaceCollectionItems.id, id)).limit(1))[0];
  return { added: true, item };
}

export async function updateUserCollectionItemNote(userId: number, itemId: number, privateNote: string | null) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const item = (await db
    .select({ id: userPlaceCollectionItems.id })
    .from(userPlaceCollectionItems)
    .innerJoin(userPlaceCollections, eq(userPlaceCollectionItems.collectionId, userPlaceCollections.id))
    .where(and(eq(userPlaceCollectionItems.id, itemId), eq(userPlaceCollections.userId, userId)))
    .limit(1))[0];
  if (!item) throw new Error("Élément de collection inaccessible.");
  await db.update(userPlaceCollectionItems).set({ privateNote: privateNote?.trim() || null }).where(eq(userPlaceCollectionItems.id, itemId));
  return { updated: true };
}

export async function removeUserCollectionItem(userId: number, itemId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const item = (await db
    .select({ id: userPlaceCollectionItems.id })
    .from(userPlaceCollectionItems)
    .innerJoin(userPlaceCollections, eq(userPlaceCollectionItems.collectionId, userPlaceCollections.id))
    .where(and(eq(userPlaceCollectionItems.id, itemId), eq(userPlaceCollections.userId, userId)))
    .limit(1))[0];
  if (!item) throw new Error("Élément de collection inaccessible.");
  await db.delete(userPlaceCollectionItems).where(eq(userPlaceCollectionItems.id, itemId));
  return { removed: true };
}

export async function removeUserCollectionItems(userId: number, itemIds: number[]) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const uniqueItemIds = Array.from(new Set(itemIds));
  const owned = await db
    .select({ id: userPlaceCollectionItems.id })
    .from(userPlaceCollectionItems)
    .innerJoin(userPlaceCollections, eq(userPlaceCollectionItems.collectionId, userPlaceCollections.id))
    .where(and(inArray(userPlaceCollectionItems.id, uniqueItemIds), eq(userPlaceCollections.userId, userId)));
  if (owned.length !== uniqueItemIds.length) throw new Error("Élément de collection inaccessible.");
  await db.delete(userPlaceCollectionItems).where(inArray(userPlaceCollectionItems.id, uniqueItemIds));
  return { removedCount: uniqueItemIds.length };
}

export async function listUserPlaceCollections(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const [collections, entries] = await Promise.all([
    db.select().from(userPlaceCollections).where(eq(userPlaceCollections.userId, userId)).orderBy(desc(userPlaceCollections.updatedAt)),
    db
      .select({ item: userPlaceCollectionItems, collectionId: userPlaceCollections.id, facility: facilities })
      .from(userPlaceCollectionItems)
      .innerJoin(userPlaceCollections, eq(userPlaceCollectionItems.collectionId, userPlaceCollections.id))
      .leftJoin(facilities, eq(userPlaceCollectionItems.facilityId, facilities.id))
      .where(eq(userPlaceCollections.userId, userId))
      .orderBy(desc(userPlaceCollectionItems.updatedAt)),
  ]);
  return collections.map(collection => ({ collection, items: entries.filter(entry => entry.collectionId === collection.id).map(({ collectionId: _collectionId, ...entry }) => entry) }));
}

export async function recordUserRoute(userId: number, input: PersonalCollectionTarget & { travelMode: "DRIVING" | "WALKING" | "BICYCLING" }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const targetKey = personalTargetKey(input);
  await db.insert(userRouteHistory).values({ userId, targetKey, facilityId: input.facilityId ?? null, googlePlaceId: input.googlePlaceId ?? null, travelMode: input.travelMode });
  return { recorded: true, targetKey };
}

export async function listUserRouteHistory(userId: number, limit = 12) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ route: userRouteHistory, facility: facilities })
    .from(userRouteHistory)
    .leftJoin(facilities, eq(userRouteHistory.facilityId, facilities.id))
    .where(eq(userRouteHistory.userId, userId))
    .orderBy(desc(userRouteHistory.createdAt))
    .limit(limit);
}

export async function getPlaceContributions(googlePlaceId: string) {
  const db = await getDb();
  if (!db) return { contributions: [], media: [] };
  const [contributions, media] = await Promise.all([
    db
      .select({ contribution: placeContributions, author: users.name })
      .from(placeContributions)
      .leftJoin(users, eq(placeContributions.userId, users.id))
      .where(and(eq(placeContributions.googlePlaceId, googlePlaceId), eq(placeContributions.status, "published")))
      .orderBy(desc(placeContributions.createdAt)),
    db
      .select({ media: placeContributionMedia, contributionId: placeContributions.id })
      .from(placeContributionMedia)
      .innerJoin(placeContributions, eq(placeContributionMedia.contributionId, placeContributions.id))
      .where(and(eq(placeContributions.googlePlaceId, googlePlaceId), eq(placeContributionMedia.status, "published"))),
  ]);
  return { contributions, media };
}

export type FacilitySearchInput = {
  query?: string;
  category?: FacilityCategory | "all";
  bounds?: { north: number; south: number; east: number; west: number };
  limit?: number;
};

export function buildFacilitySearchClauses(input: FacilitySearchInput) {
  const clauses = [];
  const query = input.query?.trim().toLowerCase();
  if (query) {
    const term = `%${query}%`;
    clauses.push(
      or(
        like(sql`lower(${facilities.name})`, term),
        like(sql`lower(${facilities.city})`, term),
        like(sql`lower(${facilities.district})`, term),
        like(sql`lower(${facilities.category})`, term)
      )
    );
  }
  if (input.category && input.category !== "all") clauses.push(eq(facilities.category, input.category));
  if (input.bounds) {
    clauses.push(sql`${facilities.latitude} between ${input.bounds.south} and ${input.bounds.north}`);
    clauses.push(sql`${facilities.longitude} between ${input.bounds.west} and ${input.bounds.east}`);
  }
  return clauses;
}

export async function searchFacilities(input: FacilitySearchInput) {
  const db = await getDb();
  if (!db) return [];
  const clauses = buildFacilitySearchClauses(input);
  return db
    .select()
    .from(facilities)
    .where(clauses.length ? and(...clauses) : undefined)
    .orderBy(desc(facilities.verificationStatus), desc(facilities.googleRating))
    .limit(Math.min(input.limit ?? 60, 120));
}

export async function getFacilityById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const facility = (await db.select().from(facilities).where(eq(facilities.id, id)).limit(1))[0];
  if (!facility) return undefined;
  const [media, reviews] = await Promise.all([
    db
      .select()
      .from(facilityMedia)
      .where(and(eq(facilityMedia.facilityId, id), eq(facilityMedia.status, "published")))
      .orderBy(desc(facilityMedia.createdAt)),
    db
      .select({ review: facilityReviews, author: users.name })
      .from(facilityReviews)
      .leftJoin(users, eq(facilityReviews.userId, users.id))
      .where(and(eq(facilityReviews.facilityId, id), eq(facilityReviews.status, "published")))
      .orderBy(desc(facilityReviews.createdAt)),
  ]);
  return { facility, media, reviews };
}

export async function listFacilitySuggestions(facilityId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(facilitySuggestions)
    .where(and(eq(facilitySuggestions.facilityId, facilityId), eq(facilitySuggestions.status, "pending")))
    .orderBy(desc(facilitySuggestions.createdAt));
}

export async function getLatestSyncRuns(limit = 10) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(syncRuns).orderBy(desc(syncRuns.startedAt)).limit(limit);
}

export async function refreshMedisecoursRating(facilityId: number) {
  const db = await getDb();
  if (!db) return { average: null, count: 0 };
  const rows = await db
    .select({ rating: facilityReviews.rating })
    .from(facilityReviews)
    .where(and(eq(facilityReviews.facilityId, facilityId), eq(facilityReviews.status, "published")));
  const summary = summarizeRatings(rows.map(row => row.rating));
  await db
    .update(facilities)
    .set({
      medisecoursRating: summary.average === null ? null : String(summary.average),
      medisecoursRatingCount: summary.count,
    })
    .where(eq(facilities.id, facilityId));
  return summary;
}
