import { and, eq, inArray, notInArray, sql } from "drizzle-orm";

import type { Db } from "@/db";
import { departments, exams, gradeCounts, moduleNames, modules, sourceRecords } from "@/db/schema";
import { resolveDepartment } from "@/lib/departments";
import { examKey, type ExamRecord, type ExamSource } from "@/lib/stats/exam-record";
import { semesterKey, type Semester } from "@/lib/stats/semester";

import { mergeExamRecords, type SourcedRecord } from "./merge";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type DbLike = Db | Tx;
type MergedStatus = "published" | "conflict" | "hidden";

export type SaveOptions = {
  /** Treat the batch as a full snapshot of the source: records missing from it are deleted. */
  replaceAll?: boolean;
};

export type SaveSummary = {
  saved: number;
  duplicatesInBatch: string[];
  removed: number;
  modulesRebuilt: number;
  exams: { published: number; conflict: number; hidden: number };
  conflicts: { key: string; reasons: string[] }[];
};

/** Store one source's records and rebuild the public view of every affected module. */
export async function saveSourceRecords(
  db: Db,
  source: ExamSource,
  records: ExamRecord[],
  options: SaveOptions = {},
): Promise<SaveSummary> {
  // Duplicate detection within the batch (same module, semester, type): the last one wins.
  const byKey = new Map<string, ExamRecord>();
  const duplicatesInBatch: string[] = [];
  for (const r of records) {
    const key = examKey(r);
    if (byKey.has(key)) duplicatesInBatch.push(key);
    byKey.set(key, r);
  }
  const unique = [...byKey.values()];

  return db.transaction(async (tx) => {
    const affected = new Set(unique.map((r) => r.moduleCode));
    let removed = 0;

    if (options.replaceAll) {
      const keep = new Set(byKey.keys());
      const existing = await tx
        .select({ id: sourceRecords.id, moduleCode: sourceRecords.moduleCode, semester: sourceRecords.semester, type: sourceRecords.type })
        .from(sourceRecords)
        .where(eq(sourceRecords.source, source));
      const stale = existing.filter((r) => !keep.has(examKey({ ...r, semester: r.semester as Semester })));
      for (const r of stale) affected.add(r.moduleCode);
      for (let i = 0; i < stale.length; i += 1000) {
        await tx.delete(sourceRecords).where(inArray(sourceRecords.id, stale.slice(i, i + 1000).map((r) => r.id)));
      }
      removed = stale.length;
    }

    for (let i = 0; i < unique.length; i += 500) {
      const chunk = unique.slice(i, i + 500);
      await tx
        .insert(sourceRecords)
        .values(
          chunk.map((r) => ({
            source,
            externalId: examKey(r),
            moduleCode: r.moduleCode,
            semester: r.semester,
            type: r.type,
            data: r,
          })),
        )
        .onConflictDoUpdate({
          target: [sourceRecords.source, sourceRecords.moduleCode, sourceRecords.semester, sourceRecords.type],
          set: { data: sql`excluded.data`, externalId: sql`excluded.external_id`, importedAt: sql`now()` },
        });
    }

    const rebuild = await rebuildModules(tx, [...affected]);
    return { saved: unique.length, duplicatesInBatch, removed, ...rebuild };
  });
}

/** Delete every record of a source (e.g. if TUM Info data may no longer be used) and re-merge. */
export async function removeSource(db: Db, source: ExamSource) {
  return db.transaction(async (tx) => {
    const deleted = await tx
      .delete(sourceRecords)
      .where(eq(sourceRecords.source, source))
      .returning({ moduleCode: sourceRecords.moduleCode });
    const rebuild = await rebuildModules(tx, [...new Set(deleted.map((r) => r.moduleCode))]);
    return { removed: deleted.length, ...rebuild };
  });
}

function latestFirst(a: ExamRecord, b: ExamRecord) {
  return semesterKey(b.semester) - semesterKey(a.semester);
}

/**
 * Recompute modules, module names, exams and grade counts for the given module codes from
 * `source_records`. Admin decisions (`hidden` status, pinned source) survive rebuilds.
 */
export async function rebuildModules(db: DbLike, moduleCodes: string[]) {
  const summary = {
    modulesRebuilt: 0,
    exams: { published: 0, conflict: 0, hidden: 0 },
    conflicts: [] as { key: string; reasons: string[] }[],
  };
  if (moduleCodes.length === 0) return summary;

  const allDepartments = await db.select().from(departments);

  for (const code of moduleCodes) {
    const rows = await db.select().from(sourceRecords).where(eq(sourceRecords.moduleCode, code));
    const [existingModule] = await db.select().from(modules).where(eq(modules.code, code));

    if (rows.length === 0) {
      // No data left: drop the module's exams but keep the module (other features may reference it).
      if (existingModule) await db.delete(exams).where(eq(exams.moduleId, existingModule.id));
      continue;
    }

    const sourced: SourcedRecord[] = rows.map((r) => ({ source: r.source, record: r.data as ExamRecord }));
    const newestFirst = sourced.map((s) => s.record).sort(latestFirst);
    const nameIn = (lang: "en" | "de") => newestFirst.find((r) => r.moduleName && r.moduleNameLang === lang)?.moduleName;
    const dept = resolveDepartment(code, allDepartments);
    const moduleValues = {
      nameEn: nameIn("en") ?? existingModule?.nameEn ?? null,
      nameDe: nameIn("de") ?? existingModule?.nameDe ?? null,
      ects: newestFirst.find((r) => r.ects)?.ects ?? existingModule?.ects ?? null,
      departmentId: dept?.id ?? existingModule?.departmentId ?? null,
      schoolId: dept?.schoolId ?? existingModule?.schoolId ?? null,
    };
    const [mod] = await db
      .insert(modules)
      .values({ code, ...moduleValues })
      .onConflictDoUpdate({ target: modules.code, set: moduleValues })
      .returning({ id: modules.id });

    // Historical names with the semester range they were used in.
    const names = new Map<string, { lang: string; name: string; first: Semester; last: Semester }>();
    for (const r of [...newestFirst].reverse()) {
      if (!r.moduleName || !r.moduleNameLang) continue;
      const k = `${r.moduleNameLang}|${r.moduleName}`;
      const entry = names.get(k);
      if (entry) entry.last = r.semester;
      else names.set(k, { lang: r.moduleNameLang, name: r.moduleName, first: r.semester, last: r.semester });
    }
    // Names are fully derived from source records, so replace them wholesale.
    await db.delete(moduleNames).where(eq(moduleNames.moduleId, mod.id));
    if (names.size) {
      await db.insert(moduleNames).values(
        [...names.values()].map((n) => ({
          moduleId: mod.id,
          lang: n.lang,
          name: n.name,
          firstSemester: n.first,
          lastSemester: n.last,
        })),
      );
    }

    // Group by exam and merge.
    const groups = new Map<string, SourcedRecord[]>();
    for (const s of sourced) {
      const k = examKey(s.record);
      groups.set(k, [...(groups.get(k) ?? []), s]);
    }
    const existingExams = await db.select().from(exams).where(eq(exams.moduleId, mod.id));
    const existingByKey = new Map(existingExams.map((e) => [`${code}/${e.semester}/${e.type}`, e]));

    const keptIds: number[] = [];
    for (const [key, group] of groups) {
      const { semester, type } = group[0].record;
      const previous = existingByKey.get(key);
      const merged = mergeExamRecords(group, previous?.pinnedSource);
      const status: MergedStatus = previous?.status === "hidden" ? "hidden" : merged.status;
      if (merged.status === "conflict") summary.conflicts.push({ key, reasons: merged.conflicts });
      summary.exams[status]++;

      const values = {
        moduleId: mod.id,
        semester,
        semesterKey: semesterKey(semester),
        type,
        date: merged.date,
        registered: merged.registered,
        attempted: merged.attempted,
        passed: merged.passed,
        failed: merged.failed,
        noShow: merged.noShow,
        withdrawn: merged.withdrawn,
        cheating: merged.cheating,
        averageTotal: merged.averageTotal,
        averagePassed: merged.averagePassed,
        failureRate: merged.failureRate,
        status,
        sources: merged.sources,
      };
      const [exam] = await db
        .insert(exams)
        .values(values)
        .onConflictDoUpdate({ target: [exams.moduleId, exams.semester, exams.type], set: values })
        .returning({ id: exams.id });
      keptIds.push(exam.id);

      await db.delete(gradeCounts).where(eq(gradeCounts.examId, exam.id));
      const gradeRows = Object.entries(merged.grades)
        .filter(([, count]) => count > 0)
        .map(([grade, count]) => ({ examId: exam.id, grade, count }));
      if (gradeRows.length) await db.insert(gradeCounts).values(gradeRows);

      await db
        .update(sourceRecords)
        .set({ examId: exam.id })
        .where(
          and(
            eq(sourceRecords.moduleCode, code),
            eq(sourceRecords.semester, semester),
            eq(sourceRecords.type, type),
          ),
        );
    }

    // Exams whose sources are all gone.
    await db
      .delete(exams)
      .where(keptIds.length ? and(eq(exams.moduleId, mod.id), notInArray(exams.id, keptIds)) : eq(exams.moduleId, mod.id));
    summary.modulesRebuilt++;
  }
  return summary;
}
