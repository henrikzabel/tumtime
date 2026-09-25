import "server-only";

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  courseEvents,
  courseGroups,
  courseModules,
  courses,
  exams,
  moduleDescriptions,
  modules,
  programs,
  studyPlanEntries,
  studyPlans,
} from "@/db/schema";

import type { ModuleCycle, StudyPlanData } from "./plan";

export async function listPrograms() {
  return db
    .select({
      slug: programs.slug,
      nameEn: programs.nameEn,
      nameDe: programs.nameDe,
      degree: programs.degree,
      plans: sql<number>`(select count(*)::int from ${studyPlans} sp where sp.program_id = ${programs.id})`,
    })
    .from(programs)
    .orderBy(asc(programs.nameEn));
}

export async function getProgram(slug: string) {
  const [program] = await db.select().from(programs).where(eq(programs.slug, slug));
  if (!program) return null;
  const plans = await db.select().from(studyPlans).where(eq(studyPlans.programId, program.id)).orderBy(asc(studyPlans.sort));
  const entries = plans.length
    ? await db
        .select()
        .from(studyPlanEntries)
        .where(inArray(studyPlanEntries.studyPlanId, plans.map((p) => p.id)))
        .orderBy(asc(studyPlanEntries.semesterNo), asc(studyPlanEntries.sort))
    : [];
  const studyPlanData: StudyPlanData[] = plans.map((p) => ({
    id: p.id,
    title: p.title,
    startFrom: p.startFrom,
    startUntil: p.startUntil,
    requirements: p.requirements as { area: string; credits: number }[],
    footnotes: p.footnotes,
    entries: entries
      .filter((e) => e.studyPlanId === p.id)
      .map((e) => ({
        semesterNo: e.semesterNo,
        kind: e.kind as "module" | "placeholder",
        moduleCode: e.moduleCode,
        title: e.title,
        credits: e.credits,
        area: e.area,
        alternativeGroup: e.alternativeGroup,
      })),
  }));
  return {
    program: {
      slug: program.slug,
      nameEn: program.nameEn,
      nameDe: program.nameDe,
      degree: program.degree,
      sourceUrl: program.sourceUrl,
    },
    plans: studyPlanData,
  };
}

export type PlannerModuleInfo = {
  code: string;
  nameEn: string | null;
  nameDe: string | null;
  credits: number | null;
  cycle: ModuleCycle;
  languages: string[];
  /** Latest published endterm (or any exam) statistics, if available. */
  stats: { semester: string; averageTotal: number | null; failureRate: number | null } | null;
};

/** Module names, credits, offering cycle and headline exam statistics for the planner cards. */
export async function getPlannerModuleInfos(codes: string[]): Promise<PlannerModuleInfo[]> {
  const unique = [...new Set(codes.map((c) => c.toUpperCase()))].slice(0, 300);
  if (unique.length === 0) return [];
  const rows = await db
    .select({
      id: modules.id,
      code: modules.code,
      nameEn: modules.nameEn,
      nameDe: modules.nameDe,
      ects: modules.ects,
      credits: moduleDescriptions.credits,
      cycle: moduleDescriptions.cycle,
      languages: moduleDescriptions.languages,
    })
    .from(modules)
    .leftJoin(moduleDescriptions, eq(moduleDescriptions.moduleId, modules.id))
    .where(inArray(modules.code, unique));

  const latest = rows.length
    ? await db
        .selectDistinctOn([exams.moduleId], {
          moduleId: exams.moduleId,
          semester: exams.semester,
          averageTotal: exams.averageTotal,
          failureRate: exams.failureRate,
        })
        .from(exams)
        .where(and(inArray(exams.moduleId, rows.map((r) => r.id)), eq(exams.status, "published")))
        .orderBy(exams.moduleId, sql`(${exams.type} = 'endterm') desc`, desc(exams.semesterKey))
    : [];
  const statsBy = new Map(latest.map((l) => [l.moduleId, l]));

  return rows.map((r) => {
    const s = statsBy.get(r.id);
    return {
      code: r.code,
      nameEn: r.nameEn,
      nameDe: r.nameDe,
      credits: r.credits ?? r.ects,
      cycle: (r.cycle as ModuleCycle) ?? null,
      languages: r.languages ?? [],
      stats: s ? { semester: s.semester, averageTotal: s.averageTotal, failureRate: s.failureRate } : null,
    };
  });
}

export type TimetableEvent = {
  courseId: number;
  groupId: number;
  groupName: string;
  start: string;
  end: string;
  canceled: boolean;
  room: string | null;
  roomUrl: string | null;
};

export type TimetableCourse = {
  id: number;
  title: string;
  activity: string | null;
  activityName: string | null;
  moduleCodes: string[];
  tumonlineUrl: string | null;
  groups: { id: number; name: string; maxStudents: number | null; events: TimetableEvent[] }[];
};

/** Courses (with groups and dates) of the given modules in one semester. */
export async function getTimetableCourses(semester: string, codes: string[]): Promise<TimetableCourse[]> {
  const unique = [...new Set(codes.map((c) => c.toUpperCase()))].slice(0, 60);
  if (unique.length === 0) return [];
  const links = await db
    .select({ courseId: courseModules.courseId, moduleCode: courseModules.moduleCode })
    .from(courseModules)
    .innerJoin(courses, eq(courses.id, courseModules.courseId))
    .where(and(eq(courses.semester, semester), inArray(courseModules.moduleCode, unique)));
  const ids = [...new Set(links.map((l) => l.courseId))];
  if (ids.length === 0) return [];

  const [courseRows, groupRows, eventRows] = await Promise.all([
    db.select().from(courses).where(inArray(courses.id, ids)),
    db.select().from(courseGroups).where(inArray(courseGroups.courseId, ids)),
    db
      .select({
        id: courseEvents.id,
        groupId: courseEvents.groupId,
        courseId: courseGroups.courseId,
        startsAt: courseEvents.startsAt,
        endsAt: courseEvents.endsAt,
        canceled: courseEvents.canceled,
        type: courseEvents.type,
        roomShort: courseEvents.roomShort,
        roomNavUrl: courseEvents.roomNavUrl,
      })
      .from(courseEvents)
      .innerJoin(courseGroups, eq(courseGroups.id, courseEvents.groupId))
      .where(inArray(courseGroups.courseId, ids))
      .orderBy(asc(courseEvents.startsAt)),
  ]);

  return courseRows
    .map((c) => ({
      id: c.id,
      title: c.titleEn ?? c.titleDe ?? `Course ${c.id}`,
      activity: c.activity,
      activityName: c.activityName,
      moduleCodes: links.filter((l) => l.courseId === c.id).map((l) => l.moduleCode),
      tumonlineUrl: c.tumonlineUrl,
      groups: groupRows
        .filter((g) => g.courseId === c.id)
        .map((g) => ({
          id: g.id,
          name: g.name,
          maxStudents: g.maxStudents,
          events: eventRows
            .filter((e) => e.groupId === g.id && (e.type === null || e.type === "REGULAR"))
            .map((e) => ({
              courseId: c.id,
              groupId: g.id,
              groupName: g.name,
              start: e.startsAt.toISOString(),
              end: e.endsAt.toISOString(),
              canceled: e.canceled,
              room: e.roomShort,
              roomUrl: e.roomNavUrl,
            })),
        }))
        .filter((g) => g.events.length > 0),
    }))
    .filter((c) => c.groups.length > 0)
    .sort((a, b) => a.moduleCodes[0].localeCompare(b.moduleCodes[0]) || (a.activity ?? "").localeCompare(b.activity ?? ""));
}
