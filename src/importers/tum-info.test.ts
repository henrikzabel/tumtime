import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { computeStats } from "@/lib/stats/grades";

import { parseTumInfo } from "./tum-info";

const fixture = JSON.parse(
  readFileSync(path.join(__dirname, "__fixtures__/tum-info-courses.sample.json"), "utf8"),
) as unknown[];

describe("parseTumInfo", () => {
  const { records, issues } = parseTumInfo(fixture);
  const byKey = (code: string, semester: string, type = "endterm") =>
    records.find((r) => r.moduleCode === code && r.semester === semester && r.type === type)!;

  it("parses every fixture record without issues", () => {
    expect(issues).toEqual([]);
    expect(records).toHaveLength(fixture.length);
  });

  it("maps a regular graded exam", () => {
    const r = byKey("IN0004", "2011WS");
    expect(r).toMatchObject({
      type: "endterm",
      date: "2012-02-15",
      registered: 359,
      attempted: 312,
      noShow: 47,
      ects: 8,
      moduleName: "Introduction to Computer Organization and Technology - Computer Architecture",
    });
    expect(r.grades["1.3"]).toBe(17);
    expect(r.grades["6.0"]).toBeUndefined();
    // Our derived statistics agree with what the source reports.
    const stats = computeStats(r.grades);
    expect(stats.attempted).toBe(312);
    expect(stats.averageTotal).toBeCloseTo(r.averageTotal!, 3);
    expect(stats.averagePassed).toBeCloseTo(r.averagePassed!, 3);
    expect(stats.failureRate).toBeCloseTo(r.failureRate!, 3);
  });

  it("maps 7.0 to B (passed) and 8.0 to N (failed)", () => {
    const passFail = byKey("MW2016", "2012WS");
    expect(passFail.grades).toEqual({ B: 1276 });
    const mixed = byKey("CLA11200", "2017WS");
    expect(mixed.grades.B).toBe(74);
    expect(mixed.grades.N).toBe(7);
    expect(computeStats(mixed.grades).failureRate).toBeCloseTo(mixed.failureRate!, 3);
  });

  it("counts N as a failed attempt in graded exams", () => {
    const r = byKey("IN8005", "2023WS", "retake");
    expect(r.grades.N).toBe(2);
    expect(computeStats(r.grades).failureRate).toBeCloseTo(r.failureRate!, 3);
  });

  it("keeps retakes and suffixed module codes", () => {
    expect(byKey("IN8005", "2023WS").noShow).toBe(121);
    expect(byKey("IN8005", "2023WS", "retake").noShow).toBe(70);
    expect(records.some((r) => r.moduleCode === "IN0007_E")).toBe(true);
  });

  it("decodes HTML entities in module names", () => {
    const [r] = parseTumInfo([{ ...(fixture[0] as object), name: "Programming (Exercises &amp; Laboratory)" }]).records;
    expect(r.moduleName).toBe("Programming (Exercises & Laboratory)");
  });

  it("reports malformed entries instead of throwing", () => {
    const res = parseTumInfo([{ code: "IN0001", semester: "sometime", examType: "endterm", grades: [] }]);
    expect(res.records).toHaveLength(0);
    expect(res.issues[0]).toMatchObject({ index: 0, key: "IN0001/sometime/endterm" });
  });
});
