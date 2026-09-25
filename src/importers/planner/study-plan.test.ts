import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { parseCell, parseCitStudyPlanPage } from "./study-plan";

const fixture = (name: string) => readFileSync(path.join(__dirname, "../__fixtures__/planner", name), "utf8");

describe("parseCitStudyPlanPage – B.Sc. Informatik", () => {
  const { plans, warnings } = parseCitStudyPlanPage(fixture("cit-studienplan-bsc-informatik.html"));
  const current = plans[0];

  it("finds every cohort with its validity range and TUMonline curriculum", () => {
    expect(warnings).toEqual([]);
    expect(plans).toHaveLength(6);
    expect(current).toMatchObject({ startFrom: "2026SS", startUntil: null, tumonlineCurriculumId: 5440 });
    expect(plans[1]).toMatchObject({ startFrom: "2024WS", startUntil: "2025WS", tumonlineCurriculumId: 5371 });
  });

  it("reads modules per semester with credits, area and markers", () => {
    expect(current.semesters.map((s) => s.number)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(current.semesters[0].credits).toBe(28);
    expect(current.semesters[0].entries).toEqual([
      expect.objectContaining({ moduleCode: "CIT123001", credits: 12, area: "Informatik", markers: "*" }),
      expect.objectContaining({ moduleCode: "IN0004", credits: 8, area: "Informatik" }),
      expect.objectContaining({ moduleCode: "IN0015", credits: 8, area: "Mathematik" }),
    ]);
    const sem2 = current.semesters[1].entries;
    expect(sem2.find((e) => e.moduleCode === "IN0005")?.area).toBe("Praktika, Projekte, Seminare");
  });

  it("keeps elective placeholders and the credit requirements from the footnotes", () => {
    expect(current.semesters[4].entries[0]).toMatchObject({ kind: "placeholder", title: "Wahlmodule Informatik", credits: 5 });
    expect(current.requirements).toEqual([
      { area: "Überfachliche Grundlagen", credits: 6 },
      { area: "Anwendungsfach", credits: 21 },
      { area: "Wahlmodule Informatik", credits: 18 },
    ]);
    expect(current.footnotes[0]).toMatch(/Grundlagenprüfungen/);
  });

  it("adds up to 180 credits with the extra requirements", () => {
    const planned = current.semesters.flatMap((s) => s.entries).reduce((sum, e) => sum + e.credits, 0);
    const extra = current.requirements
      .filter((r) => !r.area.startsWith("Wahlmodule"))
      .reduce((sum, r) => sum + r.credits, 0);
    expect(planned + extra).toBe(180);
  });
});

describe("parseCitStudyPlanPage – B.Sc. Wirtschaftsinformatik", () => {
  const { plans } = parseCitStudyPlanPage(fixture("cit-studienplan-bsc-wirtschaftsinformatik.html"));
  const current = plans[0];

  it("reads area headers from the table head and splits multi-module cells", () => {
    expect(current.tumonlineCurriculumId).toBe(5441);
    const sem2 = current.semesters[1].entries;
    expect(sem2.filter((e) => e.area === "Informatik").map((e) => e.moduleCode)).toEqual(["IN0006", "IN0007"]);
    expect(sem2.find((e) => e.moduleCode === "WI001057_E")?.area).toBe("Wirtschaftswissenschaften");
  });

  it("groups 'oder' alternatives", () => {
    const sem4 = current.semesters[3].entries;
    const a = sem4.find((e) => e.moduleCode === "IN0018");
    const b = sem4.find((e) => e.moduleCode === "CIT5130002");
    expect(a?.alternativeGroup).toBeDefined();
    expect(a?.alternativeGroup).toBe(b?.alternativeGroup);
  });

  it("extracts both elective requirements", () => {
    expect(current.requirements).toEqual([
      { area: "Überfachliche Grundlagen", credits: 8 },
      { area: "Wahlmodule Informatik", credits: 10 },
      { area: "Wahlmodule Wirtschaftswissenschaften", credits: 6 },
    ]);
    expect(plans[1]).toMatchObject({ startFrom: "2023WS", startUntil: "2025WS" });
  });
});

describe("parseCell", () => {
  it("normalises singular elective names", () => {
    const [e] = parseCell("Wahlmodul Informatik *** 5 Credits", "Informatik", () => 1);
    expect(e).toMatchObject({ kind: "placeholder", title: "Wahlmodule Informatik", markers: "***" });
  });
  it("handles titles containing numbers", () => {
    const [e] = parseCell("IN0001 Einführung in die Informatik 1 * 6 Credits", null, () => 1);
    expect(e).toMatchObject({ moduleCode: "IN0001", title: "Einführung in die Informatik 1", credits: 6 });
  });
});
