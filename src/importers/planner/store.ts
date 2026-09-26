import { and, eq, inArray, isNull, sql } from "drizzle-orm";

import type { Db } from "@/db";
import {
  courseEvents,
  courseGroups,
  courseModules,
  courses,
  departments,
  moduleDescriptions,
  modules,
  programs,
  schools,
  studyPlanEntries,
  studyPlans,
} from "@/db/schema";
import { resolveDepartment } from "@/lib/departments";

import type { Course, ModuleDescription } from "./nat";
import type { ProgramConfig } from "./programs";
import type { StudyPlan } from "./study-plan";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type DbLike = Db | Tx;

/** Upsert a program and replace all of its study plans with the freshly parsed ones. */
export async function saveProgramPlans(db: Db, program: ProgramConfig, plans: StudyPlan[]) {
  return db.transaction(async (tx) => {
    const [school] = await tx.select({ id: schools.id }).from(schools).where(eq(schools.code, program.schoolCode));
    const values = {
      studyId: program.studyId,
      slug: program.slug,
      nameDe: program.nameDe,
      nameEn: program.nameEn,
      degree: program.degree,
      schoolId: school?.id ?? null,
      sourceUrl: program.studyPlanUrl,
    };
    const [row] = await tx
      .insert(programs)
      .values(values)
      .onConflictDoUpdate({ target: programs.studyId, set: values })
      .returning({ id: programs.id });

    await tx.delete(studyPlans).where(eq(studyPlans.programId, row.id));
    for (const [i, plan] of plans.entries()) {
      const [sp] = await tx
        .insert(studyPlans)
        .values({
          programId: row.id,
          title: plan.title,
          startFrom: plan.startFrom,
          startUntil: plan.startUntil,
          tumonlineCurriculumId: plan.tumonlineCurriculumId,
          footnotes: plan.footnotes,
          requirements: plan.requirements,
          sort: i,
        })
        .returning({ id: studyPlans.id });
      const entries = plan.semesters.flatMap((s) =>
        s.entries.map((e, k) => ({
          studyPlanId: sp.id,
          semesterNo: s.number,
          kind: e.kind,
          moduleCode: e.moduleCode ?? null,
          title: e.title,
          credits: e.credits,
          area: e.area,
          markers: e.markers,
          alternativeGroup: e.alternativeGroup ?? null,
          sort: k,
        })),
      );
      if (entries.length) await tx.insert(studyPlanEntries).values(entries);
    }
    return { programId: row.id, plans: plans.length };
  });
}

/** Ensure a `modules` row exists (planner modules may have no exam statistics yet). */
async function ensureModule(db: DbLike, code: string, desc?: ModuleDescription) {
  const allDepartments = await db.select().from(departments);
  const dept = resolveDepartment(code, allDepartments);
  const [row] = await db
    .insert(modules)
    .values({
      code,
      nameEn: desc?.titleEn ?? null,
      nameDe: desc?.titleDe ?? null,
      ects: desc?.credits ?? null,
      departmentId: dept?.id ?? null,
      schoolId: dept?.schoolId ?? null,
    })
    .onConflictDoUpdate({
      target: modules.code,
      // Keep names from exam data if present; fill gaps from the module handbook.
      set: {
        nameEn: sql`coalesce(${modules.nameEn}, excluded.name_en)`,
        nameDe: sql`coalesce(excluded.name_de, ${modules.nameDe})`,
        ects: sql`coalesce(excluded.ects, ${modules.ects})`,
        departmentId: sql`coalesce(${modules.departmentId}, excluded.department_id)`,
        schoolId: sql`coalesce(${modules.schoolId}, excluded.school_id)`,
      },
    })
    .returning({ id: modules.id });
  return row.id;
}

export async function saveModuleDescription(db: Db, desc: ModuleDescription) {
  return db.transaction(async (tx) => {
    const moduleId = await ensureModule(tx, desc.moduleCode, desc);
    const values = {
      credits: desc.credits,
      cycle: desc.cycle,
      durationSemesters: desc.durationSemesters,
      languages: desc.languages,
      level: desc.level,
      examRepeat: desc.examRepeat,
      contentDe: desc.contentDe,
      contentEn: desc.contentEn,
      outcomeDe: desc.outcomeDe,
      outcomeEn: desc.outcomeEn,
      preconditionDe: desc.preconditionDe,
      preconditionEn: desc.preconditionEn,
      examDe: desc.examDe,
      examEn: desc.examEn,
      contactHours: desc.contactHours,
      organisation: desc.organisation,
      descriptionVersion: desc.descriptionVersion,
      fetchedAt: new Date(),
    };
    await tx
      .insert(moduleDescriptions)
      .values({ moduleId, ...values })
      .onConflictDoUpdate({ target: moduleDescriptions.moduleId, set: values });
    return moduleId;
  });
}

type DepartmentRow = typeof departments.$inferSelect;

/** Upsert `modules` rows for the modules a course belongs to (names/credits as listed on the course). */
async function ensureCourseModules(db: DbLike, course: Course, allDepartments: DepartmentRow[]) {
  for (const m of course.modules) {
    const dept = resolveDepartment(m.code, allDepartments);
    await db
      .insert(modules)
      .values({
        code: m.code,
        nameEn: m.titleEn,
        nameDe: m.titleDe,
        ects: m.credits,
        departmentId: dept?.id ?? null,
        schoolId: dept?.schoolId ?? null,
      })
      .onConflictDoUpdate({
        target: modules.code,
        set: {
          nameEn: sql`coalesce(${modules.nameEn}, excluded.name_en)`,
          nameDe: sql`coalesce(${modules.nameDe}, excluded.name_de)`,
          ects: sql`coalesce(${modules.ects}, excluded.ects)`,
          departmentId: sql`coalesce(${modules.departmentId}, excluded.department_id)`,
          schoolId: sql`coalesce(${modules.schoolId}, excluded.school_id)`,
        },
      });
  }
}

/** Write one course with its module links, groups and dates (replacing what was stored before). */
async function writeCourse(tx: Tx, c: Course) {
  const values = {
    semester: c.semester,
    titleDe: c.titleDe,
    titleEn: c.titleEn,
    activity: c.activity,
    activityName: c.activityName,
    hoursPerWeek: c.hoursPerWeek,
    languages: c.languages,
    tumonlineUrl: c.tumonlineUrl,
    description: c.description,
    teachingMethod: c.teachingMethod,
    orgCode: c.orgCode,
    orgName: c.orgName,
    schoolName: c.schoolName,
    modifiedAt: c.modifiedAt ? new Date(c.modifiedAt) : null,
    fetchedAt: new Date(),
  };
  await tx.insert(courses).values({ id: c.id, ...values }).onConflictDoUpdate({ target: courses.id, set: values });
  await tx.delete(courseModules).where(eq(courseModules.courseId, c.id));
  await tx.delete(courseGroups).where(eq(courseGroups.courseId, c.id));
  if (c.moduleCodes.length) {
    await tx.insert(courseModules).values(c.moduleCodes.map((moduleCode) => ({ courseId: c.id, moduleCode })));
  }
  let groups = 0;
  let events = 0;
  for (const g of c.groups) {
    // Group ids are unique in TUMonline; a group moved between courses is simply re-attached.
    await tx
      .insert(courseGroups)
      .values({ id: g.id, courseId: c.id, name: g.name, maxStudents: g.maxStudents })
      .onConflictDoUpdate({ target: courseGroups.id, set: { courseId: c.id, name: g.name, maxStudents: g.maxStudents } });
    groups++;
    const rows = g.events.map((e) => ({
      id: e.id,
      groupId: g.id,
      startsAt: new Date(e.start),
      endsAt: new Date(e.end),
      canceled: e.canceled,
      type: e.type,
      roomShort: e.room?.short ?? null,
      roomCode: e.room?.code ?? null,
      roomNavUrl: e.room?.navUrl ?? null,
      roomDescription: e.room?.description ?? null,
    }));
    for (let i = 0; i < rows.length; i += 500) {
      await tx.insert(courseEvents).values(rows.slice(i, i + 500)).onConflictDoNothing();
    }
    events += rows.length;
  }
  return { groups, events };
}

/** Save one course of the full catalog import (its own transaction, so a run can be resumed). */
export async function saveCatalogCourse(db: Db, course: Course, allDepartments: DepartmentRow[]) {
  return db.transaction(async (tx) => {
    await ensureCourseModules(tx, course, allDepartments);
    return writeCourse(tx, course);
  });
}

/** TUMonline "modified" timestamps of the stored courses of a semester, by course id. */
export async function storedCourseVersions(db: Db, semester: string): Promise<Map<number, number | null>> {
  const rows = await db.select({ id: courses.id, modifiedAt: courses.modifiedAt }).from(courses).where(eq(courses.semester, semester));
  return new Map(rows.map((r) => [r.id, r.modifiedAt?.getTime() ?? null]));
}

/** Delete stored courses of a semester that are no longer in the TUMonline catalog. */
export async function removeCourses(db: Db, ids: number[]) {
  for (let i = 0; i < ids.length; i += 500) await db.delete(courses).where(inArray(courses.id, ids.slice(i, i + 500)));
  return ids.length;
}

export async function loadDepartments(db: Db) {
  return db.select().from(departments);
}

/** Replace all stored courses of one semester that belong to the given module codes. */
export async function saveSemesterCourses(db: Db, semester: string, list: Course[], moduleCodes: string[]) {
  return db.transaction(async (tx) => {
    // Remove previously imported courses of this semester for these modules (they may be gone now).
    const stale = await tx
      .selectDistinct({ id: courses.id })
      .from(courses)
      .innerJoin(courseModules, eq(courseModules.courseId, courses.id))
      .where(and(eq(courses.semester, semester), inArray(courseModules.moduleCode, moduleCodes)));
    if (stale.length) await tx.delete(courses).where(inArray(courses.id, stale.map((s) => s.id)));

    let groupCount = 0;
    let eventCount = 0;
    for (const c of list) {
      const res = await writeCourse(tx, c);
      groupCount += res.groups;
      eventCount += res.events;
    }
    return { courses: list.length, groups: groupCount, events: eventCount, removed: stale.length };
  });
}

/** Module codes taught in a semester that have no module handbook entry yet. */
export async function modulesWithoutDescription(db: Db, semester: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ code: courseModules.moduleCode })
    .from(courseModules)
    .innerJoin(courses, eq(courses.id, courseModules.courseId))
    .leftJoin(modules, eq(modules.code, courseModules.moduleCode))
    .leftJoin(moduleDescriptions, eq(moduleDescriptions.moduleId, modules.id))
    .where(and(eq(courses.semester, semester), isNull(moduleDescriptions.moduleId)));
  return rows.map((r) => r.code).sort();
}
