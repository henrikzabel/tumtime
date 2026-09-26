"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/db";
import { clubs, infoSessionPeriods, infoSessionRequests, infoSessions } from "@/db/schema";
import { requireAdmin, requireUser } from "@/lib/auth/session";

import type { ActionState } from "./actions";
import { getPeriod, getPeriodRequests, getPeriodSessions } from "./info-session-queries";
import {
  cellKey,
  fromBerlin,
  parseSlots,
  parseVenues,
  PERIOD_STATUSES,
  periodCells,
  periodDates,
  planInfoSessions,
  toBerlin,
  type Cell,
  type PeriodStatus,
  type Placed,
} from "./info-sessions";
import { getManagedClub } from "./queries";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Please pick a date");
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Please enter a time");
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);
const optionalUrl = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v === "" || /^https?:\/\/\S+\.\S+$/i.test(v), "Links must start with https://")
  .transform((v) => v || null);

function revalidateSessions(slug?: string) {
  revalidatePath("/clubs/info-sessions");
  revalidatePath("/clubs");
  if (slug) revalidatePath(`/clubs/${slug}`);
}

// --- Club: own sessions --------------------------------------------------------------------------

const sessionSchema = z
  .object({
    date: isoDate,
    start: time,
    end: time,
    venue: optionalText(120),
    campus: optionalText(40),
    onlineUrl: optionalUrl,
    language: z.enum(["", "en", "de"]).transform((v) => v || null),
    notes: optionalText(300),
  })
  .refine((s) => s.start < s.end, "The session must end after it starts")
  .refine((s) => s.venue || s.onlineUrl, "Add a room or an online link");

export async function addInfoSession(slug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser(`/dashboard/${slug}/recruitment`);
  const club = await getManagedClub(slug, user);
  if (!club) return { error: "You don't have access to this club." };
  const str = (k: string) => String(formData.get(k) ?? "");
  const parsed = sessionSchema.safeParse({
    date: str("date"),
    start: str("start"),
    end: str("end"),
    venue: str("venue"),
    campus: str("campus"),
    onlineUrl: str("onlineUrl"),
    language: str("language"),
    notes: str("notes"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { date, start, end, ...rest } = parsed.data;
  const startsAt = fromBerlin(date, start);
  if (startsAt < new Date()) return { error: "This date is in the past." };
  await db.insert(infoSessions).values({ clubId: club.id, startsAt, endsAt: fromBerlin(date, end), ...rest });
  revalidateSessions(slug);
  revalidatePath(`/dashboard/${slug}/recruitment`);
  return { ok: true, message: "Info session added." };
}

/** Clubs can delete sessions they added themselves; period sessions are managed by the organisers. */
export async function deleteInfoSession(slug: string, formData: FormData) {
  const user = await requireUser(`/dashboard/${slug}/recruitment`);
  const club = await getManagedClub(slug, user);
  if (!club) return;
  await db
    .delete(infoSessions)
    .where(and(eq(infoSessions.id, Number(formData.get("sessionId"))), eq(infoSessions.clubId, club.id), isNull(infoSessions.periodId)));
  revalidateSessions(slug);
  revalidatePath(`/dashboard/${slug}/recruitment`);
}

// --- Club: request a slot in the info session weeks ---------------------------------------------

export async function saveInfoSessionRequest(slug: string, periodId: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser(`/dashboard/${slug}/recruitment`);
  const club = await getManagedClub(slug, user);
  if (!club) return { error: "You don't have access to this club." };
  const period = await getPeriod(periodId);
  if (!period || period.status !== "collecting") return { error: "Requests for this period are closed." };

  const dates = new Set(periodDates(period));
  const times = new Set(period.slots.map((s) => s.start));
  const pick = (k: string, allowed: Set<string>) => [...new Set(formData.getAll(k).map(String))].filter((v) => allowed.has(v)).sort();
  const preferredDates = pick("preferredDates", dates);
  const avoidDates = pick("avoidDates", dates).filter((d) => !preferredDates.includes(d));
  if (avoidDates.length === dates.size) return { error: "Please leave at least one night open." };
  const campuses = new Set(period.venues.map((v) => v.campus).filter(Boolean));
  const campus = String(formData.get("campus") ?? "");
  const language = String(formData.get("language") ?? "");
  const values = {
    preferredDates,
    avoidDates,
    preferredTimes: pick("preferredTimes", times),
    campus: campuses.has(campus) ? campus : null,
    language: ["en", "de"].includes(language) ? language : null,
    notes: String(formData.get("notes") ?? "").trim().slice(0, 500) || null,
    updatedAt: new Date(),
  };
  await db
    .insert(infoSessionRequests)
    .values({ periodId, clubId: club.id, ...values })
    .onConflictDoUpdate({ target: [infoSessionRequests.periodId, infoSessionRequests.clubId], set: values });
  revalidatePath(`/dashboard/${slug}/recruitment`);
  revalidatePath(`/admin/info-sessions/${periodId}`);
  return { ok: true, message: "Request saved. The organisers will publish the schedule once all clubs are in." };
}

export async function withdrawInfoSessionRequest(slug: string, formData: FormData) {
  const user = await requireUser(`/dashboard/${slug}/recruitment`);
  const club = await getManagedClub(slug, user);
  if (!club) return;
  const periodId = Number(formData.get("periodId"));
  await db.delete(infoSessionRequests).where(and(eq(infoSessionRequests.periodId, periodId), eq(infoSessionRequests.clubId, club.id)));
  revalidatePath(`/dashboard/${slug}/recruitment`);
  revalidatePath(`/admin/info-sessions/${periodId}`);
}

// --- Admin: periods ------------------------------------------------------------------------------

const periodSchema = z
  .object({
    title: z.string().trim().min(3, "Please add a title").max(120),
    description: optionalText(2000),
    startsOn: isoDate,
    endsOn: isoDate,
    weekdays: z.array(z.coerce.number().int().min(1).max(7)).min(1, "Pick at least one weekday"),
  })
  .refine((p) => p.startsOn <= p.endsOn, "The period must end after it starts")
  .refine((p) => (Date.parse(p.endsOn) - Date.parse(p.startsOn)) / 86_400_000 <= 60, "A period can be at most 60 days long");

export async function savePeriod(id: number | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin("/admin/info-sessions");
  const parsed = periodSchema.safeParse({
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    startsOn: String(formData.get("startsOn") ?? ""),
    endsOn: String(formData.get("endsOn") ?? ""),
    weekdays: formData.getAll("weekdays").map(String),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const slots = parseSlots(String(formData.get("slots") ?? ""));
  if (!slots.success) return { error: slots.error.issues[0].message };
  const venues = parseVenues(String(formData.get("venues") ?? ""));
  if (!venues.success) return { error: venues.error.issues[0].message };

  const values = { ...parsed.data, weekdays: [...new Set(parsed.data.weekdays)].sort(), slots: slots.data, venues: venues.data };
  if (id === null) {
    const [created] = await db.insert(infoSessionPeriods).values(values).returning({ id: infoSessionPeriods.id });
    redirect(`/admin/info-sessions/${created.id}`);
  }
  await db
    .update(infoSessionPeriods)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(infoSessionPeriods.id, id));
  // Sessions that no longer fit the grid (removed night, slot or room) are unscheduled.
  const period = (await getPeriod(id))!;
  const keys = new Set(periodCells(period).map((c) => c.key));
  const stale = (await getPeriodSessions(id)).filter((s) => {
    const { date, time } = toBerlin(s.startsAt);
    return !keys.has(cellKey(date, time, s.venue ?? ""));
  });
  for (const s of stale) await db.delete(infoSessions).where(eq(infoSessions.id, s.id));
  revalidatePath(`/admin/info-sessions/${id}`);
  revalidateSessions();
  return { ok: true, message: stale.length ? `Saved. ${stale.length} sessions no longer fit and were unscheduled.` : "Saved." };
}

export async function setPeriodStatus(formData: FormData) {
  await requireAdmin("/admin/info-sessions");
  const id = Number(formData.get("periodId"));
  const status = String(formData.get("status")) as PeriodStatus;
  if (!(status in PERIOD_STATUSES)) return;
  await db.update(infoSessionPeriods).set({ status, updatedAt: new Date() }).where(eq(infoSessionPeriods.id, id));
  revalidatePath(`/admin/info-sessions/${id}`);
  revalidatePath("/admin/info-sessions");
  revalidateSessions();
}

export async function deletePeriod(formData: FormData) {
  await requireAdmin("/admin/info-sessions");
  await db.delete(infoSessionPeriods).where(eq(infoSessionPeriods.id, Number(formData.get("periodId"))));
  revalidateSessions();
  redirect("/admin/info-sessions");
}

// --- Admin: scheduling ---------------------------------------------------------------------------

async function loadBoard(periodId: number) {
  const period = await getPeriod(periodId);
  if (!period) return null;
  const cells = periodCells(period);
  const byKey = new Map(cells.map((c) => [c.key, c]));
  const [sessions, requests] = await Promise.all([getPeriodSessions(periodId), getPeriodRequests(periodId)]);
  const placed: Placed[] = [];
  for (const s of sessions) {
    const { date, time } = toBerlin(s.startsAt);
    const cell = byKey.get(cellKey(date, time, s.venue ?? ""));
    if (cell) placed.push({ clubId: s.clubId, cell, focusAreas: s.focusAreas });
  }
  return { period, cells, byKey, sessions, requests, placed };
}

const sessionValues = (periodId: number, clubId: number, cell: Cell, language: string | null) => ({
  periodId,
  clubId,
  startsAt: fromBerlin(cell.date, cell.start),
  endsAt: fromBerlin(cell.date, cell.end),
  venue: cell.venue,
  campus: cell.campus || null,
  language,
});

/** Place all requesting clubs; `replace` discards the current plan first, otherwise it is kept. */
export async function autoSchedule(periodId: number, formData: FormData) {
  await requireAdmin(`/admin/info-sessions/${periodId}`);
  const board = await loadBoard(periodId);
  if (!board) return;
  const replace = formData.get("mode") === "replace";
  const fixed = replace ? [] : board.placed;
  const { placed } = planInfoSessions(
    board.cells,
    board.requests.map((r) => ({
      clubId: r.clubId,
      name: r.clubName,
      focusAreas: r.focusAreas,
      preferredDates: r.preferredDates,
      avoidDates: r.avoidDates,
      preferredTimes: r.preferredTimes,
      campus: r.campus,
    })),
    fixed,
  );
  const language = new Map(board.requests.map((r) => [r.clubId, r.language]));
  const fixedClubs = new Set(fixed.map((f) => f.clubId));
  await db.transaction(async (tx) => {
    if (replace) await tx.delete(infoSessions).where(eq(infoSessions.periodId, periodId));
    const fresh = placed.filter((p) => !fixedClubs.has(p.clubId));
    if (fresh.length) {
      await tx.insert(infoSessions).values(fresh.map((p) => sessionValues(periodId, p.clubId, p.cell, language.get(p.clubId) ?? null)));
    }
  });
  revalidatePath(`/admin/info-sessions/${periodId}`);
  revalidateSessions();
}

/**
 * Move a club into a cell (also used to place an unscheduled club). If another club holds the
 * cell, the two swap places (or the other club becomes unscheduled if the mover had no cell).
 */
export async function moveSession(periodId: number, clubId: number, targetKey: string | null): Promise<ActionState> {
  await requireAdmin(`/admin/info-sessions/${periodId}`);
  const board = await loadBoard(periodId);
  if (!board) return { error: "Period not found." };
  const [club] = await db.select({ id: clubs.id }).from(clubs).where(eq(clubs.id, clubId));
  if (!club) return { error: "Club not found." };
  const target = targetKey ? board.byKey.get(targetKey) : null;
  if (targetKey && !target) return { error: "This slot doesn't exist." };

  const current = board.placed.find((p) => p.clubId === clubId);
  const occupant = target ? board.placed.find((p) => p.cell.key === target.key && p.clubId !== clubId) : undefined;
  const language = (id: number) =>
    board.sessions.find((s) => s.clubId === id)?.language ?? board.requests.find((r) => r.clubId === id)?.language ?? null;

  await db.transaction(async (tx) => {
    const del = (id: number) => tx.delete(infoSessions).where(and(eq(infoSessions.periodId, periodId), eq(infoSessions.clubId, id)));
    await del(clubId);
    if (occupant) await del(occupant.clubId);
    if (target) await tx.insert(infoSessions).values(sessionValues(periodId, clubId, target, language(clubId)));
    if (occupant && current) await tx.insert(infoSessions).values(sessionValues(periodId, occupant.clubId, current.cell, language(occupant.clubId)));
  });
  revalidatePath(`/admin/info-sessions/${periodId}`);
  revalidateSessions();
  return { ok: true };
}
