import { compareGrades, isPassing, type GradeCounts } from "./grades";

/** The regular German grade steps; intermediate steps (e.g. 1.4) are added when present. */
export const STANDARD_GRADES = ["1.0", "1.3", "1.7", "2.0", "2.3", "2.7", "3.0", "3.3", "3.7", "4.0", "4.3", "4.7", "5.0"];

export type DistributionBin = { grade: string; count: number; share: number; passing: boolean };

/**
 * Turn grade counts into ordered histogram bins. Graded exams always show every standard step
 * (so empty grades are visible as gaps); pass/fail exams show only B and N.
 */
export function toDistribution(grades: GradeCounts): DistributionBin[] {
  const keys = new Set(Object.keys(grades).filter((g) => grades[g] > 0));
  const hasNumeric = [...keys].some((g) => g !== "B" && g !== "N");
  if (hasNumeric) for (const g of STANDARD_GRADES) keys.add(g);
  const total = [...keys].reduce((sum, g) => sum + (grades[g] ?? 0), 0);
  return [...keys].sort(compareGrades).map((grade) => {
    const count = grades[grade] ?? 0;
    return { grade, count, share: total ? count / total : 0, passing: isPassing(grade) };
  });
}
