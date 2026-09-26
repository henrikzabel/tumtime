import { describe, expect, it } from "vitest";

import {
  formatDay,
  formatLongDay,
  formatRange,
  formatShortDate,
  fromBerlin,
  periodCells,
  periodDates,
  planInfoSessions,
  toBerlin,
  topicClashes,
  weekStart,
  type ScheduleRequest,
} from "./info-sessions";

const period = {
  startsOn: "2026-10-12", // Monday
  endsOn: "2026-10-23",
  weekdays: [1, 2, 3, 4],
  slots: [
    { start: "19:00", end: "19:45" },
    { start: "18:00", end: "18:45" },
  ],
  venues: [
    { name: "MI HS 1", campus: "Garching", capacity: 300 },
    { name: "Audimax", campus: "München", capacity: 1000 },
  ],
};

const req = (clubId: number, extra: Partial<ScheduleRequest> = {}): ScheduleRequest => ({
  clubId,
  name: `Club ${clubId}`,
  focusAreas: [],
  preferredDates: [],
  avoidDates: [],
  preferredTimes: [],
  campus: null,
  ...extra,
});

describe("period cells", () => {
  it("lists only the chosen weekdays, slots sorted by time, one cell per room", () => {
    expect(periodDates(period)).toEqual([
      "2026-10-12",
      "2026-10-13",
      "2026-10-14",
      "2026-10-15",
      "2026-10-19",
      "2026-10-20",
      "2026-10-21",
      "2026-10-22",
    ]);
    const cells = periodCells(period);
    expect(cells).toHaveLength(8 * 2 * 2);
    expect(cells[0]).toMatchObject({ date: "2026-10-12", start: "18:00", venue: "MI HS 1", weekday: 1 });
  });
});

describe("Berlin wall clock", () => {
  it("converts both in summer and in winter time", () => {
    expect(fromBerlin("2026-07-01", "18:00").toISOString()).toBe("2026-07-01T16:00:00.000Z");
    expect(fromBerlin("2026-11-02", "18:00").toISOString()).toBe("2026-11-02T17:00:00.000Z");
    expect(toBerlin(new Date("2026-11-02T17:00:00Z"))).toEqual({ date: "2026-11-02", time: "18:00" });
  });
  it("formats days the same everywhere", () => {
    expect(formatDay("2026-10-12")).toBe("Mon 12 Oct");
    expect(formatLongDay("2026-10-01")).toBe("Thursday 1 October");
    expect(formatRange("2026-10-12", "2026-10-23")).toBe("12 Oct – 23 Oct");
    expect(formatShortDate(new Date("2026-10-05T22:30:00Z"))).toBe("6 Oct");
  });
  it("finds the Monday of a week", () => {
    expect(weekStart("2026-10-18")).toBe("2026-10-12");
    expect(weekStart("2026-10-12")).toBe("2026-10-12");
  });
});

describe("planInfoSessions", () => {
  const cells = periodCells(period);

  it("gives every club its own cell and spreads clubs over the nights", () => {
    const { placed, unplaced } = planInfoSessions(cells, [1, 2, 3, 4, 5, 6, 7, 8].map((id) => req(id)));
    expect(unplaced).toEqual([]);
    expect(new Set(placed.map((p) => p.cell.key)).size).toBe(8);
    expect(new Set(placed.map((p) => p.cell.date)).size).toBe(8);
  });

  it("never uses blocked nights and respects preferences", () => {
    const { placed } = planInfoSessions(cells, [
      req(1, { preferredDates: ["2026-10-14"], preferredTimes: ["19:00"], campus: "München" }),
      req(2, { avoidDates: periodDates(period).filter((d) => d !== "2026-10-22") }),
    ]);
    const byClub = Object.fromEntries(placed.map((p) => [p.clubId, p.cell]));
    expect(byClub[1]).toMatchObject({ date: "2026-10-14", start: "19:00", venue: "Audimax" });
    expect(byClub[2].date).toBe("2026-10-22");
  });

  it("does not run clubs with the same focus area in parallel", () => {
    const small = periodCells({ ...period, endsOn: "2026-10-12" }); // one night, 2 slots × 2 rooms
    const robotics = { focusAreas: ["Robotics"], preferredDates: ["2026-10-12"] };
    const { placed } = planInfoSessions(small, [req(1, robotics), req(2, robotics), req(3), req(4)]);
    const starts = placed.filter((p) => p.clubId <= 2).map((p) => p.cell.start);
    expect(new Set(starts).size).toBe(2);
    expect(
      topicClashes(placed.map((p) => ({ id: p.clubId, date: p.cell.date, start: p.cell.start, focusAreas: p.focusAreas }))),
    ).toEqual([]);
  });

  it("keeps fixed sessions and reports clubs that don't fit", () => {
    const one = periodCells({ ...period, endsOn: "2026-10-12", slots: [period.slots[0]], venues: [period.venues[0]] });
    const { placed, unplaced } = planInfoSessions(one, [req(1), req(2)], [{ clubId: 1, cell: one[0], focusAreas: [] }]);
    expect(placed).toHaveLength(1);
    expect(unplaced.map((r) => r.clubId)).toEqual([2]);
  });

  it("is deterministic", () => {
    const reqs = [5, 3, 9, 1].map((id) => req(id, { focusAreas: id % 2 ? ["Tech"] : [] }));
    expect(planInfoSessions(cells, reqs)).toEqual(planInfoSessions(cells, [...reqs].reverse()));
  });
});
