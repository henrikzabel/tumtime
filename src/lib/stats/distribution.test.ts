import { describe, expect, it } from "vitest";

import { toDistribution } from "./distribution";

describe("toDistribution", () => {
  it("fills in missing standard steps and keeps intermediate grades in order", () => {
    const bins = toDistribution({ "1.0": 2, "1.4": 1, "5.0": 1 });
    expect(bins.map((b) => b.grade).slice(0, 3)).toEqual(["1.0", "1.3", "1.4"]);
    expect(bins).toHaveLength(14);
    expect(bins.find((b) => b.grade === "1.3")).toMatchObject({ count: 0, share: 0 });
    expect(bins.find((b) => b.grade === "1.0")?.share).toBeCloseTo(0.5);
    expect(bins.at(-1)).toMatchObject({ grade: "5.0", passing: false });
  });

  it("shows only B and N for pass/fail exams", () => {
    expect(toDistribution({ B: 9, N: 1 }).map((b) => [b.grade, b.passing])).toEqual([
      ["B", true],
      ["N", false],
    ]);
  });

  it("returns nothing for an empty distribution", () => {
    expect(toDistribution({})).toEqual([]);
  });
});
