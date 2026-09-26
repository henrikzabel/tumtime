import { describe, expect, it } from "vitest";

import {
  DEFAULT_FILTERS,
  filterCatalog,
  filtersFromParams,
  filtersToParams,
  matchScore,
  parseEntryKey,
  schoolShort,
  type CatalogEntry,
} from "./entries";

const entry = (over: Partial<CatalogEntry>): CatalogEntry => ({
  key: "IN0001",
  title: "Introduction to Informatics",
  titleDe: "Einführung in die Informatik",
  ects: 6,
  school: "CIT",
  languages: ["DE"],
  activities: ["VO", "UE"],
  days: [1, 3],
  avg: 2.7,
  fail: 0.3,
  ...over,
});

const entries = [
  entry({}),
  entry({ key: "IN0015", title: "Discrete Structures", titleDe: "Diskrete Strukturen", avg: 3.4, fail: 0.45, days: [2, 4] }),
  entry({ key: "MA0001", title: "Analysis 1", titleDe: null, school: "NAT", ects: 9, avg: null, fail: null, languages: ["EN"] }),
  entry({ key: "C_950949586", title: "Research Internship Plant Immunology", titleDe: null, ects: null, school: "LS", activities: ["FO"], days: [], avg: null, fail: null }),
];

describe("parseEntryKey", () => {
  it.each([
    ["in0001", { kind: "module", code: "IN0001" }],
    ["C_950949586", { kind: "course", courseId: 950949586 }],
    ["../etc", null],
  ])("%s", (input, expected) => expect(parseEntryKey(input)).toEqual(expected));
});

describe("schoolShort", () => {
  it("abbreviates TUM schools", () => {
    expect(schoolShort("TUM School of Computation, Information and Technology")).toBe("CIT");
    expect(schoolShort("TUM School of Management")).toBe("MGT");
    expect(schoolShort(null)).toBeNull();
  });
});

describe("matchScore", () => {
  it("ranks exact code > code prefix > title prefix > words", () => {
    expect(matchScore(entries[0], "IN0001")).toBeGreaterThan(matchScore(entries[0], "IN000"));
    expect(matchScore(entries[0], "IN000")).toBeGreaterThan(matchScore(entries[0], "introduction"));
    expect(matchScore(entries[0], "introduction")).toBeGreaterThan(matchScore(entries[0], "informatics intro"));
    expect(matchScore(entries[0], "einfuhrung")).toBeGreaterThan(0); // umlauts folded
    expect(matchScore(entries[0], "biology")).toBe(0);
  });
});

describe("filterCatalog", () => {
  const keys = (f: Partial<typeof DEFAULT_FILTERS>, bm?: Set<string>) =>
    filterCatalog(entries, { ...DEFAULT_FILTERS, ...f }, bm).map((e) => e.key);

  it("lists modules before standalone courses", () => {
    expect(keys({})).toEqual(["IN0001", "IN0015", "MA0001", "C_950949586"]);
  });
  it("filters by school, language, type and ECTS", () => {
    expect(keys({ school: "NAT" })).toEqual(["MA0001"]);
    expect(keys({ language: "EN" })).toEqual(["MA0001"]);
    expect(keys({ activity: "lab" })).toEqual(["C_950949586"]);
    expect(keys({ ects: "large" })).toEqual(["MA0001"]);
  });
  it("keeps only entries whose dates all fall on the chosen days", () => {
    expect(keys({ days: [1, 3, 5] })).toEqual(["IN0001", "MA0001"]);
  });
  it("sorts by average grade with unknown values last", () => {
    expect(keys({ sort: "avg" })).toEqual(["IN0001", "IN0015", "C_950949586", "MA0001"]);
  });
  it("filters bookmarks", () => {
    expect(keys({ bookmarked: true }, new Set(["IN0015"]))).toEqual(["IN0015"]);
  });
});

describe("filters ⇄ params", () => {
  it("round-trips non-default values only", () => {
    const f = { ...DEFAULT_FILTERS, q: "algo", school: "CIT", days: [1, 2], sort: "avg" as const };
    const p = filtersToParams(f);
    expect(p.toString()).toBe("q=algo&school=CIT&days=12&sort=avg");
    expect(filtersFromParams(p)).toEqual(f);
    expect(filtersToParams(DEFAULT_FILTERS).toString()).toBe("");
  });
});
