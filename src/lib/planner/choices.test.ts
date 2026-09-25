import { describe, expect, it } from "vitest";

import { baseTitle, buildChoices } from "./choices";
import type { TimetableCourse } from "./queries";

const ev = (start: string) => ({ courseId: 0, groupId: 0, groupName: "", start, end: start, canceled: false, room: null, roomUrl: null });
const course = (id: number, title: string, activity: string, groups: string[]): TimetableCourse => ({
  id,
  title,
  activity,
  activityName: null,
  moduleCodes: ["IN0015"],
  tumonlineUrl: null,
  groups: groups.map((name, i) => ({ id: id * 10 + i, name, maxStudents: null, events: [ev("2026-10-19T10:00:00Z")] })),
});

describe("baseTitle", () => {
  it.each([
    ["Übungen zu Diskrete Strukturen (IN0015) - 1 (Mo)", "Übungen zu Diskrete Strukturen (IN0015)"],
    ["Übungen zu Einführung in die Rechnerarchitektur - Gruppen Do, Fr (IN0004)", "Übungen zu Einführung in die Rechnerarchitektur (IN0004)"],
    ["Discrete Structures, Exercise Session (IN0015), Mon, Tue", "Discrete Structures, Exercise Session (IN0015)"],
    ["Diskrete Strukturen (IN0015)", "Diskrete Strukturen (IN0015)"],
    ["Computer Architecture, Exercise Session - Groups Thu, Fri (IN0004)", "Computer Architecture, Exercise Session (IN0004)"],
  ])("%s", (input, expected) => {
    expect(baseTitle(input)).toBe(expected);
  });
});

describe("buildChoices", () => {
  it("merges tutorial courses of one module and keeps lectures separate", () => {
    const choices = buildChoices(
      [
        course(1, "Diskrete Strukturen (IN0015)", "VO", ["Standardgruppe"]),
        course(2, "Übungen zu Diskrete Strukturen (IN0015) - 1 (Mo)", "UE", ["01-14xx", "01-16xx"]),
        course(3, "Übungen zu Diskrete Strukturen (IN0015) - 2 (Di)", "UE", ["02-12xx"]),
      ],
      ["IN0015"],
    );
    expect(choices.map((c) => [c.activity, c.options.length])).toEqual([
      ["VO", 1],
      ["UE", 3],
    ]);
    expect(choices[1].title).toBe("Übungen zu Diskrete Strukturen (IN0015)");
  });
});
