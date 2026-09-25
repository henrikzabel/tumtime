/**
 * Grades are stored as strings: "1.0" … "5.0" (one decimal, including intermediate steps such as
 * "1.4" that some exams use), "B" (bestanden / passed) and "N" (nicht bestanden / failed).
 */
export type Grade = string;
export type GradeCounts = Record<Grade, number>;

export const PASS_THRESHOLD = 4.0;

/** Normalise "1,3", "1.3", 1.3, "B", "bestanden", "passed" … into a canonical grade, or null. */
export function normalizeGrade(input: string | number): Grade | null {
  if (typeof input === "number") return formatNumericGrade(input);
  const s = input.trim().toLowerCase();
  if (s === "b" || s === "bestanden" || s === "passed") return "B";
  if (s === "n" || s === "nicht bestanden" || s === "failed" || s === "not passed") return "N";
  const m = /^([1-5])[.,](\d)$/.exec(s) ?? /^([1-5])$/.exec(s);
  if (!m) return null;
  return formatNumericGrade(Number(`${m[1]}.${m[2] ?? "0"}`));
}

function formatNumericGrade(n: number): Grade | null {
  if (!Number.isFinite(n) || n < 1 || n > 5) return null;
  return (Math.round(n * 10) / 10).toFixed(1);
}

export function isPassing(grade: Grade): boolean {
  if (grade === "B") return true;
  if (grade === "N") return false;
  return Number(grade) <= PASS_THRESHOLD;
}

export function numericGrade(grade: Grade): number | null {
  return grade === "B" || grade === "N" ? null : Number(grade);
}

/** Sort order for display: 1.0 … 5.0, then B, N. */
export function compareGrades(a: Grade, b: Grade): number {
  const rank = (g: Grade) => (g === "B" ? 10 : g === "N" ? 11 : Number(g));
  return rank(a) - rank(b);
}

export type ComputedStats = {
  attempted: number;
  passed: number;
  failed: number;
  averageTotal: number | null;
  averagePassed: number | null;
  failureRate: number | null;
};

/** Derive the headline numbers from a grade distribution (graded outcomes only). */
export function computeStats(grades: GradeCounts): ComputedStats {
  let passed = 0;
  let failed = 0;
  let sumAll = 0;
  let nAll = 0;
  let sumPassed = 0;
  let nPassed = 0;
  for (const [grade, count] of Object.entries(grades)) {
    if (count <= 0) continue;
    const pass = isPassing(grade);
    if (pass) passed += count;
    else failed += count;
    const n = numericGrade(grade);
    if (n !== null) {
      sumAll += n * count;
      nAll += count;
      if (pass) {
        sumPassed += n * count;
        nPassed += count;
      }
    }
  }
  const attempted = passed + failed;
  return {
    attempted,
    passed,
    failed,
    averageTotal: nAll ? sumAll / nAll : null,
    averagePassed: nPassed ? sumPassed / nPassed : null,
    failureRate: attempted ? failed / attempted : null,
  };
}
