import "server-only";

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";

import { db } from "@/db";
import { courseModules, courses, departments, moduleDescriptions, modules, schools } from "@/db/schema";
import { getTimetableCourses, type TimetableCourse } from "@/lib/planner/queries";
import { parseSemester, semesterKey, type Semester } from "@/lib/stats/semester";

import { courseKey, parseEntryKey, schoolShort, type CatalogEntry } from "./entries";

/** Semesters that have imported courses, newest first. */
export const getCatalogSemesters = unstable_cache(
  async (): Promise<Semester[]> => {
    const rows = await db.selectDistinct({ semester: courses.semester }).from(courses);
    return rows
      .map((r) => parseSemester(r.semester))
      .filter((s): s is Semester => s !== null)
      .sort((a, b) => semesterKey(b) - semesterKey(a));
  },
  ["catalog-semesters"],
  { revalidate: 3600, tags: ["catalog"] },
);

type IndexRow = {
  key: string;
  title_en: string | null;
  title_de: string | null;
  ects: number | string | null;
  school: string | null;
  languages: string[] | null;
  activities: string[] | null;
  days: number[] | null;
  avg: number | string | null;
  fail: number | string | null;
};

const num = (v: number | string | null) => (v === null ? null : Number(v));

/** Everything the catalog list needs for one semester (a few hundred KB, cached). */
export const getCatalogIndex = unstable_cache(
  async (semester: string): Promise<CatalogEntry[]> => {
    const rows = (await db.execute(sql`
      with sem as (
        select c.*, cm.module_code
        from courses c left join course_modules cm on cm.course_id = c.id
        where c.semester = ${semester}
      ),
      entries as (
        select coalesce(module_code, 'C_' || id::text) as key, id as course_id, title_en, title_de,
               school_name, languages, activity
        from sem
      ),
      days as (
        select coalesce(cm.module_code, 'C_' || c.id::text) as key,
               array_agg(distinct extract(isodow from e.starts_at at time zone 'Europe/Berlin')::int) as days
        from course_events e
        join course_groups g on g.id = e.group_id
        join courses c on c.id = g.course_id and c.semester = ${semester}
        left join course_modules cm on cm.course_id = c.id
        where (e.type is null or e.type = 'REGULAR') and not e.canceled
        group by 1
      ),
      langs as (
        select e.key, array_agg(distinct upper(l)) as languages
        from entries e, unnest(e.languages) as l
        group by e.key
      ),
      grades as (
        select distinct on (m.code) m.code, x.average_total, x.failure_rate
        from exams x join modules m on m.id = x.module_id
        where x.status = 'published'
        order by m.code, (x.type = 'endterm') desc, x.semester_key desc
      )
      select e.key,
             coalesce(m.name_en, min(e.title_en), min(e.title_de)) as title_en,
             coalesce(m.name_de, min(e.title_de)) as title_de,
             m.ects,
             mode() within group (order by e.school_name) as school,
             la.languages,
             array_remove(array_agg(distinct e.activity), null) as activities,
             d.days, g.average_total as avg, g.failure_rate as fail
      from entries e
      left join modules m on m.code = e.key
      left join days d on d.key = e.key
      left join grades g on g.code = e.key
      left join langs la on la.key = e.key
      group by e.key, m.name_en, m.name_de, m.ects, d.days, g.average_total, g.failure_rate, la.languages
    `)) as unknown as IndexRow[];

    return rows.map((r) => ({
      key: r.key,
      title: r.title_en ?? r.title_de ?? r.key,
      titleDe: r.title_de && r.title_de !== r.title_en ? r.title_de : null,
      ects: num(r.ects),
      school: schoolShort(r.school),
      languages: (r.languages ?? []).map((l) => l.toUpperCase()).sort(),
      activities: r.activities ?? [],
      days: (r.days ?? []).sort(),
      avg: num(r.avg),
      fail: num(r.fail),
    }));
  },
  ["catalog-index"],
  { revalidate: 3600, tags: ["catalog"] },
);

export type CatalogCourseInfo = {
  id: number;
  title: string;
  activity: string | null;
  activityName: string | null;
  hoursPerWeek: number | null;
  languages: string[];
  description: string | null;
  teachingMethod: string | null;
  orgName: string | null;
  schoolName: string | null;
  tumonlineUrl: string | null;
};

export type CatalogDetail = {
  key: string;
  kind: "module" | "course";
  semester: Semester;
  title: string;
  titleDe: string | null;
  ects: number | null;
  school: string | null;
  department: string | null;
  description: {
    content: string | null;
    outcome: string | null;
    precondition: string | null;
    exam: string | null;
    cycle: string | null;
    level: string | null;
    languages: string[];
    organisation: string | null;
  } | null;
  courses: CatalogCourseInfo[];
  /** Courses with groups and regular dates (for the Sections tab). */
  schedule: TimetableCourse[];
  /** Other semesters in which this entry is offered (modules only). */
  otherSemesters: Semester[];
};

export async function getCatalogDetail(semester: Semester, rawKey: string): Promise<CatalogDetail | null> {
  const parsed = parseEntryKey(rawKey);
  if (!parsed) return null;

  let courseIds: number[];
  if (parsed.kind === "course") {
    courseIds = [parsed.courseId];
  } else {
    const links = await db
      .select({ id: courseModules.courseId })
      .from(courseModules)
      .innerJoin(courses, eq(courses.id, courseModules.courseId))
      .where(and(eq(courseModules.moduleCode, parsed.code), eq(courses.semester, semester)));
    courseIds = links.map((l) => l.id);
  }
  const courseRows = courseIds.length
    ? await db.select().from(courses).where(and(inArray(courses.id, courseIds), eq(courses.semester, semester)))
    : [];

  const [mod] =
    parsed.kind === "module"
      ? await db
          .select({
            code: modules.code,
            nameEn: modules.nameEn,
            nameDe: modules.nameDe,
            ects: modules.ects,
            department: departments.nameEn,
            school: schools.nameEn,
            desc: moduleDescriptions,
          })
          .from(modules)
          .leftJoin(departments, eq(departments.id, modules.departmentId))
          .leftJoin(schools, eq(schools.id, modules.schoolId))
          .leftJoin(moduleDescriptions, eq(moduleDescriptions.moduleId, modules.id))
          .where(eq(modules.code, parsed.code))
      : [];
  if (courseRows.length === 0 && !mod) return null;

  const key = parsed.kind === "module" ? parsed.code : courseKey(parsed.courseId);
  const [schedule, otherSemesters] = await Promise.all([
    parsed.kind === "module" ? getTimetableCourses(semester, [parsed.code]) : getTimetableCourses(semester, [], [parsed.courseId]),
    parsed.kind === "module"
      ? db
          .selectDistinct({ semester: courses.semester })
          .from(courses)
          .innerJoin(courseModules, eq(courseModules.courseId, courses.id))
          .where(eq(courseModules.moduleCode, parsed.code))
          .orderBy(desc(courses.semester))
      : Promise.resolve([]),
  ]);

  const first = courseRows[0];
  const d = mod?.desc ?? null;
  return {
    key,
    kind: parsed.kind,
    semester,
    title: mod?.nameEn ?? mod?.nameDe ?? first?.titleEn ?? first?.titleDe ?? key,
    titleDe: (mod?.nameDe ?? first?.titleDe) !== (mod?.nameEn ?? first?.titleEn) ? (mod?.nameDe ?? first?.titleDe ?? null) : null,
    ects: mod?.ects ?? d?.credits ?? null,
    school: mod?.school ?? mostCommon(courseRows.map((c) => c.schoolName)),
    department: mod?.department ?? null,
    description: d
      ? {
          content: d.contentEn ?? d.contentDe,
          outcome: d.outcomeEn ?? d.outcomeDe,
          precondition: d.preconditionEn ?? d.preconditionDe,
          exam: d.examEn ?? d.examDe,
          cycle: d.cycle,
          level: d.level,
          languages: d.languages,
          organisation: d.organisation,
        }
      : null,
    courses: courseRows
      .map((c) => ({
        id: c.id,
        title: c.titleEn ?? c.titleDe ?? `Course ${c.id}`,
        activity: c.activity,
        activityName: c.activityName,
        hoursPerWeek: c.hoursPerWeek,
        languages: c.languages,
        description: c.description,
        teachingMethod: c.teachingMethod,
        orgName: c.orgName,
        schoolName: c.schoolName,
        tumonlineUrl: c.tumonlineUrl,
      }))
      .sort((a, b) => activityRank(a.activity) - activityRank(b.activity) || a.title.localeCompare(b.title)),
    schedule,
    otherSemesters: otherSemesters
      .map((r) => parseSemester(r.semester))
      .filter((s): s is Semester => s !== null && s !== semester),
  };
}

const ACTIVITY_ORDER = ["VO", "VI", "UE", "TT", "SE", "PR"];
const activityRank = (a: string | null) => (a && ACTIVITY_ORDER.includes(a) ? ACTIVITY_ORDER.indexOf(a) : 99);

function mostCommon(values: (string | null)[]): string | null {
  const counts = new Map<string, number>();
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}
