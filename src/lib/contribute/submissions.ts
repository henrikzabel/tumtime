import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";

import type { Db } from "@/db";
import { exams, gradeCounts, modules, sourceRecords, submissions } from "@/db/schema";
import { saveSourceRecords } from "@/importers/store";
import { parseTumOnlineStatistics, TUMONLINE_PARSER_VERSION, TumOnlineParseError } from "@/importers/tumonline";
import type { ExamRecord, ExamType } from "@/lib/stats/exam-record";
import type { GradeCounts } from "@/lib/stats/grades";

import { extractStatisticsBlock, MAX_FRAGMENT_BYTES } from "./extract";

/** A user may have at most this many uploads waiting for review. */
export const MAX_PENDING_PER_USER = 20;

export class UploadError extends Error {}

export type UploadPreview = {
  record: ExamRecord;
  examCode: string;
  typeGuess: ExamType;
  warnings: string[];
};

function gradesEqual(a: GradeCounts, b: GradeCounts): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) if ((a[k] ?? 0) !== (b[k] ?? 0)) return false;
  return true;
}

/** Parse an uploaded page (or the statistics block cut out of it). Nothing is stored. */
export function parseUpload(html: string): UploadPreview {
  if (html.length > MAX_FRAGMENT_BYTES * 20) throw new UploadError("This file is too large to be a TUMonline page.");
  const fragment = extractStatisticsBlock(html);
  if (!fragment) {
    throw new UploadError(
      "No exam statistics found. Open the statistics page in TUMonline, wait for the chart, then save it with “Save page as… → Webpage, complete” (or “Webpage, HTML only” in Firefox).",
    );
  }
  if (fragment.length > MAX_FRAGMENT_BYTES) throw new UploadError("The statistics block is unexpectedly large.");
  try {
    const { record, examCode, typeGuess, warnings } = parseTumOnlineStatistics(fragment);
    return { record, examCode, typeGuess, warnings };
  } catch (err) {
    if (err instanceof TumOnlineParseError) throw new UploadError(err.message);
    throw err;
  }
}

export type PublishedComparison =
  | { state: "none" }
  | { state: "same"; sources: string[] }
  | { state: "different"; sources: string[]; attempted: number | null };

/** How an uploaded record relates to what is currently public for the same exam. */
export async function compareWithPublished(
  db: Db,
  key: { moduleCode: string; semester: string; type: ExamType },
  grades: GradeCounts,
): Promise<PublishedComparison> {
  const [exam] = await db
    .select({ id: exams.id, sources: exams.sources, attempted: exams.attempted })
    .from(exams)
    .innerJoin(modules, eq(modules.id, exams.moduleId))
    .where(and(eq(modules.code, key.moduleCode), eq(exams.semester, key.semester), eq(exams.type, key.type)));
  if (!exam) return { state: "none" };
  const rows = await db.select().from(gradeCounts).where(eq(gradeCounts.examId, exam.id));
  const published = Object.fromEntries(rows.map((r) => [r.grade, r.count]));
  return gradesEqual(published, grades)
    ? { state: "same", sources: exam.sources }
    : { state: "different", sources: exam.sources, attempted: exam.attempted };
}

export type SubmitResult = { status: "submitted" | "updated" | "duplicate" | "known"; id?: string };

/**
 * Store an upload for review. Only the parsed numbers are kept. Re-uploading the same exam replaces
 * one's own pending upload; numbers we already have (pending or approved) are not queued again.
 */
export async function createSubmission(db: Db, userId: string, html: string, type: ExamType): Promise<SubmitResult> {
  const { record: parsed, warnings } = parseUpload(html);
  const record: ExamRecord = { ...parsed, type };
  const key = { moduleCode: record.moduleCode, semester: record.semester, type };

  const [approvedUpload] = await db
    .select({ data: sourceRecords.data })
    .from(sourceRecords)
    .where(
      and(
        eq(sourceRecords.source, "upload"),
        eq(sourceRecords.moduleCode, key.moduleCode),
        eq(sourceRecords.semester, key.semester),
        eq(sourceRecords.type, key.type),
      ),
    );
  if (approvedUpload && gradesEqual((approvedUpload.data as ExamRecord).grades, record.grades)) return { status: "known" };

  const pending = await db
    .select({ id: submissions.id, userId: submissions.userId, data: submissions.data })
    .from(submissions)
    .where(
      and(
        eq(submissions.status, "pending"),
        eq(submissions.moduleCode, key.moduleCode),
        eq(submissions.semester, key.semester),
        eq(submissions.type, key.type),
      ),
    );
  const own = pending.find((p) => p.userId === userId);
  if (pending.some((p) => p.id !== own?.id && gradesEqual((p.data as ExamRecord).grades, record.grades))) {
    return { status: "duplicate" };
  }

  const values = {
    moduleCode: key.moduleCode,
    semester: key.semester,
    type,
    data: record,
    warnings,
    parserVersion: TUMONLINE_PARSER_VERSION,
  };
  if (own) {
    await db.update(submissions).set({ ...values, createdAt: new Date() }).where(eq(submissions.id, own.id));
    return { status: "updated", id: own.id };
  }

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(submissions)
    .where(and(eq(submissions.userId, userId), eq(submissions.status, "pending")));
  if (count >= MAX_PENDING_PER_USER) {
    throw new UploadError(`You have ${count} uploads waiting for review. Please wait until they are checked.`);
  }
  const [row] = await db.insert(submissions).values({ ...values, userId }).returning({ id: submissions.id });
  return { status: "submitted", id: row.id };
}

/**
 * Publish a pending upload as source `upload` and re-merge the module. Other pending uploads with
 * the same numbers are closed along with it. The uploader link is dropped on review.
 */
export async function approveSubmission(db: Db, id: string, type?: ExamType) {
  const [sub] = await db.select().from(submissions).where(and(eq(submissions.id, id), eq(submissions.status, "pending")));
  if (!sub) throw new UploadError("Submission not found or already reviewed.");
  const finalType = type ?? sub.type;
  const record: ExamRecord = { ...(sub.data as ExamRecord), type: finalType };

  const summary = await saveSourceRecords(db, "upload", [record]);
  const reviewedAt = new Date();
  await db
    .update(submissions)
    .set({ status: "approved", type: finalType, data: record, userId: null, reviewedAt })
    .where(eq(submissions.id, id));

  const twins = await db
    .select({ id: submissions.id, data: submissions.data })
    .from(submissions)
    .where(
      and(
        eq(submissions.status, "pending"),
        eq(submissions.moduleCode, record.moduleCode),
        eq(submissions.semester, record.semester),
        eq(submissions.type, finalType),
      ),
    );
  const same = twins.filter((t) => gradesEqual((t.data as ExamRecord).grades, record.grades)).map((t) => t.id);
  if (same.length) {
    await db
      .update(submissions)
      .set({ status: "approved", userId: null, reviewedAt, reviewNote: "Same numbers as an approved upload." })
      .where(inArray(submissions.id, same));
  }
  return summary;
}

export async function rejectSubmission(db: Db, id: string, note?: string) {
  const rows = await db
    .update(submissions)
    .set({ status: "rejected", reviewNote: note?.trim() || null, userId: null, reviewedAt: new Date() })
    .where(and(eq(submissions.id, id), eq(submissions.status, "pending")))
    .returning({ id: submissions.id });
  if (rows.length === 0) throw new UploadError("Submission not found or already reviewed.");
}

export async function withdrawSubmission(db: Db, userId: string, id: string) {
  await db
    .delete(submissions)
    .where(and(eq(submissions.id, id), eq(submissions.userId, userId), eq(submissions.status, "pending")));
}

export async function listPendingSubmissions(db: Db) {
  const rows = await db
    .select()
    .from(submissions)
    .where(eq(submissions.status, "pending"))
    .orderBy(submissions.createdAt);
  return Promise.all(
    rows.map(async (s) => {
      const record = s.data as ExamRecord;
      const comparison = await compareWithPublished(db, { moduleCode: s.moduleCode, semester: s.semester, type: s.type }, record.grades);
      return { ...s, record, comparison };
    }),
  );
}

export async function listRecentlyReviewed(db: Db, limit = 20) {
  return db
    .select({
      id: submissions.id,
      moduleCode: submissions.moduleCode,
      semester: submissions.semester,
      type: submissions.type,
      status: submissions.status,
      reviewNote: submissions.reviewNote,
      reviewedAt: submissions.reviewedAt,
    })
    .from(submissions)
    .where(ne(submissions.status, "pending"))
    .orderBy(desc(submissions.reviewedAt))
    .limit(limit);
}

export async function listMySubmissions(db: Db, userId: string) {
  return db
    .select({ id: submissions.id, moduleCode: submissions.moduleCode, semester: submissions.semester, type: submissions.type, createdAt: submissions.createdAt })
    .from(submissions)
    .where(and(eq(submissions.userId, userId), eq(submissions.status, "pending")))
    .orderBy(desc(submissions.createdAt));
}

export async function countPendingSubmissions(db: Db) {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(submissions)
    .where(eq(submissions.status, "pending"));
  return count;
}
