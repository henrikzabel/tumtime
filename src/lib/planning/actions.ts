"use server";

import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/db";
import { bookmarks, degreePlans, schedules } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { generateToken } from "@/lib/auth/tokens";
import { planStateSchema } from "@/lib/planner/plan";
import type { Semester } from "@/lib/stats/semester";

const MAX_SCHEDULES = 40;
const MAX_PLANS = 20;
const MAX_BOOKMARKS = 500;

const moduleCode = z.string().trim().toUpperCase().regex(/^[A-Z0-9_]{3,30}$/);
const semester = z.string().regex(/^\d{4}(WS|SS)$/);
const name = z.string().trim().min(1, "Please enter a name.").max(60);
const selectionSchema = z.record(z.string().max(80), z.number().int()).refine((s) => Object.keys(s).length <= 200);

// --- Bookmarks ----------------------------------------------------------------------------------

/** Toggle a bookmark; returns the new state. */
export async function toggleBookmark(code: string, returnTo = "/catalog"): Promise<boolean> {
  const user = await requireUser(returnTo);
  const moduleCodeValue = moduleCode.parse(code);
  const where = and(eq(bookmarks.userId, user.id), eq(bookmarks.moduleCode, moduleCodeValue));
  const deleted = await db.delete(bookmarks).where(where).returning();
  if (deleted.length) return false;
  const [{ n }] = await db.select({ n: count() }).from(bookmarks).where(eq(bookmarks.userId, user.id));
  if (n >= MAX_BOOKMARKS) throw new Error("Too many bookmarks.");
  await db.insert(bookmarks).values({ userId: user.id, moduleCode: moduleCodeValue }).onConflictDoNothing();
  return true;
}

// --- Schedules ----------------------------------------------------------------------------------

async function ownSchedule(userId: string, id: string) {
  if (!z.string().uuid().safeParse(id).success) return null;
  const [row] = await db.select().from(schedules).where(and(eq(schedules.id, id), eq(schedules.userId, userId)));
  return row ?? null;
}

export async function createSchedule(input: { semester: string; name?: string; moduleCodes?: string[] }) {
  const user = await requireUser("/schedules");
  const [{ n }] = await db.select({ n: count() }).from(schedules).where(eq(schedules.userId, user.id));
  if (n >= MAX_SCHEDULES) throw new Error("You have too many schedules. Delete some first.");
  const [row] = await db
    .insert(schedules)
    .values({
      userId: user.id,
      semester: semester.parse(input.semester),
      name: name.parse(input.name || "My schedule"),
      moduleCodes: z.array(moduleCode).max(40).parse(input.moduleCodes ?? []),
    })
    .returning({ id: schedules.id });
  revalidatePath("/schedules");
  return row.id;
}

/** Form action used by the "New schedule" dialog. */
export async function createScheduleFromForm(formData: FormData) {
  const id = await createSchedule({
    semester: String(formData.get("semester") ?? ""),
    name: String(formData.get("name") ?? ""),
  });
  redirect(`/schedules/${id}`);
}

export async function updateSchedule(
  id: string,
  patch: { name?: string; moduleCodes?: string[]; selection?: Record<string, number> },
) {
  const user = await requireUser(`/schedules/${id}`);
  if (!(await ownSchedule(user.id, id))) throw new Error("Schedule not found.");
  await db
    .update(schedules)
    .set({
      ...(patch.name !== undefined ? { name: name.parse(patch.name) } : {}),
      ...(patch.moduleCodes !== undefined ? { moduleCodes: [...new Set(z.array(moduleCode).max(40).parse(patch.moduleCodes))] } : {}),
      ...(patch.selection !== undefined ? { selection: selectionSchema.parse(patch.selection) } : {}),
      updatedAt: new Date(),
    })
    .where(eq(schedules.id, id));
  revalidatePath("/schedules");
}

/** Add a module to a schedule (creating a schedule for that semester if the user has none). */
export async function addModuleToSchedule(code: string, sem: string, scheduleId?: string): Promise<string> {
  const user = await requireUser("/catalog");
  const c = moduleCode.parse(code);
  let target = scheduleId ? await ownSchedule(user.id, scheduleId) : null;
  if (!target) {
    [target] = await db
      .select()
      .from(schedules)
      .where(and(eq(schedules.userId, user.id), eq(schedules.semester, semester.parse(sem))))
      .orderBy(schedules.updatedAt)
      .limit(1);
  }
  if (!target) return createSchedule({ semester: sem, moduleCodes: [c] });
  if (!target.moduleCodes.includes(c)) {
    if (target.moduleCodes.length >= 40) throw new Error("This schedule is full.");
    await db
      .update(schedules)
      .set({ moduleCodes: [...target.moduleCodes, c], updatedAt: new Date() })
      .where(eq(schedules.id, target.id));
  }
  revalidatePath("/schedules");
  return target.id;
}

export async function duplicateSchedule(id: string) {
  const user = await requireUser("/schedules");
  const src = await ownSchedule(user.id, id);
  if (!src) throw new Error("Schedule not found.");
  const copy = await createSchedule({ semester: src.semester, name: `${src.name} (copy)`.slice(0, 60), moduleCodes: src.moduleCodes });
  await db.update(schedules).set({ selection: src.selection }).where(eq(schedules.id, copy));
  redirect(`/schedules/${copy}`);
}

export async function deleteSchedule(id: string) {
  const user = await requireUser("/schedules");
  await db.delete(schedules).where(and(eq(schedules.id, id), eq(schedules.userId, user.id)));
  revalidatePath("/schedules");
  redirect("/schedules");
}

/** Turn the read-only share link on or off; returns the token (or null). */
export async function setScheduleSharing(id: string, shared: boolean): Promise<string | null> {
  const user = await requireUser(`/schedules/${id}`);
  const row = await ownSchedule(user.id, id);
  if (!row) throw new Error("Schedule not found.");
  const token = shared ? (row.shareToken ?? generateToken().slice(0, 22)) : null;
  await db.update(schedules).set({ shareToken: token }).where(eq(schedules.id, id));
  return token;
}

// --- Degree plans -------------------------------------------------------------------------------

async function ownPlan(userId: string, id: string) {
  if (!z.string().uuid().safeParse(id).success) return null;
  const [row] = await db.select().from(degreePlans).where(and(eq(degreePlans.id, id), eq(degreePlans.userId, userId)));
  return row ?? null;
}

export async function createDegreePlan(input: { name: string; state: unknown }): Promise<string> {
  const user = await requireUser("/degree-planner");
  const [{ n }] = await db.select({ n: count() }).from(degreePlans).where(eq(degreePlans.userId, user.id));
  if (n >= MAX_PLANS) throw new Error("You have too many plans. Delete some first.");
  const state = planStateSchema.parse(input.state);
  const [row] = await db
    .insert(degreePlans)
    .values({ userId: user.id, name: name.parse(input.name), state })
    .returning({ id: degreePlans.id });
  revalidatePath("/degree-planner");
  return row.id;
}

export async function saveDegreePlan(id: string, patch: { name?: string; state?: unknown }) {
  const user = await requireUser(`/degree-planner/${id}`);
  if (!(await ownPlan(user.id, id))) throw new Error("Plan not found.");
  await db
    .update(degreePlans)
    .set({
      ...(patch.name !== undefined ? { name: name.parse(patch.name) } : {}),
      ...(patch.state !== undefined ? { state: planStateSchema.parse(patch.state) } : {}),
      updatedAt: new Date(),
    })
    .where(eq(degreePlans.id, id));
  revalidatePath("/degree-planner");
}

export async function duplicateDegreePlan(id: string) {
  const user = await requireUser("/degree-planner");
  const src = await ownPlan(user.id, id);
  if (!src) throw new Error("Plan not found.");
  const copy = await createDegreePlan({ name: `${src.name} (copy)`.slice(0, 60), state: src.state });
  redirect(`/degree-planner/${copy}`);
}

export async function deleteDegreePlan(id: string) {
  const user = await requireUser("/degree-planner");
  await db.delete(degreePlans).where(and(eq(degreePlans.id, id), eq(degreePlans.userId, user.id)));
  revalidatePath("/degree-planner");
  redirect("/degree-planner");
}

export async function setDegreePlanSharing(id: string, shared: boolean): Promise<string | null> {
  const user = await requireUser(`/degree-planner/${id}`);
  const row = await ownPlan(user.id, id);
  if (!row) throw new Error("Plan not found.");
  const token = shared ? (row.shareToken ?? generateToken().slice(0, 22)) : null;
  await db.update(degreePlans).set({ shareToken: token }).where(eq(degreePlans.id, id));
  return token;
}

/** Onboarding form: create a plan from a program's recommended study plan (or an old share link). */
export async function createDegreePlanFromForm(formData: FormData) {
  await requireUser("/degree-planner/new");
  const { getProgram } = await import("@/lib/planner/queries");
  const { createPlan, decodePlan, studyPlanFor } = await import("@/lib/planner/plan");
  const programSlug = String(formData.get("program") ?? "");
  const start = semester.parse(String(formData.get("start") ?? ""));
  const encoded = String(formData.get("plan") ?? "");
  const data = await getProgram(programSlug);
  if (!data || data.plans.length === 0) throw new Error("Unknown program.");

  const imported = encoded ? decodePlan(encoded) : null;
  const state =
    imported && imported.program === programSlug
      ? imported
      : createPlan(programSlug, studyPlanFor(data.plans, start as Semester) ?? data.plans[0], start as Semester);
  const planName = String(formData.get("name") ?? "").trim() || `${data.program.degree} ${data.program.nameEn}`;
  const id = await createDegreePlan({ name: planName.slice(0, 60), state });
  redirect(`/degree-planner/${id}`);
}

/** Create a schedule for one semester of a degree plan and open it in the scheduler. */
export async function openSemesterInScheduler(term: string, moduleCodes: string[], planName: string) {
  const id = await createSchedule({ semester: term, name: `${planName} · ${term}`.slice(0, 60), moduleCodes: moduleCodes.slice(0, 40) });
  redirect(`/schedules/${id}`);
}
