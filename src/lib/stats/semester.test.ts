import { describe, expect, it } from "vitest";

import { formatSemester, parseSemester, semesterKey } from "./semester";

describe("parseSemester", () => {
  it.each([
    ["2024WS", "2024WS"],
    ["2025ss", "2025SS"],
    ["25S", "2025SS"],
    ["24W", "2024WS"],
    ["2024W", "2024WS"],
    ["WS 2024/25", "2024WS"],
    ["SoSe 2025", "2025SS"],
    ["Wintersemester 2023/24", "2023WS"],
    ["Summer semester 2022", "2022SS"],
  ])("%s → %s", (input, expected) => {
    expect(parseSemester(input)).toBe(expected);
  });

  it("rejects garbage", () => {
    expect(parseSemester("sometime")).toBeNull();
  });
});

describe("semesterKey", () => {
  it("orders summer before winter of the same year", () => {
    expect(semesterKey("2024SS")).toBeLessThan(semesterKey("2024WS"));
    expect(semesterKey("2024WS")).toBeLessThan(semesterKey("2025SS"));
  });
});

describe("formatSemester", () => {
  it("formats both terms", () => {
    expect(formatSemester("2024WS")).toBe("Winter 2024/25");
    expect(formatSemester("2025SS")).toBe("Summer 2025");
  });
});
