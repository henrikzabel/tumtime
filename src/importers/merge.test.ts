import { describe, expect, it } from "vitest";

import type { ExamRecord } from "@/lib/stats/exam-record";

import { mergeExamRecords, type SourcedRecord } from "./merge";

const base: ExamRecord = {
  moduleCode: "IN0001",
  semester: "2024WS",
  type: "endterm",
  grades: { "1.0": 3, "2.0": 5, "5.0": 2 },
};

const rec = (source: SourcedRecord["source"], patch: Partial<ExamRecord> = {}): SourcedRecord => ({
  source,
  record: { ...base, ...patch },
});

describe("mergeExamRecords", () => {
  it("publishes a single source and derives stats from the distribution", () => {
    const m = mergeExamRecords([rec("tum_info", { registered: 12, noShow: 2 })]);
    expect(m).toMatchObject({
      status: "published",
      primarySource: "tum_info",
      registered: 12,
      attempted: 10,
      passed: 8,
      failed: 2,
      noShow: 2,
    });
    expect(m.failureRate).toBeCloseTo(0.2);
    expect(m.averageTotal).toBeCloseTo((3 + 10 + 10) / 10);
  });

  it("publishes agreeing sources, preferring aamin over tum_info and filling gaps", () => {
    const m = mergeExamRecords([
      rec("tum_info", { registered: 12, date: "2025-02-10" }),
      rec("aamin", { date: "2025-02-11" }),
    ]);
    expect(m.status).toBe("published");
    expect(m.primarySource).toBe("aamin");
    expect(m.sources).toEqual(["aamin", "tum_info"]);
    expect(m.date).toBe("2025-02-11");
    expect(m.registered).toBe(12);
  });

  it("marks differing distributions as conflict", () => {
    const m = mergeExamRecords([rec("tum_info"), rec("aamin", { grades: { "1.0": 4, "2.0": 4, "5.0": 2 } })]);
    expect(m.status).toBe("conflict");
    expect(m.conflicts[0]).toMatch(/grade distribution differs/);
  });

  it("compares attempt counts when a source has no distribution", () => {
    const agree = mergeExamRecords([rec("tum_info"), rec("aamin", { grades: {}, attempted: 10 })]);
    expect(agree.status).toBe("published");
    const differ = mergeExamRecords([rec("tum_info"), rec("aamin", { grades: {}, attempted: 11 })]);
    expect(differ.status).toBe("conflict");
  });

  it("resolves a conflict when an admin pins a source", () => {
    const m = mergeExamRecords(
      [rec("tum_info"), rec("aamin", { grades: { "1.0": 10 } })],
      "tum_info",
    );
    expect(m.status).toBe("published");
    expect(m.primarySource).toBe("tum_info");
    expect(m.grades).toEqual(base.grades);
  });

  it("falls back to reported numbers without a distribution", () => {
    const m = mergeExamRecords([rec("aamin", { grades: {}, attempted: 94, averageTotal: 3.542, failureRate: 0.3 })]);
    expect(m).toMatchObject({ attempted: 94, averageTotal: 3.542, failureRate: 0.3, passed: null });
  });
});
