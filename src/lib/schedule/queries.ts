import "server-only";

import { getCatalogIndex } from "@/lib/catalog/queries";
import { parseEntryKey } from "@/lib/catalog/entries";
import { getTimetableCourses, type TimetableCourse } from "@/lib/planner/queries";

export type ScheduleEntry = { key: string; title: string; ects: number | null };

/** Titles, credits and all courses (groups, dates) of the entries in a schedule. */
export async function getScheduleData(
  semester: string,
  keys: string[],
): Promise<{ entries: ScheduleEntry[]; courses: TimetableCourse[] }> {
  const parsed = keys.map(parseEntryKey);
  const codes = parsed.flatMap((p) => (p?.kind === "module" ? [p.code] : []));
  const courseIds = parsed.flatMap((p) => (p?.kind === "course" ? [p.courseId] : []));
  const [index, courses] = await Promise.all([getCatalogIndex(semester), getTimetableCourses(semester, codes, courseIds)]);
  const byKey = new Map(index.map((e) => [e.key, e]));
  return {
    entries: keys.map((key) => ({ key, title: byKey.get(key)?.title ?? key, ects: byKey.get(key)?.ects ?? null })),
    courses,
  };
}
