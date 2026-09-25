import "./load-env";

import { parseArgs } from "node:util";

import { fetchJson, fetchText } from "@/importers/planner/http";
import {
  planningSemester,
  selectCandidateCourses,
  toNatSemesterKey,
  type CourseListItem,
} from "@/importers/planner/match";
import { NAT_API, parseNatCourse, parseNatModule, type Course, type ModuleDescription } from "@/importers/planner/nat";
import { PROGRAMS } from "@/importers/planner/programs";
import { parseCitStudyPlanPage, type StudyPlan } from "@/importers/planner/study-plan";
import { parseSemester } from "@/lib/stats/semester";

const USAGE = `Import study plans, module handbook details and course schedules for the planner.

Usage: npm run import:planner -- [--program <slug>] [--semester 2026WS] [--skip-modules] [--skip-courses] [--dry-run]

  --program       only this program (${PROGRAMS.map((p) => p.slug).join(", ")})
  --semester      semester whose courses/tutorial dates to import (default: ${planningSemester()})
  --skip-modules  don't refresh module handbook details
  --skip-courses  don't import courses and dates
  --dry-run       fetch and parse, but don't write to the database

The NAT API can take up to a minute for large modules; a full run takes ~10–15 minutes.
Sources: CIT "Studienplan" pages and the public TUM NAT API. Requests are rate-limited.`;

async function main() {
  const { values } = parseArgs({
    options: {
      program: { type: "string" },
      semester: { type: "string" },
      "skip-modules": { type: "boolean", default: false },
      "skip-courses": { type: "boolean", default: false },
      "dry-run": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });
  if (values.help) return console.log(USAGE);

  const semester = values.semester ? parseSemester(values.semester) : planningSemester();
  if (!semester) throw new Error(`Invalid semester "${values.semester}"`);
  const selected = PROGRAMS.filter((p) => !values.program || p.slug === values.program);
  if (selected.length === 0) throw new Error(`Unknown program "${values.program}"`);
  const dryRun = values["dry-run"];

  const store = dryRun ? null : await import("@/importers/planner/store");
  const dbModule = dryRun ? null : await import("@/db");

  try {
    // 1. Study plans ------------------------------------------------------------------------
    const allPlans: StudyPlan[] = [];
    for (const program of selected) {
      const { plans, warnings } = parseCitStudyPlanPage(await fetchText(program.studyPlanUrl));
      warnings.forEach((w) => console.warn(`  ${program.slug}: ${w}`));
      console.log(`${program.degree} ${program.nameEn}: ${plans.length} study plans`);
      allPlans.push(...plans);
      if (store && dbModule) await store.saveProgramPlans(dbModule.db, program, plans);
    }
    const codes = [
      ...new Set(allPlans.flatMap((p) => p.semesters.flatMap((s) => s.entries.map((e) => e.moduleCode)))),
    ].filter((c): c is string => !!c);
    console.log(`${codes.length} distinct modules in these plans`);

    // 2. Module handbook -----------------------------------------------------------------------
    const descriptions: ModuleDescription[] = [];
    if (!values["skip-modules"]) {
      let missing = 0;
      for (const [i, code] of codes.entries()) {
        let raw: unknown;
        try {
          raw = await fetchJson(`${NAT_API}/mhb/module/${encodeURIComponent(code)}`, { timeoutMs: 90_000 });
        } catch (err) {
          console.warn(`  ${code}: ${String(err)} — skipped`);
          missing++;
          continue;
        }
        if (!raw) {
          missing++;
          continue;
        }
        const desc = parseNatModule(raw);
        descriptions.push(desc);
        if (store && dbModule) await store.saveModuleDescription(dbModule.db, desc);
        if ((i + 1) % 20 === 0) console.log(`  modules ${i + 1}/${codes.length}`);
      }
      console.log(`Module handbook: ${descriptions.length} saved, ${missing} not found`);
    }

    // 3. Courses, tutorial groups and dates -----------------------------------------------------
    if (!values["skip-courses"]) {
      const key = toNatSemesterKey(semester);
      const list: CourseListItem[] = [];
      for (let offset: number | null = 0; offset !== null; ) {
        const page: { hits: CourseListItem[]; next_offset: number | null } | null = await fetchJson(
          `${NAT_API}/course?semester_key=${key}&limit=100&offset=${offset}`,
        );
        if (!page) break;
        list.push(...page.hits);
        offset = page.next_offset;
      }
      const refs = codes.map((code) => {
        const d = descriptions.find((x) => x.moduleCode === code);
        const planTitle = allPlans.flatMap((p) => p.semesters.flatMap((s) => s.entries)).find((e) => e.moduleCode === code)?.title;
        return { code, titleDe: d?.titleDe ?? planTitle, titleEn: d?.titleEn };
      });
      const candidates = selectCandidateCourses(list, refs);
      console.log(`${semester}: ${list.length} courses in the catalog, ${candidates.length} candidates`);

      const codeSet = new Set(codes);
      const found: Course[] = [];
      for (const [i, id] of candidates.entries()) {
        let raw: unknown;
        try {
          raw = await fetchJson(`${NAT_API}/course/${id}`, { timeoutMs: 90_000 });
        } catch (err) {
          console.warn(`  course ${id}: ${String(err)} — skipped`);
          continue;
        }
        if (!raw) continue;
        const course = parseNatCourse(raw);
        if (course.moduleCodes.some((c) => codeSet.has(c))) found.push(course);
        if ((i + 1) % 25 === 0) console.log(`  courses ${i + 1}/${candidates.length}`);
      }
      console.log(`${found.length} courses belong to planned modules`);
      if (store && dbModule) {
        const res = await store.saveSemesterCourses(dbModule.db, semester, found, codes);
        console.log(`Saved ${res.courses} courses, ${res.groups} groups, ${res.events} dates (${res.removed} replaced).`);
      }
    }
    if (dryRun) console.log("Dry run — database not modified.");
  } finally {
    await dbModule?.pgClient.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
