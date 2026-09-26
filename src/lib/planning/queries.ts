import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { bookmarks, degreePlans, schedules } from "@/db/schema";
import { planStateSchema, type PlanState } from "@/lib/planner/plan";

const isUuid = (id: string) => z.string().uuid().safeParse(id).success;

export async function getBookmarkCodes(userId: string): Promise<string[]> {
  const rows = await db
    .select({ code: bookmarks.moduleCode })
    .from(bookmarks)
    .where(eq(bookmarks.userId, userId))
    .orderBy(desc(bookmarks.createdAt));
  return rows.map((r) => r.code);
}

export type ScheduleRow = typeof schedules.$inferSelect;

export async function listSchedules(userId: string, semester?: string): Promise<ScheduleRow[]> {
  return db
    .select()
    .from(schedules)
    .where(semester ? and(eq(schedules.userId, userId), eq(schedules.semester, semester)) : eq(schedules.userId, userId))
    .orderBy(desc(schedules.updatedAt));
}

export async function getSchedule(id: string, userId: string): Promise<ScheduleRow | null> {
  if (!isUuid(id)) return null;
  const [row] = await db.select().from(schedules).where(and(eq(schedules.id, id), eq(schedules.userId, userId)));
  return row ?? null;
}

export async function getSharedSchedule(token: string): Promise<ScheduleRow | null> {
  if (!/^[\w-]{10,64}$/.test(token)) return null;
  const [row] = await db.select().from(schedules).where(eq(schedules.shareToken, token));
  return row ?? null;
}

export type DegreePlanRow = Omit<typeof degreePlans.$inferSelect, "state"> & { state: PlanState };

function parsePlan(row: typeof degreePlans.$inferSelect): DegreePlanRow | null {
  const state = planStateSchema.safeParse(row.state);
  return state.success ? { ...row, state: state.data as unknown as PlanState } : null;
}

export async function listDegreePlans(userId: string): Promise<DegreePlanRow[]> {
  const rows = await db.select().from(degreePlans).where(eq(degreePlans.userId, userId)).orderBy(desc(degreePlans.updatedAt));
  return rows.map(parsePlan).filter((r): r is DegreePlanRow => r !== null);
}

export async function getDegreePlan(id: string, userId: string): Promise<DegreePlanRow | null> {
  if (!isUuid(id)) return null;
  const [row] = await db.select().from(degreePlans).where(and(eq(degreePlans.id, id), eq(degreePlans.userId, userId)));
  return row ? parsePlan(row) : null;
}

export async function getSharedDegreePlan(token: string): Promise<DegreePlanRow | null> {
  if (!/^[\w-]{10,64}$/.test(token)) return null;
  const [row] = await db.select().from(degreePlans).where(eq(degreePlans.shareToken, token));
  return row ? parsePlan(row) : null;
}
