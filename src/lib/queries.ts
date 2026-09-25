import "server-only";

import { and, asc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { departments, exams, gradeCounts, moduleNames, modules, schools } from "@/db/schema";
import type { ExamType } from "@/lib/stats/exam-record";

/** Exams with fewer attempts than this only show aggregates, never the distribution. */
export const MIN_ATTEMPTS_FOR_DISTRIBUTION = 5;

const hasPublishedExam = sql`exists (select 1 from ${exams} e where e.module_id = ${modules.id} and e.status = 'published')`;

export type SearchHit = { code: string; nameEn: string | null; nameDe: string | null; ects: number | null };

/** Fuzzy module search by number or (current or former) name, backed by pg_trgm. */
export async function searchModules(query: string, limit = 8): Promise<SearchHit[]> {
  const q = query.trim().slice(0, 100);
  if (q.length < 2) return [];
  const prefix = `${q.replace(/[\\%_]/g, "\\$&")}%`;
  const contains = `%${q.replace(/[\\%_]/g, "\\$&")}%`;

  const nameMatch = sql`(
    ${modules.nameEn} ilike ${contains} or ${modules.nameDe} ilike ${contains}
    or ${q} <% coalesce(${modules.nameEn}, '') or ${q} <% coalesce(${modules.nameDe}, '')
    or exists (select 1 from ${moduleNames} mn where mn.module_id = ${modules.id} and (mn.name ilike ${contains} or ${q} <% mn.name))
  )`;
  const score = sql<number>`greatest(
    similarity(${modules.code}, ${q}),
    word_similarity(${q}, coalesce(${modules.nameEn}, '')),
    word_similarity(${q}, coalesce(${modules.nameDe}, ''))
  )`;

  return db
    .select({ code: modules.code, nameEn: modules.nameEn, nameDe: modules.nameDe, ects: modules.ects })
    .from(modules)
    .where(and(hasPublishedExam, sql`(${modules.code} ilike ${prefix} or ${nameMatch})`))
    .orderBy(sql`(${modules.code} ilike ${prefix}) desc`, sql`${score} desc`, asc(modules.code))
    .limit(limit);
}

export type ExamWithGrades = {
  id: number;
  semester: string;
  semesterKey: number;
  type: ExamType;
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
  sources: string[];
  grades: Record<string, number>;
};

export async function getModuleDetail(code: string) {
  const [mod] = await db
    .select({
      id: modules.id,
      code: modules.code,
      nameEn: modules.nameEn,
      nameDe: modules.nameDe,
      ects: modules.ects,
      departmentName: departments.nameEn,
      departmentCode: departments.code,
      schoolName: schools.nameEn,
      schoolCode: schools.code,
    })
    .from(modules)
    .leftJoin(departments, eq(departments.id, modules.departmentId))
    .leftJoin(schools, eq(schools.id, modules.schoolId))
    .where(eq(modules.code, code.toUpperCase()));
  if (!mod) return null;

  const [examRows, names] = await Promise.all([
    db
      .select()
      .from(exams)
      .where(and(eq(exams.moduleId, mod.id), eq(exams.status, "published")))
      .orderBy(asc(exams.semesterKey), asc(exams.type)),
    db.select().from(moduleNames).where(eq(moduleNames.moduleId, mod.id)).orderBy(asc(moduleNames.firstSemester)),
  ]);
  if (examRows.length === 0) return null;

  const counts = await db
    .select()
    .from(gradeCounts)
    .where(inArray(gradeCounts.examId, examRows.map((e) => e.id)));
  const byExam = new Map<number, Record<string, number>>();
  for (const c of counts) {
    const g = byExam.get(c.examId) ?? {};
    g[c.grade] = c.count;
    byExam.set(c.examId, g);
  }

  const examList: ExamWithGrades[] = examRows.map((e) => ({
    id: e.id,
    semester: e.semester,
    semesterKey: e.semesterKey,
    type: e.type,
    date: e.date,
    registered: e.registered,
    attempted: e.attempted,
    passed: e.passed,
    failed: e.failed,
    noShow: e.noShow,
    withdrawn: e.withdrawn,
    cheating: e.cheating,
    averageTotal: e.averageTotal,
    averagePassed: e.averagePassed,
    failureRate: e.failureRate,
    sources: e.sources,
    // Privacy: small exams never expose their distribution.
    grades: (e.attempted ?? 0) >= MIN_ATTEMPTS_FOR_DISTRIBUTION ? (byExam.get(e.id) ?? {}) : {},
  }));

  return { module: mod, exams: examList, formerNames: names.filter((n) => n.name !== mod.nameEn && n.name !== mod.nameDe) };
}

export const BROWSE_SORTS = {
  "failure-desc": "Highest failure rate",
  "failure-asc": "Lowest failure rate",
  "average-asc": "Best average grade",
  "average-desc": "Worst average grade",
  "attempts-desc": "Most participants",
  "recent-desc": "Most recent exam",
  "code-asc": "Module number",
} as const;
export type BrowseSort = keyof typeof BROWSE_SORTS;

export type BrowseFilters = {
  school?: string;
  department?: string;
  type?: ExamType;
  sort?: BrowseSort;
  page?: number;
};

export const BROWSE_PAGE_SIZE = 50;

/** Modules with statistics aggregated over all their published exams (weighted by attempts). */
export async function browseModules(filters: BrowseFilters) {
  const sort = filters.sort ?? "failure-desc";
  const page = Math.max(1, filters.page ?? 1);

  const examFilter = filters.type ? sql`and e.type = ${filters.type}` : sql``;
  const where = [
    filters.school ? sql`s.code = ${filters.school}` : undefined,
    filters.department ? sql`d.code = ${filters.department}` : undefined,
  ].filter(Boolean);

  const orderBy = {
    "failure-desc": sql`failure_rate desc nulls last`,
    "failure-asc": sql`failure_rate asc nulls last`,
    "average-asc": sql`average_total asc nulls last`,
    "average-desc": sql`average_total desc nulls last`,
    "attempts-desc": sql`attempted desc nulls last`,
    "recent-desc": sql`latest_key desc`,
    "code-asc": sql`m.code asc`,
  }[sort];

  const rows = await db.execute<{
    code: string;
    name_en: string | null;
    ects: string | null;
    department: string | null;
    school: string | null;
    exam_count: number;
    attempted: number | null;
    average_total: string | null;
    failure_rate: string | null;
    latest_semester: string;
    latest_key: number;
    total: number;
  }>(sql`
    with agg as (
      select e.module_id,
        count(*)::int as exam_count,
        sum(e.attempted)::int as attempted,
        sum(e.average_total * e.attempted) filter (where e.average_total is not null and e.attempted > 0)
          / nullif(sum(e.attempted) filter (where e.average_total is not null and e.attempted > 0), 0) as average_total,
        sum(e.failure_rate * e.attempted) filter (where e.failure_rate is not null and e.attempted > 0)
          / nullif(sum(e.attempted) filter (where e.failure_rate is not null and e.attempted > 0), 0) as failure_rate,
        max(e.semester_key) as latest_key,
        (array_agg(e.semester order by e.semester_key desc))[1] as latest_semester
      from ${exams} e
      where e.status = 'published' ${examFilter}
      group by e.module_id
    )
    select m.code, m.name_en, m.ects::text, d.name_en as department, s.code as school,
      agg.exam_count, agg.attempted, agg.average_total::text, agg.failure_rate::text,
      agg.latest_semester, agg.latest_key, count(*) over ()::int as total
    from agg
    join ${modules} m on m.id = agg.module_id
    left join ${departments} d on d.id = m.department_id
    left join ${schools} s on s.id = m.school_id
    ${where.length ? sql`where ${sql.join(where as ReturnType<typeof sql>[], sql` and `)}` : sql``}
    order by ${orderBy}, m.code
    limit ${BROWSE_PAGE_SIZE} offset ${(page - 1) * BROWSE_PAGE_SIZE}
  `);

  const list = [...rows];
  return {
    total: list[0]?.total ?? 0,
    page,
    rows: list.map((r) => ({
      code: r.code,
      nameEn: r.name_en,
      ects: r.ects === null ? null : Number(r.ects),
      department: r.department,
      school: r.school,
      examCount: r.exam_count,
      attempted: r.attempted,
      averageTotal: r.average_total === null ? null : Number(r.average_total),
      failureRate: r.failure_rate === null ? null : Number(r.failure_rate),
      latestSemester: r.latest_semester,
    })),
  };
}

export async function listSchoolsWithDepartments() {
  const rows = await db
    .select({
      schoolCode: schools.code,
      schoolName: schools.nameEn,
      deptCode: departments.code,
      deptName: departments.nameEn,
    })
    .from(schools)
    .leftJoin(departments, eq(departments.schoolId, schools.id))
    .orderBy(asc(schools.nameEn), asc(departments.nameEn));
  const map = new Map<string, { code: string; name: string; departments: { code: string; name: string }[] }>();
  for (const r of rows) {
    const s = map.get(r.schoolCode) ?? { code: r.schoolCode, name: r.schoolName, departments: [] };
    if (r.deptCode && r.deptName) s.departments.push({ code: r.deptCode, name: r.deptName });
    map.set(r.schoolCode, s);
  }
  return [...map.values()];
}
