import { describe, expect, it } from "vitest";

import { compareGrades, computeStats, normalizeGrade } from "./grades";

describe("normalizeGrade", () => {
  it.each([
    ["1,3", "1.3"],
    ["1.4", "1.4"],
    ["5", "5.0"],
    [2.3, "2.3"],
    ["bestanden", "B"],
    ["N", "N"],
  ] as const)("%s → %s", (input, expected) => {
    expect(normalizeGrade(input)).toBe(expected);
  });

  it.each(["6.0", "X", "0.7", ""])("rejects %s", (input) => {
    expect(normalizeGrade(input)).toBeNull();
  });
});

describe("computeStats", () => {
  it("computes averages over numeric grades and failure rate over all attempts", () => {
    const s = computeStats({ "1.0": 2, "3.0": 2, "5.0": 1, N: 1, B: 4 });
    expect(s).toMatchObject({ attempted: 10, passed: 8, failed: 2 });
    expect(s.averageTotal).toBeCloseTo((2 * 1 + 2 * 3 + 5) / 5);
    expect(s.averagePassed).toBeCloseTo(2);
    expect(s.failureRate).toBeCloseTo(0.2);
  });

  it("handles an empty distribution", () => {
    expect(computeStats({})).toMatchObject({ attempted: 0, averageTotal: null, failureRate: null });
  });
});

describe("compareGrades", () => {
  it("sorts numeric grades before B and N", () => {
    expect(["N", "2.0", "B", "1.3"].sort(compareGrades)).toEqual(["1.3", "2.0", "B", "N"]);
  });
});
