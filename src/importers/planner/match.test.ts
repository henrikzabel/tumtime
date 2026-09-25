import { describe, expect, it } from "vitest";

import { planningSemester, selectCandidateCourses, toNatSemesterKey } from "./match";

describe("selectCandidateCourses", () => {
  const modules = [
    { code: "IN0015", titleDe: "Diskrete Strukturen", titleEn: "Discrete Structures" },
    { code: "IN0004", titleDe: "Einführung in die Rechnerarchitektur", titleEn: null },
  ];
  it("matches by module number and by title", () => {
    const ids = selectCandidateCourses(
      [
        { course_id: 1, course_name: "Übungen zu Diskrete Strukturen (IN0015) - 1 (Mo)" },
        { course_id: 2, course_name: "Einführung in die Rechnerarchitektur", course_name_en: "Intro to Computer Architecture" },
        { course_id: 3, course_name: "Rechnerarchitektur (IN2076)" },
        { course_id: 4, course_name: "Diskrete Strukturen (INHN0004)" }, // title match; detail decides
        { course_id: 5, course_name: "Analysis 1" },
      ],
      modules,
    );
    expect(ids).toEqual([1, 2, 4]);
  });
});

describe("planningSemester", () => {
  it.each([
    ["2026-09-25", "2026WS"],
    ["2027-01-15", "2026WS"],
    ["2027-03-01", "2027SS"],
    ["2027-08-31", "2027SS"],
  ])("%s → %s", (date, expected) => {
    expect(planningSemester(new Date(`${date}T12:00:00`))).toBe(expected);
  });
});

it("converts semester keys for the NAT API", () => {
  expect(toNatSemesterKey("2026WS")).toBe("2026w");
  expect(toNatSemesterKey("2027SS")).toBe("2027s");
});
