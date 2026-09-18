import {
  boolean,
  decimal,
  foreignKey,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const careRequestStatus = ["submitted", "accepted", "scheduled", "in_progress", "completed", "cancelled", "rejected"] as const;
export type CareRequestStatus = (typeof careRequestStatus)[number];

export const careRequestUrgency = ["routine", "soon", "urgent", "emergency"] as const;
export type CareRequestUrgency = (typeof careRequestUrgency)[number];

export const careRequests = mysqlTable(
  "care_requests",
  {
    id: int("id").autoincrement().primaryKey(),
    patientUserId: int("patientUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
    facilityId: int("facilityId").references(() => facilities.id, { onDelete: "set null" }),
    googlePlaceId: varchar("googlePlaceId", { length: 255 }),
    requestType: mysqlEnum("requestType", ["orientation", "appointment", "admission"]).notNull().default("orientation"),
    urgency: mysqlEnum("urgency", careRequestUrgency).notNull().default("routine"),
    status: mysqlEnum("status", careRequestStatus).notNull().default("submitted"),
    patientNote: text("patientNote"),
    preferredAt: timestamp("preferredAt"),
    consentAt: timestamp("consentAt").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("care_requests_patient_status_idx").on(table.patientUserId, table.status, table.createdAt),
    index("care_requests_facility_status_idx").on(table.facilityId, table.status, table.createdAt),
  ]
);

export const careEpisodes = mysqlTable(
  "care_episodes",
  {
    id: int("id").autoincrement().primaryKey(),
    patientUserId: int("patientUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
    careRequestId: int("careRequestId").references(() => careRequests.id, { onDelete: "set null" }),
    facilityId: int("facilityId").references(() => facilities.id, { onDelete: "set null" }),
    status: mysqlEnum("status", ["open", "in_progress", "closed"]).notNull().default("open"),
    label: varchar("label", { length: 160 }).notNull(),
    startedAt: timestamp("startedAt").defaultNow().notNull(),
    closedAt: timestamp("closedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("care_episodes_patient_status_idx").on(table.patientUserId, table.status, table.updatedAt),
    index("care_episodes_request_idx").on(table.careRequestId),
  ]
);

export const careEvents = mysqlTable(
  "care_events",
  {
    id: int("id").autoincrement().primaryKey(),
    episodeId: int("episodeId").notNull().references(() => careEpisodes.id, { onDelete: "cascade" }),
    actorUserId: int("actorUserId").references(() => users.id, { onDelete: "set null" }),
    eventType: mysqlEnum("eventType", ["created", "status_changed", "appointment", "check_in", "message", "note", "closed"]).notNull(),
    title: varchar("title", { length: 180 }).notNull(),
    description: text("description"),
    patientVisible: boolean("patientVisible").notNull().default(true),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("care_events_episode_created_idx").on(table.episodeId, table.createdAt)]
);

export const appointments = mysqlTable(
  "appointments",
  {
    id: int("id").autoincrement().primaryKey(),
    careRequestId: int("careRequestId").notNull().references(() => careRequests.id, { onDelete: "cascade" }),
    patientUserId: int("patientUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
    facilityId: int("facilityId").references(() => facilities.id, { onDelete: "set null" }),
    scheduledAt: timestamp("scheduledAt").notNull(),
    status: mysqlEnum("status", ["requested", "confirmed", "completed", "cancelled", "no_show"]).notNull().default("requested"),
    mode: mysqlEnum("mode", ["onsite", "remote"]).notNull().default("onsite"),
    note: text("note"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("appointments_patient_date_idx").on(table.patientUserId, table.scheduledAt),
    index("appointments_facility_date_idx").on(table.facilityId, table.scheduledAt),
  ]
);

export const patientNotifications = mysqlTable(
  "patient_notifications",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 180 }).notNull(),
    body: text("body").notNull(),
    kind: mysqlEnum("kind", ["care", "appointment", "system"]).notNull().default("system"),
    readAt: timestamp("readAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("patient_notifications_user_read_idx").on(table.userId, table.readAt, table.createdAt)]
);

export const auditLogs = mysqlTable(
  "audit_logs",
  {
    id: int("id").autoincrement().primaryKey(),
    actorUserId: int("actorUserId").references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 120 }).notNull(),
    entityType: varchar("entityType", { length: 80 }).notNull(),
    entityId: int("entityId"),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("audit_logs_created_idx").on(table.createdAt), index("audit_logs_entity_idx").on(table.entityType, table.entityId)]
);

export const userPlaceLists = mysqlTable(
  "user_place_lists",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    facilityId: int("facilityId").references(() => facilities.id, { onDelete: "cascade" }),
    googlePlaceId: varchar("googlePlaceId", { length: 255 }),
    targetKey: varchar("targetKey", { length: 300 }).notNull(),
    listType: mysqlEnum("listType", ["saved", "wishlist"]).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("user_place_lists_unique_target").on(table.userId, table.listType, table.targetKey),
    index("user_place_lists_user_type_created_idx").on(table.userId, table.listType, table.createdAt),
  ]
);

export const userSearchHistory = mysqlTable(
  "user_search_history",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    searchText: varchar("searchText", { length: 120 }).notNull(),
    category: varchar("category", { length: 80 }),
    source: mysqlEnum("source", ["map", "sidebar"]).default("map").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("user_search_history_user_created_idx").on(table.userId, table.createdAt)]
);

export const userProfiles = mysqlTable(
  "user_profiles",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    phone: varchar("phone", { length: 40 }),
    city: varchar("city", { length: 120 }),
    preferredCategories: json("preferredCategories").$type<string[]>(),
    communicationConsent: boolean("communicationConsent").default(false).notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    foreignKey({ columns: [table.userId], foreignColumns: [users.id], name: "uprofile_user_fk" }).onDelete("cascade"),
    uniqueIndex("user_profiles_user_unique").on(table.userId),
  ]
);

export const userPlaceCollections = mysqlTable(
  "user_place_collections",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    name: varchar("name", { length: 80 }).notNull(),
    color: varchar("color", { length: 12 }).notNull().default("#0B8A96"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    foreignKey({ columns: [table.userId], foreignColumns: [users.id], name: "upc_user_fk" }).onDelete("cascade"),
    uniqueIndex("user_place_collections_user_name_unique").on(table.userId, table.name),
    index("user_place_collections_user_created_idx").on(table.userId, table.createdAt),
  ]
);

export const userPlaceCollectionItems = mysqlTable(
  "user_place_collection_items",
  {
    id: int("id").autoincrement().primaryKey(),
    collectionId: int("collectionId").notNull(),
    facilityId: int("facilityId"),
    googlePlaceId: varchar("googlePlaceId", { length: 255 }),
    targetKey: varchar("targetKey", { length: 300 }).notNull(),
    privateNote: text("privateNote"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    foreignKey({ columns: [table.collectionId], foreignColumns: [userPlaceCollections.id], name: "upci_collection_fk" }).onDelete("cascade"),
    foreignKey({ columns: [table.facilityId], foreignColumns: [facilities.id], name: "upci_facility_fk" }).onDelete("cascade"),
    uniqueIndex("user_place_collection_items_unique_target").on(table.collectionId, table.targetKey),
    index("user_place_collection_items_collection_created_idx").on(table.collectionId, table.createdAt),
  ]
);

export const userRouteHistory = mysqlTable(
  "user_route_history",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    facilityId: int("facilityId"),
    googlePlaceId: varchar("googlePlaceId", { length: 255 }),
    targetKey: varchar("targetKey", { length: 300 }).notNull(),
    travelMode: mysqlEnum("travelMode", ["DRIVING", "WALKING", "BICYCLING"]).notNull().default("DRIVING"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    foreignKey({ columns: [table.userId], foreignColumns: [users.id], name: "urh_user_fk" }).onDelete("cascade"),
    foreignKey({ columns: [table.facilityId], foreignColumns: [facilities.id], name: "urh_facility_fk" }).onDelete("cascade"),
    index("user_route_history_user_created_idx").on(table.userId, table.createdAt),
  ]
);

export const placeContributions = mysqlTable(
  "place_contributions",
  {
    id: int("id").autoincrement().primaryKey(),
    googlePlaceId: varchar("googlePlaceId", { length: 255 }).notNull(),
    userId: int("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rating: int("rating").notNull(),
    title: varchar("title", { length: 120 }),
    content: text("content").notNull(),
    status: mysqlEnum("status", ["published", "hidden"]).default("published").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("place_contributions_one_per_user").on(table.googlePlaceId, table.userId),
    index("place_contributions_place_status_idx").on(table.googlePlaceId, table.status, table.createdAt),
  ]
);

export const placeContributionMedia = mysqlTable(
  "place_contribution_media",
  {
    id: int("id").autoincrement().primaryKey(),
    contributionId: int("contributionId").notNull(),
    submittedByUserId: int("submittedByUserId"),
    mediaType: mysqlEnum("mediaType", ["image", "video"]).notNull(),
    storageKey: varchar("storageKey", { length: 700 }).notNull().unique(),
    url: varchar("url", { length: 1000 }).notNull(),
    caption: varchar("caption", { length: 280 }),
    status: mysqlEnum("status", ["published", "hidden"]).default("published").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    foreignKey({ columns: [table.contributionId], foreignColumns: [placeContributions.id], name: "pcmedia_contribution_fk" }).onDelete("cascade"),
    foreignKey({ columns: [table.submittedByUserId], foreignColumns: [users.id], name: "pcmedia_submitter_fk" }).onDelete("set null"),
    index("place_contribution_media_contribution_status_idx").on(table.contributionId, table.status),
  ]
);

export const facilityCategories = [
  "hospital",
  "clinic",
  "health_center",
  "pharmacy",
  "laboratory",
  "maternity",
  "specialized_center",
  "dental_center",
  "medical_office",
  "other",
] as const;

export type FacilityCategory = (typeof facilityCategories)[number];

export type OpeningHoursEntry = {
  day: string;
  open?: string;
  close?: string;
  closed?: boolean;
};

export type FacilityPhoto = {
  url: string;
  storageKey?: string;
  alt: string;
  source: "medisecours" | "verified_establishment";
  mediaType: "image" | "video";
};

export const facilities = mysqlTable(
  "facilities",
  {
    id: int("id").autoincrement().primaryKey(),
    googlePlaceId: varchar("googlePlaceId", { length: 255 }),
    slug: varchar("slug", { length: 280 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    normalizedName: varchar("normalizedName", { length: 255 }).notNull(),
    category: mysqlEnum("category", facilityCategories).notNull(),
    categoryLabel: varchar("categoryLabel", { length: 120 }),
    address: text("address").notNull(),
    city: varchar("city", { length: 120 }),
    district: varchar("district", { length: 120 }),
    region: varchar("region", { length: 120 }),
    latitude: decimal("latitude", { precision: 10, scale: 7 }).notNull(),
    longitude: decimal("longitude", { precision: 10, scale: 7 }).notNull(),
    phones: json("phones").$type<string[]>(),
    website: varchar("website", { length: 500 }),
    openingHours: json("openingHours").$type<OpeningHoursEntry[]>(),
    photos: json("photos").$type<FacilityPhoto[]>(),
    about: text("about"),
    services: json("services").$type<string[]>(),
    infrastructure: json("infrastructure").$type<string[]>(),
    benefits: json("benefits").$type<string[]>(),
    updates: json("updates").$type<Array<{ title: string; content?: string; url?: string; publishedAt?: string }>>(),
    officialVideoUrl: varchar("officialVideoUrl", { length: 1000 }),
    enrichmentSourceUrl: varchar("enrichmentSourceUrl", { length: 1000 }),
    enrichmentUpdatedAt: timestamp("enrichmentUpdatedAt"),
    aboutStatus: mysqlEnum("aboutStatus", ["draft", "published"]).default("draft").notNull(),
    aboutApprovedAt: timestamp("aboutApprovedAt"),
    aboutApprovedByUserId: int("aboutApprovedByUserId").references(() => users.id, { onDelete: "set null" }),
    googleRating: decimal("googleRating", { precision: 3, scale: 2 }),
    googleRatingCount: int("googleRatingCount").default(0).notNull(),
    medisecoursRating: decimal("medisecoursRating", { precision: 3, scale: 2 }),
    medisecoursRatingCount: int("medisecoursRatingCount").default(0).notNull(),
    isOpenNow: boolean("isOpenNow"),
    verificationStatus: mysqlEnum("verificationStatus", [
      "unverified",
      "verified",
      "claimed",
    ]).default("unverified").notNull(),
    source: mysqlEnum("source", ["google_places", "medisecours", "mixed"])
      .default("google_places")
      .notNull(),
    lastSyncedAt: timestamp("lastSyncedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("facilities_google_place_id_unique").on(table.googlePlaceId),
    index("facilities_category_idx").on(table.category),
    index("facilities_city_idx").on(table.city),
    index("facilities_coordinates_idx").on(table.latitude, table.longitude),
    index("facilities_name_idx").on(table.normalizedName),
  ]
);

export const facilityMedia = mysqlTable(
  "facility_media",
  {
    id: int("id").autoincrement().primaryKey(),
    facilityId: int("facilityId")
      .notNull()
      .references(() => facilities.id, { onDelete: "cascade" }),
    submittedByUserId: int("submittedByUserId").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewId: int("reviewId").references(() => facilityReviews.id, { onDelete: "set null" }),
    mediaType: mysqlEnum("mediaType", ["image", "video"]).notNull(),
    storageKey: varchar("storageKey", { length: 700 }).notNull().unique(),
    url: varchar("url", { length: 1000 }).notNull(),
    caption: varchar("caption", { length: 280 }),
    status: mysqlEnum("status", ["pending", "published", "rejected"])
      .default("pending")
      .notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("facility_media_facility_status_idx").on(table.facilityId, table.status),
    index("facility_media_review_idx").on(table.reviewId),
  ]
);

export const facilityReviews = mysqlTable(
  "facility_reviews",
  {
    id: int("id").autoincrement().primaryKey(),
    facilityId: int("facilityId")
      .notNull()
      .references(() => facilities.id, { onDelete: "cascade" }),
    userId: int("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rating: int("rating").notNull(),
    title: varchar("title", { length: 120 }),
    content: text("content").notNull(),
    status: mysqlEnum("status", ["pending", "published", "hidden"])
      .default("pending")
      .notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("facility_reviews_one_per_user").on(table.facilityId, table.userId),
    index("facility_reviews_facility_status_idx").on(table.facilityId, table.status),
  ]
);

export const facilitySuggestions = mysqlTable(
  "facility_suggestions",
  {
    id: int("id").autoincrement().primaryKey(),
    facilityId: int("facilityId")
      .notNull()
      .references(() => facilities.id, { onDelete: "cascade" }),
    userId: int("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fieldName: varchar("fieldName", { length: 80 }).notNull(),
    proposedValue: text("proposedValue").notNull(),
    message: text("message"),
    status: mysqlEnum("status", ["pending", "accepted", "rejected"])
      .default("pending")
      .notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("facility_suggestions_facility_status_idx").on(table.facilityId, table.status)]
);

export const syncRuns = mysqlTable(
  "sync_runs",
  {
    id: int("id").autoincrement().primaryKey(),
    status: mysqlEnum("status", ["running", "success", "partial", "failed"])
      .default("running")
      .notNull(),
    searchedAreas: int("searchedAreas").default(0).notNull(),
    discoveredCount: int("discoveredCount").default(0).notNull(),
    updatedCount: int("updatedCount").default(0).notNull(),
    skippedCount: int("skippedCount").default(0).notNull(),
    errorMessage: text("errorMessage"),
    startedAt: timestamp("startedAt").defaultNow().notNull(),
    completedAt: timestamp("completedAt"),
  },
  table => [index("sync_runs_status_started_idx").on(table.status, table.startedAt)]
);

export const placeIndex = mysqlTable(
  "place_index",
  {
    id: int("id").autoincrement().primaryKey(),
    googlePlaceId: varchar("googlePlaceId", { length: 255 }).notNull().unique(),
    firstSeenAt: timestamp("firstSeenAt").defaultNow().notNull(),
    lastSeenAt: timestamp("lastSeenAt").defaultNow().onUpdateNow().notNull(),
    lastSyncRunId: int("lastSyncRunId").references(() => syncRuns.id, { onDelete: "set null" }),
  },
  table => [index("place_index_last_seen_idx").on(table.lastSeenAt)]
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Facility = typeof facilities.$inferSelect;
