import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { ExamRecord } from "@/lib/stats/exam-record";

/*
 * Runs against a real Postgres database. Opt-in: set TEST_DATABASE_URL to an empty scratch
 * database (it is truncated before every test), e.g.
 *   TEST_DATABASE_URL=postgres://tumtime:tumtime@localhost:5432/tumtime_test npm test
 */
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("store (integration)", () => {
  let mod: typeof import("@/db");
  let schema: typeof import("@/db/schema");
  let store: typeof import("./store");
  let orm: typeof import("drizzle-orm");

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    mod = await import("@/db");
    schema = await import("@/db/schema");
    store = await import("./store");
    orm = await import("drizzle-orm");
    // Migrations are applied once in vitest.global-setup.ts.
  });

  beforeEach(async () => {
    await mod.db.execute(
      orm.sql`truncate grade_counts, source_records, exams, module_names, modules, submissions restart identity cascade`,
    );
  });

  afterAll(async () => {
    await mod?.pgClient.end();
  });

  const record = (patch: Partial<ExamRecord> = {}): ExamRecord => ({
    moduleCode: "IN0001",
    moduleName: "Introduction to Informatics",
    moduleNameLang: "en",
    semester: "2024WS",
    type: "endterm",
    registered: 12,
    noShow: 2,
    grades: { "1.0": 3, "2.0": 5, "5.0": 2 },
    ...patch,
  });

  const examRow = async () => {
    const [e] = await mod.db.select().from(schema.exams);
    return e;
  };

  it("imports, merges agreeing sources and stores grade counts", async () => {
    await store.saveSourceRecords(mod.db, "tum_info", [record()]);
    await store.saveSourceRecords(mod.db, "aamin", [record({ registered: undefined })]);
    const e = await examRow();
    expect(e).toMatchObject({ status: "published", attempted: 10, registered: 12, failed: 2 });
    expect(e.sources).toEqual(["aamin", "tum_info"]);
    const grades = await mod.db.select().from(schema.gradeCounts);
    expect(grades).toHaveLength(3);
  });

  it("hides conflicting exams until an admin pins a source; admin choices survive rebuilds", async () => {
    await store.saveSourceRecords(mod.db, "tum_info", [record()]);
    const summary = await store.saveSourceRecords(mod.db, "aamin", [record({ grades: { "1.0": 10 } })]);
    expect(summary.conflicts).toHaveLength(1);
    expect((await examRow()).status).toBe("conflict");

    await mod.db.update(schema.exams).set({ pinnedSource: "aamin" });
    await store.rebuildModules(mod.db, ["IN0001"]);
    expect(await examRow()).toMatchObject({ status: "published", attempted: 10, failed: 0 });

    await mod.db.update(schema.exams).set({ status: "hidden" });
    await store.saveSourceRecords(mod.db, "tum_info", [record()]);
    expect((await examRow()).status).toBe("hidden");
  });

  it("replaceAll deletes records missing from a snapshot; removeSource removes a source entirely", async () => {
    await store.saveSourceRecords(mod.db, "tum_info", [record(), record({ semester: "2023WS" })]);
    const res = await store.saveSourceRecords(mod.db, "tum_info", [record()], { replaceAll: true });
    expect(res.removed).toBe(1);
    expect(await mod.db.select().from(schema.exams)).toHaveLength(1);

    await store.removeSource(mod.db, "tum_info");
    expect(await mod.db.select().from(schema.exams)).toHaveLength(0);
    // The module itself stays — later features reference it.
    expect(await mod.db.select().from(schema.modules)).toHaveLength(1);
  });

  it("tracks module name history", async () => {
    await store.saveSourceRecords(mod.db, "tum_info", [
      record({ semester: "2019WS", moduleName: "Introduction to Informatics 1" }),
      record({ semester: "2020WS", moduleName: "Introduction to Informatics 1" }),
      record({ semester: "2022WS" }),
    ]);
    const [m] = await mod.db.select().from(schema.modules);
    expect(m.nameEn).toBe("Introduction to Informatics");
    const names = await mod.db.select().from(schema.moduleNames).orderBy(schema.moduleNames.firstSemester);
    expect(names.map((n) => [n.name, n.firstSemester, n.lastSemester])).toEqual([
      ["Introduction to Informatics 1", "2019WS", "2020WS"],
      ["Introduction to Informatics", "2022WS", "2022WS"],
    ]);
  });
});
