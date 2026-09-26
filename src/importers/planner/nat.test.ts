import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { moduleCodesInTitle, parseCycle, parseNatCourse, parseNatModule } from "./nat";

const fixture = (name: string) =>
  JSON.parse(readFileSync(path.join(__dirname, "../__fixtures__/planner", name), "utf8")) as unknown;

describe("parseNatModule", () => {
  const m = parseNatModule(fixture("nat-module-IN0001.json"));

  it("maps the module handbook fields", () => {
    expect(m).toMatchObject({
      moduleCode: "IN0001",
      titleDe: "Einführung in die Informatik",
      titleEn: "Introduction to Informatics",
      credits: 6,
      cycle: "winter",
      durationSemesters: 1,
      languages: ["DE"],
      level: "Bachelor’s level",
      descriptionVersion: "2026w",
    });
    expect(m.examEn).toMatch(/120 minutes/);
    expect(m.preconditionEn).toMatch(/IN0002/);
  });
});

describe("parseCycle", () => {
  it.each([
    [{ short: "W", title_en: "in winter semester" }, "winter"],
    [{ short: "S", title_en: "in summer semester" }, "summer"],
    [{ short: "WS", title_en: "winter and summer semester" }, "both"],
    [null, null],
  ] as const)("%j → %s", (input, expected) => {
    expect(parseCycle(input)).toBe(expected);
  });
});

describe("parseNatCourse", () => {
  const c = parseNatCourse(fixture("nat-course-950941194.json"));

  it("maps the course and its modules", () => {
    expect(c).toMatchObject({ id: 950941194, semester: "2026WS", activity: "UE", moduleCodes: ["IN0004"] });
    expect(c.modules).toEqual([
      {
        code: "IN0004",
        titleDe: expect.any(String),
        titleEn: "Introduction to Computer Organization and Technology - Computer Architecture",
        credits: 8,
      },
    ]);
  });

  it("keeps catalog metadata (organisation, school, last change)", () => {
    expect(c).toMatchObject({
      modifiedAt: "2026-08-28T20:50:51.644170+02:00",
      orgCode: "TUINI10",
      schoolName: "TUM School of Computation, Information and Technology",
    });
    expect(c.orgName).toMatch(/Computer Architecture and Parallel Systems/);
  });

  it("maps tutorial groups with their weekly events and rooms", () => {
    expect(c.groups).toHaveLength(3);
    const g = c.groups[0];
    expect(g).toMatchObject({ name: "Do-1200-3", maxStudents: 26 });
    expect(g.events).toHaveLength(13);
    expect(g.events[0]).toMatchObject({
      start: "2026-10-22T12:00:00+02:00",
      end: "2026-10-22T14:00:00+02:00",
      canceled: false,
      type: "REGULAR",
      room: { short: "MI 00.13.054", code: "5613.EG.054", navUrl: "https://nav.tum.de/room/5613.EG.054" },
    });
  });

  it("never carries staff personal data", () => {
    expect(JSON.stringify(c)).not.toMatch(/@|lastname|firstname/);
  });
});

describe("moduleCodesInTitle", () => {
  it("finds codes in brackets and parentheses", () => {
    expect(moduleCodesInTitle("Übungen zu Diskrete Strukturen (IN0015) - 1 (Mo)")).toEqual(["IN0015"]);
    expect(moduleCodesInTitle("Übungen zu Fallstudien [MA2902]")).toEqual(["MA2902"]);
    expect(moduleCodesInTitle("Financial Accounting (WI001059_E)")).toEqual(["WI001059_E"]);
  });
});
