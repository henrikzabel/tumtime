import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import type { Db } from "@/db";
import { moduleReviews, modules } from "@/db/schema";
import { semesterKey, type Semester } from "@/lib/stats/semester";

import { COMMENT_MAX, type RatingKey } from "./metrics";

export { COMMENT_MAX, RATING_METRICS, type RatingKey } from "./metrics";

/** Semesters offered in the review form: the current one and this many before it. */
export const REVIEW_SEMESTER_SPAN = 8;

const rating = z.coerce.number().int().min(1, "Please rate every question.").max(5);
const yesNo = z
  .enum(["yes", "no", ""])
  .optional()
  .transform((v) => (v === "yes" ? true : v === "no" ? false : null));

export const reviewInputSchema = z.object({
  semester: z.string().regex(/^\d{4}(WS|SS)$/, "Please choose the semester you took the module."),
  usefulness: rating,
  difficulty: rating,
  workload: rating,
  attendanceRequired: yesNo,
  lecturesRecorded: yesNo,
  comment: z
    .string()
    .trim()
    .max(COMMENT_MAX, `Please keep your comment under ${COMMENT_MAX} characters.`)
    .optional()
    .transform((v) => v || null),
});
export type ReviewInput = z.output<typeof reviewInputSchema>;

export function reviewInputFromFormData(formData: FormData) {
  const get = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" ? v : undefined;
  };
  return reviewInputSchema.safeParse({
    semester: get("semester"),
    usefulness: get("usefulness") ?? 0,
    difficulty: get("difficulty") ?? 0,
    workload: get("workload") ?? 0,
    attendanceRequired: get("attendanceRequired") ?? "",
    lecturesRecorded: get("lecturesRecorded") ?? "",
    comment: get("comment"),
  });
}

/** The semester running at `now` (summer: April–September) and the ones before it, newest first. */
export function recentSemesters(now = new Date(), count = REVIEW_SEMESTER_SPAN): Semester[] {
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  let current: Semester = month >= 4 && month <= 9 ? `${year}SS` : month >= 10 ? `${year}WS` : `${year - 1}WS`;
  const out: Semester[] = [];
  for (let i = 0; i < count; i++) {
    out.push(current);
    const y = Number(current.slice(0, 4));
    current = current.endsWith("WS") ? `${y}SS` : `${y - 1}WS`;
  }
  return out;
}

/** Create or update the user's review of a module for one semester. */
export async function saveReview(db: Db, userId: string, moduleId: number, input: ReviewInput) {
  const [existing] = await db
    .select({ id: moduleReviews.id, comment: moduleReviews.comment, commentStatus: moduleReviews.commentStatus })
    .from(moduleReviews)
    .where(and(eq(moduleReviews.userId, userId), eq(moduleReviews.moduleId, moduleId), eq(moduleReviews.semester, input.semester)));
  // An unchanged, already moderated comment keeps its status; a new or edited one goes back to review.
  const commentStatus = !input.comment
    ? null
    : existing && existing.comment === input.comment
      ? existing.commentStatus
      : "pending";
  const values = { ...input, commentStatus };
  if (existing) {
    await db.update(moduleReviews).set(values).where(eq(moduleReviews.id, existing.id));
    return { id: existing.id, created: false };
  }
  const [row] = await db.insert(moduleReviews).values({ userId, moduleId, ...values }).returning({ id: moduleReviews.id });
  return { id: row.id, created: true };
}

export async function deleteReview(db: Db, userId: string, reviewId: number) {
  await db.delete(moduleReviews).where(and(eq(moduleReviews.id, reviewId), eq(moduleReviews.userId, userId)));
}

export type ReviewSummary = {
  count: number;
  averages: Record<RatingKey, number | null>;
  /** Share answering "yes" among those who answered; null when nobody did. */
  attendanceRequired: { yes: number; answered: number };
  lecturesRecorded: { yes: number; answered: number };
  /** Approved comments, newest semester first. Never includes who wrote them. */
  comments: { id: number; semester: string; comment: string; usefulness: number; difficulty: number; workload: number }[];
  semesters: string[];
};

type ReviewRow = Pick<
  typeof moduleReviews.$inferSelect,
  "id" | "semester" | "usefulness" | "difficulty" | "workload" | "attendanceRequired" | "lecturesRecorded" | "comment" | "commentStatus"
>;

/** Aggregate reviews for display (pure, so it can be unit-tested). */
export function summarizeReviews(rows: ReviewRow[], semester?: string): ReviewSummary {
  const semesters = [...new Set(rows.map((r) => r.semester))].sort(
    (a, b) => semesterKey(b as Semester) - semesterKey(a as Semester),
  );
  const used = semester ? rows.filter((r) => r.semester === semester) : rows;
  const avg = (k: RatingKey) =>
    used.length ? Math.round((used.reduce((s, r) => s + r[k], 0) / used.length) * 10) / 10 : null;
  const tally = (k: "attendanceRequired" | "lecturesRecorded") => ({
    yes: used.filter((r) => r[k] === true).length,
    answered: used.filter((r) => r[k] !== null).length,
  });
  return {
    count: used.length,
    averages: { usefulness: avg("usefulness"), difficulty: avg("difficulty"), workload: avg("workload") },
    attendanceRequired: tally("attendanceRequired"),
    lecturesRecorded: tally("lecturesRecorded"),
    comments: used
      .filter((r) => r.comment && r.commentStatus === "approved")
      .sort((a, b) => semesterKey(b.semester as Semester) - semesterKey(a.semester as Semester) || b.id - a.id)
      .map((r) => ({
        id: r.id,
        semester: r.semester,
        comment: r.comment!,
        usefulness: r.usefulness,
        difficulty: r.difficulty,
        workload: r.workload,
      })),
    semesters,
  };
}

const publicColumns = {
  id: moduleReviews.id,
  semester: moduleReviews.semester,
  usefulness: moduleReviews.usefulness,
  difficulty: moduleReviews.difficulty,
  workload: moduleReviews.workload,
  attendanceRequired: moduleReviews.attendanceRequired,
  lecturesRecorded: moduleReviews.lecturesRecorded,
  comment: moduleReviews.comment,
  commentStatus: moduleReviews.commentStatus,
};

export async function getModuleReviewSummary(db: Db, moduleId: number, semester?: string) {
  const rows = await db.select(publicColumns).from(moduleReviews).where(eq(moduleReviews.moduleId, moduleId));
  return summarizeReviews(rows, semester);
}

export async function getMyReviews(db: Db, userId: string, moduleId?: number) {
  return db
    .select({ ...publicColumns, moduleCode: modules.code, moduleName: sql<string | null>`coalesce(${modules.nameEn}, ${modules.nameDe})` })
    .from(moduleReviews)
    .innerJoin(modules, eq(modules.id, moduleReviews.moduleId))
    .where(moduleId ? and(eq(moduleReviews.userId, userId), eq(moduleReviews.moduleId, moduleId)) : eq(moduleReviews.userId, userId))
    .orderBy(desc(moduleReviews.updatedAt));
}

export async function listPendingComments(db: Db) {
  return db
    .select({
      id: moduleReviews.id,
      semester: moduleReviews.semester,
      comment: moduleReviews.comment,
      updatedAt: moduleReviews.updatedAt,
      moduleCode: modules.code,
      moduleName: sql<string | null>`coalesce(${modules.nameEn}, ${modules.nameDe})`,
    })
    .from(moduleReviews)
    .innerJoin(modules, eq(modules.id, moduleReviews.moduleId))
    .where(eq(moduleReviews.commentStatus, "pending"))
    .orderBy(moduleReviews.updatedAt);
}

/** Approve or reject comments; returns the module codes whose pages should be refreshed. */
export async function moderateComments(db: Db, ids: number[], decision: "approved" | "rejected") {
  if (ids.length === 0) return [];
  const rows = await db
    .update(moduleReviews)
    .set({ commentStatus: decision })
    .where(and(inArray(moduleReviews.id, ids), eq(moduleReviews.commentStatus, "pending")))
    .returning({ moduleId: moduleReviews.moduleId });
  if (rows.length === 0) return [];
  const mods = await db
    .select({ code: modules.code })
    .from(modules)
    .where(inArray(modules.id, [...new Set(rows.map((r) => r.moduleId))]));
  return mods.map((m) => m.code);
}

export async function countPendingComments(db: Db) {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(moduleReviews)
    .where(eq(moduleReviews.commentStatus, "pending"));
  return count;
}
