import type { ExamRecord, ExamSource } from "@/lib/stats/exam-record";
import { computeStats, type GradeCounts } from "@/lib/stats/grades";

/** When sources agree, fields are taken from the most trustworthy source first. */
export const SOURCE_PRIORITY: readonly ExamSource[] = ["upload", "aamin", "tum_info"];

export type SourcedRecord = { source: ExamSource; record: ExamRecord };

export type MergedExam = {
  status: "published" | "conflict";
  primarySource: ExamSource;
  sources: ExamSource[];
  /** Human-readable reasons when sources disagree. */
  conflicts: string[];
  date: string | null;
  registered: number | null;
  attempted: number | null;
  passed: number | null;
  failed: number | null;
  noShow: number | null;
  withdrawn: number | null;
  cheating: number | null;
  averageTotal: number | null;
  averagePassed: number | null;
  failureRate: number | null;
  grades: GradeCounts;
};

function nonEmpty(grades: GradeCounts): boolean {
  return Object.values(grades).some((n) => n > 0);
}

function gradesEqual(a: GradeCounts, b: GradeCounts): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) if ((a[k] ?? 0) !== (b[k] ?? 0)) return false;
  return true;
}

/**
 * Two records describe the same exam consistently if their grade distributions are identical
 * (or, when one has no distribution, their attempt counts match). Averages are not compared —
 * sources round them differently.
 */
export function disagreement(a: SourcedRecord, b: SourcedRecord): string | null {
  const ga = a.record.grades;
  const gb = b.record.grades;
  if (nonEmpty(ga) && nonEmpty(gb)) {
    return gradesEqual(ga, gb) ? null : `grade distribution differs between ${a.source} and ${b.source}`;
  }
  const aa = a.record.attempted ?? (nonEmpty(ga) ? computeStats(ga).attempted : undefined);
  const ab = b.record.attempted ?? (nonEmpty(gb) ? computeStats(gb).attempted : undefined);
  if (aa !== undefined && ab !== undefined && aa !== ab) {
    return `attempt count differs between ${a.source} (${aa}) and ${b.source} (${ab})`;
  }
  return null;
}

function byPriority(a: SourcedRecord, b: SourcedRecord) {
  return SOURCE_PRIORITY.indexOf(a.source) - SOURCE_PRIORITY.indexOf(b.source);
}

/**
 * Merge all source records of one exam (same module, semester, type).
 *
 * Rule: if the sources disagree, nothing is published — the exam is marked `conflict` until an
 * admin pins a source. If they agree (or there is only one), the highest-priority source wins and
 * missing fields are filled in from the others.
 */
export function mergeExamRecords(records: SourcedRecord[], pinnedSource?: ExamSource | null): MergedExam {
  if (records.length === 0) throw new Error("mergeExamRecords needs at least one record");
  const sorted = [...records].sort(byPriority);

  const pinned = pinnedSource ? sorted.find((r) => r.source === pinnedSource) : undefined;
  const conflicts: string[] = [];
  if (!pinned) {
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const reason = disagreement(sorted[i], sorted[j]);
        if (reason) conflicts.push(reason);
      }
    }
  }

  // A pinned source is used alone; otherwise combine all (agreeing) sources.
  const used = pinned ? [pinned] : sorted;
  const pick = <K extends keyof ExamRecord>(key: K): ExamRecord[K] | undefined =>
    used.map((r) => r.record[key]).find((v) => v !== undefined);

  const grades = used.map((r) => r.record.grades).find(nonEmpty) ?? {};
  const hasGrades = nonEmpty(grades);
  const computed = computeStats(grades);
  const attempted = hasGrades ? computed.attempted : (pick("attempted") ?? null);

  return {
    status: conflicts.length ? "conflict" : "published",
    primarySource: used[0].source,
    sources: sorted.map((r) => r.source),
    conflicts,
    date: pick("date") ?? null,
    registered: pick("registered") ?? null,
    attempted,
    passed: hasGrades ? computed.passed : null,
    failed: hasGrades ? computed.failed : null,
    noShow: pick("noShow") ?? null,
    withdrawn: pick("withdrawn") ?? null,
    cheating: pick("cheating") ?? null,
    averageTotal: hasGrades ? computed.averageTotal : (pick("averageTotal") ?? null),
    averagePassed: hasGrades ? computed.averagePassed : (pick("averagePassed") ?? null),
    failureRate: hasGrades ? computed.failureRate : (pick("failureRate") ?? null),
    grades,
  };
}
