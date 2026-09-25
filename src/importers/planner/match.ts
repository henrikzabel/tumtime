import { moduleCodesInTitle } from "./nat";

export type ModuleRef = { code: string; titleDe?: string | null; titleEn?: string | null };
export type CourseListItem = { course_id: number; course_name?: string | null; course_name_en?: string | null };

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ­]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * Pick the courses of a semester that probably belong to one of the given modules, so that only
 * those need a (slow) detail request. A course matches if its title mentions a module number or
 * contains a module title. The course detail's own module list is the final authority.
 */
export function selectCandidateCourses(courses: CourseListItem[], modules: ModuleRef[]): number[] {
  const codes = new Set(modules.map((m) => m.code));
  const titles = [
    ...new Set(
      modules
        .flatMap((m) => [m.titleDe, m.titleEn])
        .filter((t): t is string => !!t)
        .map(normalize)
        .filter((t) => t.length >= 8),
    ),
  ];
  const ids: number[] = [];
  for (const c of courses) {
    const raw = `${c.course_name ?? ""} ${c.course_name_en ?? ""}`;
    if (moduleCodesInTitle(raw).some((code) => codes.has(code))) {
      ids.push(c.course_id);
      continue;
    }
    const name = ` ${normalize(raw)} `;
    if (titles.some((t) => name.includes(` ${t} `))) ids.push(c.course_id);
  }
  return ids;
}

/** The semester students are currently planning: from September on the upcoming winter term. */
export function planningSemester(today = new Date()): `${number}${"WS" | "SS"}` {
  const y = today.getFullYear();
  const m = today.getMonth() + 1;
  if (m >= 9) return `${y}WS`;
  if (m <= 2) return `${y - 1}WS`;
  return `${y}SS`;
}

/** "2026WS" → "2026w" (NAT API semester key). */
export function toNatSemesterKey(semester: string): string {
  return semester.replace(/^(\d{4})(WS|SS)$/, (_, y, t) => `${y}${t === "WS" ? "w" : "s"}`);
}
