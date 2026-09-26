/**
 * The catalog lists every module taught in a semester, plus courses that are not linked to any
 * module (seminars, research internships, language courses …) as standalone entries.
 * Entry keys: the module code ("IN0001") or "C_<TUMonline course id>".
 */
export type CatalogEntry = {
  key: string;
  title: string;
  /** German title when different (searchable). */
  titleDe: string | null;
  ects: number | null;
  school: string | null;
  languages: string[];
  /** TUMonline activity codes of its courses (VO, UE, SE …). */
  activities: string[];
  /** ISO weekdays (1 = Mon) with regular dates. */
  days: number[];
  /** Latest published exam: average grade and failure rate. */
  avg: number | null;
  fail: number | null;
};

export const COURSE_KEY_PREFIX = "C_";

export const courseKey = (courseId: number) => `${COURSE_KEY_PREFIX}${courseId}`;

export function parseEntryKey(key: string): { kind: "module"; code: string } | { kind: "course"; courseId: number } | null {
  const k = key.trim().toUpperCase();
  const course = /^C_(\d{5,12})$/.exec(k);
  if (course) return { kind: "course", courseId: Number(course[1]) };
  if (/^[A-Z0-9_]{3,30}$/.test(k)) return { kind: "module", code: k };
  return null;
}

const SCHOOLS: [RegExp, string][] = [
  [/Computation, Information and Technology/i, "CIT"],
  [/Engineering and Design/i, "ED"],
  [/Natural Sciences/i, "NAT"],
  [/Life Sciences/i, "LS"],
  [/Medicine and Health/i, "MH"],
  [/Management/i, "MGT"],
  [/Social Sciences and Technology/i, "SOT"],
  [/Straubing/i, "TUMCS"],
  [/Language Cent/i, "Language Center"],
];

/** Short label for a TUM school name ("TUM School of Management" → "MGT"). */
export function schoolShort(name: string | null | undefined): string | null {
  if (!name) return null;
  return SCHOOLS.find(([re]) => re.test(name))?.[1] ?? name.replace(/^TUM\s+/, "");
}

export const ACTIVITY_GROUPS: { value: string; label: string; codes: string[] }[] = [
  { value: "lecture", label: "Lecture", codes: ["VO", "VI", "OV"] },
  { value: "exercise", label: "Exercise / tutorial", codes: ["UE", "TT", "VI", "RE"] },
  { value: "seminar", label: "Seminar", codes: ["SE", "PS", "HS", "KO", "WS"] },
  { value: "lab", label: "Lab / practical", codes: ["PR", "FO"] },
];

export const CATALOG_SORTS = {
  relevance: "Relevance",
  code: "Code",
  avg: "Average grade",
  fail: "Failure rate",
  ects: "ECTS",
} as const;
export type CatalogSort = keyof typeof CATALOG_SORTS;

export type CatalogFilters = {
  q: string;
  school: string | null;
  language: string | null;
  activity: string | null;
  /** Only entries with all regular dates on these weekdays (empty = any). */
  days: number[];
  ects: "any" | "small" | "medium" | "large";
  withGrades: boolean;
  bookmarked: boolean;
  sort: CatalogSort;
};

export const DEFAULT_FILTERS: CatalogFilters = {
  q: "",
  school: null,
  language: null,
  activity: null,
  days: [],
  ects: "any",
  withGrades: false,
  bookmarked: false,
  sort: "relevance",
};

export const normalizeText = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss");

/** 0 = no match; higher = better. */
export function matchScore(entry: CatalogEntry, query: string): number {
  const q = normalizeText(query.trim());
  if (!q) return 1;
  const code = entry.key.toLowerCase();
  if (code === q) return 100;
  if (code.startsWith(q)) return 80;
  const title = normalizeText(entry.title);
  const titleDe = entry.titleDe ? normalizeText(entry.titleDe) : "";
  const words = q.split(/\s+/).filter(Boolean);
  if (title.startsWith(q) || titleDe.startsWith(q)) return 60;
  if (words.every((w) => title.includes(w) || titleDe.includes(w) || code.includes(w))) {
    return words.every((w) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(`${title} ${titleDe}`)) ? 40 : 20;
  }
  return 0;
}

export function filterCatalog(entries: CatalogEntry[], f: CatalogFilters, bookmarks: Set<string> = new Set()): CatalogEntry[] {
  const activityCodes = f.activity ? new Set(ACTIVITY_GROUPS.find((a) => a.value === f.activity)?.codes ?? []) : null;
  const scored: { e: CatalogEntry; score: number }[] = [];
  for (const e of entries) {
    if (f.school && e.school !== f.school) continue;
    if (f.language && !e.languages.includes(f.language)) continue;
    if (activityCodes && !e.activities.some((a) => activityCodes.has(a))) continue;
    if (f.days.length && (e.days.length === 0 || e.days.some((d) => !f.days.includes(d)))) continue;
    if (f.ects === "small" && !(e.ects !== null && e.ects <= 3)) continue;
    if (f.ects === "medium" && !(e.ects !== null && e.ects > 3 && e.ects <= 6)) continue;
    if (f.ects === "large" && !(e.ects !== null && e.ects > 6)) continue;
    if (f.withGrades && e.avg === null) continue;
    if (f.bookmarked && !bookmarks.has(e.key)) continue;
    const score = matchScore(e, f.q);
    if (score > 0) scored.push({ e, score });
  }
  const nullsLast = (a: number | null, b: number | null, dir = 1) =>
    a === null ? (b === null ? 0 : 1) : b === null ? -1 : (a - b) * dir;
  const byCode = (a: CatalogEntry, b: CatalogEntry) => a.key.localeCompare(b.key, undefined, { numeric: true });
  scored.sort((a, b) => {
    switch (f.sort) {
      case "code":
        return byCode(a.e, b.e);
      case "avg":
        return nullsLast(a.e.avg, b.e.avg) || byCode(a.e, b.e);
      case "fail":
        return nullsLast(a.e.fail, b.e.fail) || byCode(a.e, b.e);
      case "ects":
        return nullsLast(a.e.ects, b.e.ects, -1) || byCode(a.e, b.e);
      default:
        // Modules before standalone courses, then by match quality and code.
        return (
          b.score - a.score ||
          Number(a.e.key.startsWith(COURSE_KEY_PREFIX)) - Number(b.e.key.startsWith(COURSE_KEY_PREFIX)) ||
          byCode(a.e, b.e)
        );
    }
  });
  return scored.map((s) => s.e);
}

/** Filters ⇄ URL search params (only non-default values are written). */
export function filtersToParams(f: CatalogFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.school) p.set("school", f.school);
  if (f.language) p.set("lang", f.language);
  if (f.activity) p.set("type", f.activity);
  if (f.days.length) p.set("days", f.days.join(""));
  if (f.ects !== "any") p.set("ects", f.ects);
  if (f.withGrades) p.set("grades", "1");
  if (f.bookmarked) p.set("saved", "1");
  if (f.sort !== "relevance") p.set("sort", f.sort);
  return p;
}

export function filtersFromParams(p: URLSearchParams): CatalogFilters {
  const sort = p.get("sort");
  const ects = p.get("ects");
  return {
    q: p.get("q") ?? "",
    school: p.get("school"),
    language: p.get("lang"),
    activity: p.get("type"),
    days: [...new Set((p.get("days") ?? "").split("").map(Number).filter((d) => d >= 1 && d <= 7))].sort(),
    ects: ects === "small" || ects === "medium" || ects === "large" ? ects : "any",
    withGrades: p.get("grades") === "1",
    bookmarked: p.get("saved") === "1",
    sort: sort && sort in CATALOG_SORTS ? (sort as CatalogSort) : "relevance",
  };
}
