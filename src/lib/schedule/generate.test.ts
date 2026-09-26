import { describe, expect, it } from "vitest";

import type { WeeklySlot } from "@/lib/planner/timetable";

import { DEFAULT_PREFERENCES, generateSchedules, summarize, type GenChoice } from "./generate";

const slot = (weekday: number, from: string, to: string): WeeklySlot => {
  const m = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  return { weekday, startMinutes: m(from), endMinutes: m(to), room: null, occurrences: 10 };
};

const lecture: GenChoice = { key: "IN0001|VO", options: [{ groupId: 1, slots: [slot(1, "10:00", "12:00"), slot(3, "10:00", "12:00")] }] };
const tutorial: GenChoice = {
  key: "IN0001|UE",
  options: [
    { groupId: 11, slots: [slot(1, "10:00", "12:00")] }, // clashes with the lecture
    { groupId: 12, slots: [slot(1, "12:00", "14:00")] },
    { groupId: 13, slots: [slot(5, "08:00", "10:00")] },
  ],
};
const other: GenChoice = {
  key: "MA0901|UE",
  options: [
    { groupId: 21, slots: [slot(1, "12:00", "14:00")] }, // clashes with tutorial 12
    { groupId: 22, slots: [slot(3, "14:00", "16:00")] },
  ],
};

describe("summarize", () => {
  it("counts days, class time and gaps", () => {
    const s = summarize([slot(1, "08:00", "10:00"), slot(1, "12:00", "14:00"), slot(2, "10:00", "11:00")]);
    expect(s).toEqual({ days: [1, 2], earliest: 480, latest: 840, gapMinutes: 120, classMinutes: 300 });
  });
  it("does not double count overlapping blocks", () => {
    expect(summarize([slot(1, "08:00", "10:00"), slot(1, "09:00", "11:00")]).classMinutes).toBe(180);
  });
});

describe("generateSchedules", () => {
  it("enumerates only clash-free combinations", () => {
    const { results, total } = generateSchedules([lecture, tutorial, other]);
    // 12+22, 13+21, 13+22 (11 clashes with the lecture, 12+21 clash with each other)
    expect(total).toBe(3);
    for (const r of results) expect(r.selection["IN0001|VO"]).toBe(1);
    expect(results.map((r) => [r.selection["IN0001|UE"], r.selection["MA0901|UE"]])).toContainEqual([12, 22]);
    expect(results.some((r) => r.selection["IN0001|UE"] === 11)).toBe(false);
  });

  it("prefers fewer days on campus by default", () => {
    const best = generateSchedules([lecture, tutorial, other]).results[0];
    expect(best.selection).toMatchObject({ "IN0001|UE": 12, "MA0901|UE": 22 }); // Mon + Wed only
    expect(best.summary.days).toEqual([1, 3]);
  });

  it("respects a 'not before' preference", () => {
    const early = generateSchedules([tutorial], { ...DEFAULT_PREFERENCES, fewerDays: false, notBefore: 9 * 60 }).results;
    expect(early.at(-1)!.selection["IN0001|UE"]).toBe(13); // 8:00 ranks last
  });

  it("stops after the node budget", () => {
    const many: GenChoice[] = Array.from({ length: 12 }, (_, i) => ({
      key: `C${i}`,
      options: Array.from({ length: 4 }, (_, j) => ({ groupId: i * 10 + j, slots: [slot((j % 5) + 1, `${String(8 + i).padStart(2, "0")}:00`, `${String(8 + i).padStart(2, "0")}:30`)] })),
    }));
    const res = generateSchedules(many, DEFAULT_PREFERENCES, { maxNodes: 1000 });
    expect(res.truncated).toBe(true);
    expect(res.results.length).toBeGreaterThan(0);
  });
});
