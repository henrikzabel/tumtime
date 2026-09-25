import { and, eq, inArray, sql } from "drizzle-orm";

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
      const values = {
        semester: c.semester,
        titleDe: c.titleDe,
        titleEn: c.titleEn,
        activity: c.activity,
        activityName: c.activityName,
        hoursPerWeek: c.hoursPerWeek,
        languages: c.languages,
        tumonlineUrl: c.tumonlineUrl,
        fetchedAt: new Date(),
      };
      await tx.insert(courses).values({ id: c.id, ...values }).onConflictDoUpdate({ target: courses.id, set: values });
      await tx.delete(courseModules).where(eq(courseModules.courseId, c.id));
      await tx.delete(courseGroups).where(eq(courseGroups.courseId, c.id));
      if (c.moduleCodes.length) {
        await tx.insert(courseModules).values(c.moduleCodes.map((moduleCode) => ({ courseId: c.id, moduleCode })));
      }
      for (const g of c.groups) {
        await tx.insert(courseGroups).values({ id: g.id, courseId: c.id, name: g.name, maxStudents: g.maxStudents });
        groupCount++;
        const events = g.events.map((e) => ({
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
        for (let i = 0; i < events.length; i += 500) {
          await tx.insert(courseEvents).values(events.slice(i, i + 500)).onConflictDoNothing();
        }
        eventCount += events.length;
      }
    }
    return { courses: list.length, groups: groupCount, events: eventCount, removed: stale.length };
  });
}
