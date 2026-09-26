import "server-only";

import { and, asc, desc, eq, gt, inArray, isNull, lt, ne } from "drizzle-orm";

import { db } from "@/db";
import { clubs, infoSessionPeriods, infoSessionRequests, infoSessions } from "@/db/schema";

import { slotSchema, venueSchema, type PeriodStatus, type Slot, type Venue } from "./info-sessions";

export type Period = {
  id: number;
  title: string;
  description: string | null;
  startsOn: string;
  endsOn: string;
  weekdays: number[];
  slots: Slot[];
  venues: Venue[];
  status: PeriodStatus;
};

function toPeriod(row: typeof infoSessionPeriods.$inferSelect): Period {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    startsOn: row.startsOn,
    endsOn: row.endsOn,
    weekdays: row.weekdays,
    slots: slotSchema.array().catch([]).parse(row.slots),
    venues: venueSchema.array().catch([]).parse(row.venues),
    status: row.status as PeriodStatus,
  };
}

export async function listPeriods(opts: { status?: PeriodStatus[] } = {}): Promise<Period[]> {
  const rows = await db
    .select()
    .from(infoSessionPeriods)
    .where(opts.status ? inArray(infoSessionPeriods.status, opts.status) : undefined)
    .orderBy(desc(infoSessionPeriods.startsOn));
  return rows.map(toPeriod);
}

export async function getPeriod(id: number): Promise<Period | null> {
  if (!Number.isInteger(id)) return null;
  const [row] = await db.select().from(infoSessionPeriods).where(eq(infoSessionPeriods.id, id));
  return row ? toPeriod(row) : null;
}

export type SessionRow = {
  id: number;
  clubId: number;
  periodId: number | null;
  startsAt: Date;
  endsAt: Date;
  venue: string | null;
  campus: string | null;
  onlineUrl: string | null;
  language: string | null;
  notes: string | null;
  clubName: string;
  clubSlug: string;
  focusAreas: string[];
  imageUrl: string | null;
  tagline: string | null;
};

const sessionColumns = {
  id: infoSessions.id,
  clubId: infoSessions.clubId,
  periodId: infoSessions.periodId,
  startsAt: infoSessions.startsAt,
  endsAt: infoSessions.endsAt,
  venue: infoSessions.venue,
  campus: infoSessions.campus,
  onlineUrl: infoSessions.onlineUrl,
  language: infoSessions.language,
  notes: infoSessions.notes,
  clubName: clubs.name,
  clubSlug: clubs.slug,
  focusAreas: clubs.focusAreas,
  imageUrl: clubs.imageUrl,
  tagline: clubs.tagline,
};

export async function getPeriodSessions(periodId: number): Promise<SessionRow[]> {
  return db
    .select(sessionColumns)
    .from(infoSessions)
    .innerJoin(clubs, eq(clubs.id, infoSessions.clubId))
    .where(eq(infoSessions.periodId, periodId))
    .orderBy(asc(infoSessions.startsAt), asc(infoSessions.venue));
}

/** Sessions clubs scheduled themselves (outside any period) within [from, to). */
export async function getStandaloneSessions(from: Date, to: Date, excludeClubIds: number[] = []): Promise<SessionRow[]> {
  return db
    .select(sessionColumns)
    .from(infoSessions)
    .innerJoin(clubs, eq(clubs.id, infoSessions.clubId))
    .where(
      and(
        isNull(infoSessions.periodId),
        gt(infoSessions.endsAt, from),
        lt(infoSessions.startsAt, to),
        ...excludeClubIds.map((id) => ne(infoSessions.clubId, id)),
      ),
    )
    .orderBy(asc(infoSessions.startsAt));
}

export async function getClubSessions(clubId: number) {
  return db
    .select({ ...sessionColumns, periodTitle: infoSessionPeriods.title, periodStatus: infoSessionPeriods.status })
    .from(infoSessions)
    .innerJoin(clubs, eq(clubs.id, infoSessions.clubId))
    .leftJoin(infoSessionPeriods, eq(infoSessionPeriods.id, infoSessions.periodId))
    .where(eq(infoSessions.clubId, clubId))
    .orderBy(desc(infoSessions.startsAt));
}

export async function getPeriodRequests(periodId: number) {
  return db
    .select({
      id: infoSessionRequests.id,
      clubId: infoSessionRequests.clubId,
      preferredDates: infoSessionRequests.preferredDates,
      avoidDates: infoSessionRequests.avoidDates,
      preferredTimes: infoSessionRequests.preferredTimes,
      campus: infoSessionRequests.campus,
      language: infoSessionRequests.language,
      notes: infoSessionRequests.notes,
      updatedAt: infoSessionRequests.updatedAt,
      clubName: clubs.name,
      clubSlug: clubs.slug,
      focusAreas: clubs.focusAreas,
    })
    .from(infoSessionRequests)
    .innerJoin(clubs, eq(clubs.id, infoSessionRequests.clubId))
    .where(eq(infoSessionRequests.periodId, periodId))
    .orderBy(asc(clubs.name));
}

export async function getClubRequests(clubId: number) {
  return db.select().from(infoSessionRequests).where(eq(infoSessionRequests.clubId, clubId));
}
