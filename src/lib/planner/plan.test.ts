import { describe, expect, it } from "vitest";

import {
  addItem,
  addSemester,
  computeProgress,
  createPlan,
  cycleWarning,
  decodePlan,
  encodePlan,
  fillPlaceholder,
  moveItem,
  removeItem,
  removeLastSemester,
  studyPlanFor,
  termLabel,
  termOf,
  type StudyPlanData,
} from "./plan";

const plan: StudyPlanData = {
  id: 7,
  title: "Studienplan ab SS 2026",
  startFrom: "2026SS",
  startUntil: null,
  requirements: [
    { area: "Wahlmodule Informatik", credits: 18 },
    { area: "Überfachliche Grundlagen", credits: 6 },
  ],
  footnotes: [],
  entries: [
    { semesterNo: 1, kind: "module", moduleCode: "IN0015", title: "Diskrete Strukturen", credits: 8, area: "Mathematik", alternativeGroup: null },
    { semesterNo: 1, kind: "module", moduleCode: "IN0004", title: "Rechnerarchitektur", credits: 8, area: "Informatik", alternativeGroup: null },
    { semesterNo: 4, kind: "module", moduleCode: "IN0018", title: "DWT", credits: 6, area: "Mathematik", alternativeGroup: 1 },
    { semesterNo: 4, kind: "module", moduleCode: "CIT5130002", title: "Data Science", credits: 6, area: "Mathematik", alternativeGroup: 1 },
    { semesterNo: 5, kind: "placeholder", moduleCode: null, title: "Wahlmodule Informatik", credits: 5, area: "Informatik", alternativeGroup: null },
  ],
};

describe("terms", () => {
  it("maps semester numbers to terms", () => {
    expect(termOf("2025WS", 1)).toBe("2025WS");
    expect(termOf("2025WS", 2)).toBe("2026SS");
    expect(termOf("2025WS", 3)).toBe("2026WS");
    expect(termOf("2026SS", 2)).toBe("2026WS");
    expect(termLabel("2025WS", 2)).toBe("SS 26");
  });

  it("picks the study plan for a starting semester", () => {
    const plans = [
      { startFrom: "2026SS", startUntil: null, id: 1 },
      { startFrom: "2024WS", startUntil: "2025WS", id: 2 },
    ];
    expect(studyPlanFor(plans, "2026WS")?.id).toBe(1);
    expect(studyPlanFor(plans, "2025WS")?.id).toBe(2);
    expect(studyPlanFor(plans, "2010WS")?.id).toBe(1); // fallback: first (newest)
  });
});

describe("createPlan + computeProgress", () => {
  const state = createPlan("bsc-informatics", plan, "2026WS");

  it("follows the recommended plan", () => {
    expect(Object.keys(state.semesters)).toHaveLength(6);
    expect(state.semesters[1].map((i) => i.moduleCode)).toEqual(["IN0015", "IN0004"]);
    expect(state.semesters[5][0]).toMatchObject({ kind: "placeholder", area: "Wahlmodule Informatik" });
  });

  it("counts an 'oder' group once and reports missing modules", () => {
    const p = computeProgress(state, plan);
    expect(p.requiredModules).toMatchObject({ planned: 3, total: 3 });
    const without = removeItem(state, state.semesters[1][0].id);
    expect(computeProgress(without, plan).requiredModules.missing).toEqual(["IN0015"]);
    const noAlt = removeItem(removeItem(state, state.semesters[4][0].id), state.semesters[4][1].id);
    expect(computeProgress(noAlt, plan).requiredModules.missing).toEqual(["IN0018 / CIT5130002"]);
  });

  it("counts filled electives towards their area", () => {
    const placeholder = state.semesters[5][0];
    const filled = fillPlaceholder(state, placeholder.id, { code: "IN2346", title: "Deep Learning", credits: 6 });
    const p = computeProgress(filled, plan);
    expect(p.requirements.find((r) => r.area === "Wahlmodule Informatik")).toEqual({
      area: "Wahlmodule Informatik",
      required: 18,
      planned: 6,
    });
    expect(p.concreteCredits).toBe(8 + 8 + 6 + 6 + 6);
  });
});

describe("mutations", () => {
  const state = createPlan("x", plan, "2026WS");
  it("moves items between semesters", () => {
    const id = state.semesters[1][1].id;
    const moved = moveItem(state, id, 2, 0);
    expect(moved.semesters[1]).toHaveLength(1);
    expect(moved.semesters[2][0].id).toBe(id);
  });
  it("adds and removes semesters", () => {
    const more = addSemester(state);
    expect(Object.keys(more.semesters)).toHaveLength(7);
    expect(Object.keys(removeLastSemester(more).semesters)).toHaveLength(6);
    const busy = addItem(more, 7, { id: "a", kind: "module", moduleCode: "IN1", title: "t", credits: 5, area: null });
    expect(Object.keys(removeLastSemester(busy).semesters)).toHaveLength(7);
  });
});

describe("cycleWarning", () => {
  it("warns about terms without an offer", () => {
    expect(cycleWarning("winter", "2027SS")).toMatch(/winter/);
    expect(cycleWarning("summer", "2026WS")).toMatch(/summer/);
    expect(cycleWarning("winter", "2026WS")).toBeNull();
    expect(cycleWarning("both", "2026WS")).toBeNull();
    expect(cycleWarning(null, "2026WS")).toBeNull();
  });
});

describe("share links", () => {
  it("round-trips a plan including umlauts and placeholders", () => {
    let state = createPlan("bsc-informatics", plan, "2026WS");
    state = addItem(state, 2, { id: "x", kind: "module", moduleCode: "SZ0488", title: "Französisch A1", credits: 3, area: "Überfachliche Grundlagen" });
    const decoded = decodePlan(encodePlan(state))!;
    const strip = (s: typeof state) =>
      Object.fromEntries(Object.entries(s.semesters).map(([k, v]) => [k, v.map((item) => ({ ...item, id: "" }))]));
    expect(decoded).toMatchObject({ program: "bsc-informatics", studyPlanId: 7, startSemester: "2026WS" });
    expect(strip(decoded)).toEqual(strip(state));
    expect(encodePlan(state)).toMatch(/^[A-Za-z0-9_-]+$/);
  });
  it("rejects garbage", () => {
    expect(decodePlan("not-a-plan")).toBeNull();
  });
});
