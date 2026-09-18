import { and, desc, eq, sql } from "drizzle-orm";
import {
  appointments,
  auditLogs,
  careEpisodes,
  careEvents,
  careRequests,
  facilities,
  patientNotifications,
  users,
  type CareRequestStatus,
  type CareRequestUrgency,
} from "../drizzle/schema";
import { getDb } from "./db";
import { notifyOwner } from "./_core/notification";

export type CreateCareRequestInput = {
  facilityId?: number;
  googlePlaceId?: string;
  requestType: "orientation" | "appointment" | "admission";
  urgency: CareRequestUrgency;
  patientNote?: string;
  preferredAt?: Date;
};

export function buildOwnerCareRequestAlert(requestId: number, input: CreateCareRequestInput) {
  const urgencyLabels: Record<CreateCareRequestInput["urgency"], string> = {
    routine: "Routine",
    soon: "À traiter rapidement",
    urgent: "Urgent",
    emergency: "Urgence",
  };
  const facilityReference = input.facilityId ? `établissement #${input.facilityId}` : input.googlePlaceId ? "établissement Google Maps sélectionné" : "établissement à préciser";
  const urgency = urgencyLabels[input.urgency];
  return {
    title: `${input.urgency === "emergency" ? "ALERTE URGENCE" : "Nouvelle demande de secours"} — demande #${requestId}`,
    content: `Une demande de prise en charge a été créée. Niveau déclaré : ${urgency}. Type : ${input.requestType}. Cible : ${facilityReference}. Consultez l’administration MediSecours pour le suivi.`,
  };
}

export async function writeAuditLog(input: {
  actorUserId?: number;
  action: string;
  entityType: string;
  entityId?: number;
  metadata?: Record<string, unknown>;
}) {
  const db = await getDb();
  if (!db) throw new Error("Base de données indisponible.");
  await db.insert(auditLogs).values({
    actorUserId: input.actorUserId ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    metadata: input.metadata ?? null,
  });
}

export async function createCareRequest(patientUserId: number, input: CreateCareRequestInput, ownerAlertContext?: string) {
  const db = await getDb();
  if (!db) throw new Error("Base de données indisponible.");
  const result = await db.insert(careRequests).values({
    patientUserId,
    facilityId: input.facilityId ?? null,
    googlePlaceId: input.googlePlaceId ?? null,
    requestType: input.requestType,
    urgency: input.urgency,
    patientNote: input.patientNote?.trim() || null,
    preferredAt: input.preferredAt ?? null,
    consentAt: new Date(),
  });
  const requestId = Number(result[0].insertId);
  const episodeResult = await db.insert(careEpisodes).values({
    patientUserId,
    careRequestId: requestId,
    facilityId: input.facilityId ?? null,
    label: input.requestType === "appointment" ? "Demande de rendez-vous" : input.requestType === "admission" ? "Demande de prise en charge" : "Orientation de soins",
    status: "open",
  });
  const episodeId = Number(episodeResult[0].insertId);
  await db.insert(careEvents).values({
    episodeId,
    actorUserId: patientUserId,
    eventType: "created",
    title: "Demande enregistrée",
    description: "Votre demande a été transmise à MediSecours.",
    patientVisible: true,
  });
  await db.insert(patientNotifications).values({
    userId: patientUserId,
    title: "Demande enregistrée",
    body: "Votre demande est visible dans votre suivi patient.",
    kind: "care",
  });
  const ownerAlert = buildOwnerCareRequestAlert(requestId, input);
  const ownerNotificationSent = await notifyOwner({
    ...ownerAlert,
    content: ownerAlertContext ? `${ownerAlert.content} ${ownerAlertContext}` : ownerAlert.content,
  }).catch(error => {
    console.error("[Clinical] Impossible de notifier le propriétaire d’une demande de secours.", error);
    return false;
  });
  await writeAuditLog({ actorUserId: patientUserId, action: "care_request.created", entityType: "care_request", entityId: requestId, metadata: { requestType: input.requestType, urgency: input.urgency, ownerNotificationSent } });
  return (await db.select().from(careRequests).where(eq(careRequests.id, requestId)).limit(1))[0];
}

export async function getPatientDashboard(userId: number) {
  const db = await getDb();
  if (!db) return { requests: [], episodes: [], events: [], appointments: [], notifications: [] };
  const [requests, episodes, events, patientAppointments, notifications] = await Promise.all([
    db.select({ request: careRequests, facility: facilities }).from(careRequests).leftJoin(facilities, eq(careRequests.facilityId, facilities.id)).where(eq(careRequests.patientUserId, userId)).orderBy(desc(careRequests.createdAt)).limit(50),
    db.select({ episode: careEpisodes, facility: facilities }).from(careEpisodes).leftJoin(facilities, eq(careEpisodes.facilityId, facilities.id)).where(eq(careEpisodes.patientUserId, userId)).orderBy(desc(careEpisodes.updatedAt)).limit(30),
    db.select({ event: careEvents, episodeId: careEpisodes.id }).from(careEvents).innerJoin(careEpisodes, eq(careEvents.episodeId, careEpisodes.id)).where(and(eq(careEpisodes.patientUserId, userId), eq(careEvents.patientVisible, true))).orderBy(desc(careEvents.createdAt)).limit(80),
    db.select({ appointment: appointments, facility: facilities }).from(appointments).leftJoin(facilities, eq(appointments.facilityId, facilities.id)).where(eq(appointments.patientUserId, userId)).orderBy(desc(appointments.scheduledAt)).limit(30),
    db.select().from(patientNotifications).where(eq(patientNotifications.userId, userId)).orderBy(desc(patientNotifications.createdAt)).limit(30),
  ]);
  return { requests, episodes, events, appointments: patientAppointments, notifications };
}

export async function updateCareRequestStatus(adminUserId: number, requestId: number, status: CareRequestStatus, message?: string) {
  const db = await getDb();
  if (!db) throw new Error("Base de données indisponible.");
  const request = (await db.select().from(careRequests).where(eq(careRequests.id, requestId)).limit(1))[0];
  if (!request) throw new Error("Demande introuvable.");
  await db.update(careRequests).set({ status, updatedAt: new Date() }).where(eq(careRequests.id, requestId));
  const episode = (await db.select().from(careEpisodes).where(eq(careEpisodes.careRequestId, requestId)).limit(1))[0];
  if (episode) {
    await db.update(careEpisodes).set({ status: status === "completed" || status === "cancelled" || status === "rejected" ? "closed" : status === "in_progress" ? "in_progress" : "open", closedAt: status === "completed" || status === "cancelled" || status === "rejected" ? new Date() : null, updatedAt: new Date() }).where(eq(careEpisodes.id, episode.id));
    await db.insert(careEvents).values({ episodeId: episode.id, actorUserId: adminUserId, eventType: status === "completed" || status === "cancelled" || status === "rejected" ? "closed" : "status_changed", title: `Demande ${status.replace("_", " ")}`, description: message?.trim() || null, patientVisible: true });
  }
  await db.insert(patientNotifications).values({ userId: request.patientUserId, title: "Mise à jour de votre demande", body: message?.trim() || `Le statut de votre demande est maintenant « ${status.replace("_", " ")} ».`, kind: "care" });
  await writeAuditLog({ actorUserId: adminUserId, action: "care_request.status_changed", entityType: "care_request", entityId: requestId, metadata: { status } });
  return { success: true } as const;
}

export async function createAppointment(adminUserId: number, input: { requestId: number; scheduledAt: Date; mode: "onsite" | "remote"; note?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Base de données indisponible.");
  const request = (await db.select().from(careRequests).where(eq(careRequests.id, input.requestId)).limit(1))[0];
  if (!request) throw new Error("Demande introuvable.");
  const result = await db.insert(appointments).values({ careRequestId: request.id, patientUserId: request.patientUserId, facilityId: request.facilityId, scheduledAt: input.scheduledAt, mode: input.mode, note: input.note?.trim() || null, status: "confirmed" });
  await db.update(careRequests).set({ status: "scheduled", updatedAt: new Date() }).where(eq(careRequests.id, request.id));
  const episode = (await db.select().from(careEpisodes).where(eq(careEpisodes.careRequestId, request.id)).limit(1))[0];
  if (episode) await db.insert(careEvents).values({ episodeId: episode.id, actorUserId: adminUserId, eventType: "appointment", title: "Rendez-vous confirmé", description: `Rendez-vous le ${input.scheduledAt.toISOString()}.`, patientVisible: true });
  await db.insert(patientNotifications).values({ userId: request.patientUserId, title: "Rendez-vous confirmé", body: `Votre rendez-vous est confirmé pour le ${input.scheduledAt.toLocaleString("fr-CM")}.`, kind: "appointment" });
  await writeAuditLog({ actorUserId: adminUserId, action: "appointment.created", entityType: "appointment", entityId: Number(result[0].insertId), metadata: { requestId: request.id, mode: input.mode } });
  return { success: true } as const;
}

export async function markPatientNotificationRead(userId: number, notificationId: number) {
  const db = await getDb();
  if (!db) throw new Error("Base de données indisponible.");
  await db.update(patientNotifications).set({ readAt: new Date() }).where(and(eq(patientNotifications.id, notificationId), eq(patientNotifications.userId, userId)));
  return { success: true } as const;
}

export async function listAdminCareRequests() {
  const db = await getDb();
  if (!db) return [];
  return db.select({ request: careRequests, patient: users, facility: facilities }).from(careRequests).innerJoin(users, eq(careRequests.patientUserId, users.id)).leftJoin(facilities, eq(careRequests.facilityId, facilities.id)).orderBy(desc(careRequests.updatedAt)).limit(100);
}

export async function getAdminClinicalSnapshot() {
  const db = await getDb();
  if (!db) return { users: 0, facilities: 0, requests: 0, openEpisodes: 0, unreadNotifications: 0 };
  const [usersCount, facilitiesCount, requestsCount, episodesCount, notificationsCount] = await Promise.all([
    db.select({ value: sql<number>`count(*)` }).from(users),
    db.select({ value: sql<number>`count(*)` }).from(facilities),
    db.select({ value: sql<number>`count(*)` }).from(careRequests).where(sql`${careRequests.status} not in ('completed', 'cancelled', 'rejected')`),
    db.select({ value: sql<number>`count(*)` }).from(careEpisodes).where(sql`${careEpisodes.status} <> 'closed'`),
    db.select({ value: sql<number>`count(*)` }).from(patientNotifications).where(sql`${patientNotifications.readAt} is null`),
  ]);
  return { users: Number(usersCount[0]?.value ?? 0), facilities: Number(facilitiesCount[0]?.value ?? 0), requests: Number(requestsCount[0]?.value ?? 0), openEpisodes: Number(episodesCount[0]?.value ?? 0), unreadNotifications: Number(notificationsCount[0]?.value ?? 0) };
}

export async function listRecentAuditLogs() {
  const db = await getDb();
  if (!db) return [];
  return db.select({ audit: auditLogs, actor: users.name }).from(auditLogs).leftJoin(users, eq(auditLogs.actorUserId, users.id)).orderBy(desc(auditLogs.createdAt)).limit(80);
}
