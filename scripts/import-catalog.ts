import "./load-env";

import { parseArgs } from "node:util";

import { planCatalogSync, type CatalogListItem } from "@/importers/catalog/sync";
import { fetchJson } from "@/importers/planner/http";
import { planningSemester, toNatSemesterKey } from "@/importers/planner/match";
import { NAT_API, parseNatCourse, parseNatModule } from "@/importers/planner/nat";
import { parseSemester } from "@/lib/stats/semester";

const USAGE = `Import the full TUM course catalog of a semester (all courses, groups, dates, modules).

Usage: npm run import:catalog -- [--semester 2026WS] [--limit N] [--force] [--descriptions] [--dry-run]

  --semester      semester to import (default: ${planningSemester()})
  --limit         fetch at most N changed courses (useful for testing; run again to continue)
  --force         refetch every course, even if unchanged in TUMonline
  --descriptions  also fetch module handbook entries for modules that don't have one yet
  --dry-run       only report what would be fetched

The first run fetches every course (~6,000 requests, a few hours); later runs only fetch courses
that changed in TUMonline. The run can be interrupted and resumed at any time.
Source: the public TUM NAT API. Requests are rate-limited and never use credentials.`;

async function main() {
  const { values } = parseArgs({
    options: {
      semester: { type: "string" },
      limit: { type: "string" },
      force: { type: "boolean", default: false },
      descriptions: { type: "boolean", default: false },
      "dry-run": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });
  if (values.help) return console.log(USAGE);
  const semester = values.semester ? parseSemester(values.semester) : planningSemester();
  if (!semester) throw new Error(`Invalid semester "${values.semester}"`);
  const limit = values.limit ? Number(values.limit) : Infinity;

  const { db, pgClient } = await import("@/db");
  const store = await import("@/importers/planner/store");
  try {
    // 1. Course list (cheap) --------------------------------------------------------------------
    const key = toNatSemesterKey(semester);
    const list: CatalogListItem[] = [];
    for (let offset: number | null = 0; offset !== null; ) {
      const page: { hits: CatalogListItem[]; next_offset: number | null; total_count?: number } | null = await fetchJson(
        `${NAT_API}/course?semester_key=${key}&limit=100&offset=${offset}`,
        { timeoutMs: 90_000 },
      );
      if (!page) break;
      list.push(...page.hits);
      offset = page.next_offset;
      if (list.length % 1000 < 100) console.log(`  listed ${list.length}/${page.total_count ?? "?"}`);
    }
    if (list.length === 0) throw new Error(`No courses listed for ${semester} — refusing to touch the database.`);

    const plan = planCatalogSync(list, await store.storedCourseVersions(db, semester), { force: values.force });
    const todo = plan.fetch.slice(0, limit);
    console.log(
      `${semester}: ${list.length} courses listed · ${plan.unchanged} unchanged · ${plan.fetch.length} to fetch` +
        (todo.length < plan.fetch.length ? ` (limited to ${todo.length})` : "") +
        ` · ${plan.remove.length} to remove`,
    );
    if (values["dry-run"]) return console.log("Dry run — database not modified.");

    // 2. Details of new/changed courses (one request each) ----------------------------------------
    const allDepartments = await store.loadDepartments(db);
    let saved = 0;
    let failed = 0;
    const started = Date.now();
    for (const [i, id] of todo.entries()) {
      try {
        const raw = await fetchJson(`${NAT_API}/course/${id}`, { timeoutMs: 90_000 });
        if (raw) {
          await store.saveCatalogCourse(db, parseNatCourse(raw), allDepartments);
          saved++;
        }
      } catch (err) {
        failed++;
        console.warn(`  course ${id}: ${String(err).slice(0, 200)} — skipped`);
      }
      if ((i + 1) % 50 === 0) {
        const perCourse = (Date.now() - started) / (i + 1);
        const eta = Math.round(((todo.length - i - 1) * perCourse) / 60_000);
        console.log(`  courses ${i + 1}/${todo.length} (~${eta} min left)`);
      }
    }
    // The list is complete (checked above), so anything stored but no longer listed is gone.
    const removed = await store.removeCourses(db, plan.remove);
    console.log(`Saved ${saved} courses, ${failed} failed, ${removed} removed.`);

    // 3. Optional module handbook entries -----------------------------------------------------------
    if (values.descriptions) {
      const codes = await store.modulesWithoutDescription(db, semester);
      console.log(`Module handbook: ${codes.length} modules without description`);
      for (const [i, code] of codes.entries()) {
        try {
          const raw = await fetchJson(`${NAT_API}/mhb/module/${encodeURIComponent(code)}`, { timeoutMs: 90_000 });
          if (raw) await store.saveModuleDescription(db, parseNatModule(raw));
        } catch (err) {
          console.warn(`  ${code}: ${String(err).slice(0, 200)} — skipped`);
        }
        if ((i + 1) % 50 === 0) console.log(`  modules ${i + 1}/${codes.length}`);
      }
    }
  } finally {
    await pgClient.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
