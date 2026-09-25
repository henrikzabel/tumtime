import { z } from "zod";

import { examRecordSchema, type ExamRecord } from "@/lib/stats/exam-record";
import { normalizeGrade } from "@/lib/stats/grades";
import { parseSemester } from "@/lib/stats/semester";
import { decodeHtmlEntities } from "@/lib/text";

/**
 * Importer for the public TUM Info API (https://mcmikecreations.github.io/tum_info/api/courses.json).
 * The repository is GPL-3.0; every record is tagged with source "tum_info" so it can be removed.
 *
 * Special grade codes in this dataset (verified against its own totals):
 *   6.0 → no-show ("X Nicht erschienen"): peopleTotal − attemptsTotal equals its count
 *   7.0 → "B" passed (pass/fail exams)
 *   8.0 → "N" failed: attemptsFailedPercent only matches when 8.0 is counted as a failed attempt
 */
export const TUM_INFO_URL = "https://raw.githubusercontent.com/mcmikecreations/tum_info/gh-pages/api/courses.json";

const tumInfoCourseSchema = z.object({
  school: z.string().optional(),
  code: z.string(),
  semester: z.string(),
  examType: z.string(),
  name: z.string().optional(),
  date: z.string().optional(),
  ects: z.number().optional(),
  peopleTotal: z.number().optional(),
  attemptsTotal: z.number().optional(),
  averageTotal: z.number().optional(),
  averagePassed: z.number().optional(),
  attemptsFailedPercent: z.number().optional(),
  grades: z.array(z.object({ grade: z.number(), people: z.number() })),
});
export type TumInfoCourse = z.infer<typeof tumInfoCourseSchema>;

const SPECIAL_CODES: Record<number, "noShow" | "B" | "N"> = { 6: "noShow", 7: "B", 8: "N" };

export type ParseIssue = { index: number; key?: string; message: string };
export type ParseResult = { records: ExamRecord[]; issues: ParseIssue[] };

export function parseTumInfoCourse(raw: unknown): ExamRecord {
  const c = tumInfoCourseSchema.parse(raw);
  const semester = parseSemester(c.semester);
  if (!semester) throw new Error(`Unknown semester "${c.semester}"`);
  const type = c.examType.toLowerCase();
  if (type !== "endterm" && type !== "retake") throw new Error(`Unknown exam type "${c.examType}"`);

  const grades: Record<string, number> = {};
  let noShow: number | undefined;
  for (const { grade, people } of c.grades) {
    const special = SPECIAL_CODES[grade];
    if (special === "noShow") {
      noShow = (noShow ?? 0) + people;
      continue;
    }
    const g = special ?? normalizeGrade(grade);
    if (!g) throw new Error(`Unknown grade ${grade}`);
    if (people > 0) grades[g] = (grades[g] ?? 0) + people;
  }

  return examRecordSchema.parse({
    moduleCode: c.code.trim().toUpperCase(),
    moduleName: c.name ? decodeHtmlEntities(c.name).trim() || undefined : undefined,
    moduleNameLang: c.name ? "en" : undefined,
    ects: c.ects && c.ects > 0 ? c.ects : undefined,
    semester,
    type,
    date: c.date ? /^\d{4}-\d{2}-\d{2}/.exec(c.date)?.[0] : undefined,
    registered: c.peopleTotal,
    attempted: c.attemptsTotal,
    noShow,
    averageTotal: c.averageTotal,
    averagePassed: c.averagePassed,
    failureRate: c.attemptsFailedPercent,
    grades,
  }) as ExamRecord;
}

/** Parse the whole courses.json payload; invalid entries are reported, not fatal. */
export function parseTumInfo(payload: unknown): ParseResult {
  if (!Array.isArray(payload)) throw new Error("TUM Info payload must be a JSON array");
  const records: ExamRecord[] = [];
  const issues: ParseIssue[] = [];
  payload.forEach((raw, index) => {
    try {
      records.push(parseTumInfoCourse(raw));
    } catch (err) {
      const r = raw as Partial<TumInfoCourse>;
      issues.push({
        index,
        key: r?.code ? `${r.code}/${r.semester}/${r.examType}` : undefined,
        message: err instanceof z.ZodError ? z.prettifyError(err) : String(err),
      });
    }
  });
  return { records, issues };
}
