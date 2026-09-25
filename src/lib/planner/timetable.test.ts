import { describe, expect, it } from "vitest";

import { berlinClock, findClashes, formatSlot, toIcs, weeklySlots } from "./timetable";

const weekly = (dates: string[], from: string, to: string) =>
  dates.map((d) => ({ start: `${d}T${from}:00+02:00`, end: `${d}T${to}:00+02:00` }));

describe("berlinClock", () => {
  it("uses Berlin wall-clock time across DST", () => {
    expect(berlinClock("2026-10-22T12:00:00+02:00")).toEqual({ weekday: 4, minutes: 720 }); // CEST
    expect(berlinClock("2026-11-05T11:00:00Z")).toEqual({ weekday: 4, minutes: 720 }); // CET = UTC+1
  });
});

describe("weeklySlots", () => {
  it("condenses recurring dates and ignores one-offs and cancellations", () => {
    const events = [
      ...weekly(["2026-10-15", "2026-10-22"], "12:00", "14:00"), // CEST, before the DST change on Oct 25
      { start: "2026-11-05T11:00:00Z", end: "2026-11-05T13:00:00Z" }, // same slot after DST change
      { start: "2026-12-03T10:00:00+01:00", end: "2026-12-03T12:00:00+01:00" }, // one-off
      { start: "2026-11-12T11:00:00Z", end: "2026-11-12T13:00:00Z", canceled: true },
    ];
    const slots = weeklySlots(events);
    expect(slots).toHaveLength(1);
    expect(slots[0]).toMatchObject({ weekday: 4, startMinutes: 720, endMinutes: 840, occurrences: 3 });
    expect(formatSlot(slots[0])).toBe("Thu 12:00–14:00");
  });

  it("keeps single dates when nothing recurs (block courses)", () => {
    expect(weeklySlots(weekly(["2026-10-19"], "09:00", "17:00"))).toHaveLength(1);
  });
});

describe("findClashes", () => {
  it("detects overlapping slots on the same day only", () => {
    const a = [{ weekday: 1, startMinutes: 600, endMinutes: 720, room: null, occurrences: 5 }];
    const b = [{ weekday: 1, startMinutes: 700, endMinutes: 800, room: null, occurrences: 5 }];
    const c = [{ weekday: 2, startMinutes: 600, endMinutes: 720, room: null, occurrences: 5 }];
    const d = [{ weekday: 1, startMinutes: 720, endMinutes: 780, room: null, occurrences: 5 }]; // touching, no clash
    expect(findClashes({ a, b, c, d })).toEqual([
      ["a", "b"],
      ["b", "d"],
    ]);
  });
});

describe("toIcs", () => {
  it("creates a valid calendar with escaped text and UTC times", () => {
    const ics = toIcs([
      { uid: "1", title: "Diskrete Strukturen, Übung; Gruppe 3", start: "2026-10-22T12:00:00+02:00", end: "2026-10-22T14:00:00+02:00", location: "MI 00.13.054" },
    ]);
    expect(ics).toContain("BEGIN:VCALENDAR\r\n");
    expect(ics).toContain("DTSTART:20261022T100000Z");
    expect(ics).toContain("SUMMARY:Diskrete Strukturen\\, Übung\\; Gruppe 3");
    expect(ics.trim().endsWith("END:VCALENDAR")).toBe(true);
  });

  it("folds long lines", () => {
    const ics = toIcs([{ uid: "2", title: "x".repeat(200), start: "2026-10-22T10:00:00Z", end: "2026-10-22T11:00:00Z" }]);
    expect(ics.split("\r\n").every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
  });
});
