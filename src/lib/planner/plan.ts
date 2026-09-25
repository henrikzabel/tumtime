import { formatSemesterShort, semesterKey, type Semester } from "@/lib/stats/semester";

/*
 * Study plan state lives in the browser (no accounts). It is a small, versioned JSON document
 * that can be shared via URL.
 */

export type PlanArea = string; // e.g. "Informatik", "Wahlmodule Informatik", "Überfachliche Grundlagen"

export type PlannedItem = {
  id: string;
  kind: "module" | "placeholder";
  moduleCode?: string;
  title: string;
  credits: number;
  area: PlanArea | null;
  /** Items of the recommended plan that must be taken (vs. user-added extras). */
  required?: boolean;
  alternativeGroup?: number;
};

export type PlanState = {
  version: 1;
  program: string; // program slug
  studyPlanId: number;
  startSemester: Semester;
  /** Semester number (1-based) → items. */
  semesters: Record<number, PlannedItem[]>;
};

export type StudyPlanEntryData = {
  semesterNo: number;
  kind: "module" | "placeholder";
  moduleCode: string | null;
  title: string;
  credits: number;
  area: string | null;
  alternativeGroup: number | null;
};

export type StudyPlanData = {
  id: number;
  title: string;
  startFrom: string | null;
  startUntil: string | null;
  requirements: { area: string; credits: number }[];
  footnotes: string[];
  entries: StudyPlanEntryData[];
};

export type ModuleCycle = "winter" | "summer" | "both" | null;

export const BACHELOR_CREDITS = 180;
export const MIN_SEMESTERS = 6;

let counter = 0;
export function newItemId(): string {
  counter += 1;
  return `${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Semester n (1-based) of a plan starting in `start`. */
export function termOf(start: Semester, n: number): Semester {
  const key = semesterKey(start) + (n - 1);
  const year = Math.floor(key / 2);
  return `${year}${key % 2 === 1 ? "WS" : "SS"}`;
}

export function termLabel(start: Semester, n: number): string {
  return formatSemesterShort(termOf(start, n));
}

/** Pick the study plan that applies to students starting in `start`. */
export function studyPlanFor<T extends Pick<StudyPlanData, "startFrom" | "startUntil">>(plans: T[], start: Semester): T | undefined {
  const k = semesterKey(start);
  return (
    plans.find((p) => {
      const from = p.startFrom ? semesterKey(p.startFrom as Semester) : -Infinity;
      const until = p.startUntil ? semesterKey(p.startUntil as Semester) : Infinity;
      return k >= from && k <= until;
    }) ?? plans[0]
  );
}

/** A fresh plan that follows the recommended study plan. */
export function createPlan(program: string, plan: StudyPlanData, startSemester: Semester): PlanState {
  const semesters: Record<number, PlannedItem[]> = {};
  const maxSem = Math.max(MIN_SEMESTERS, ...plan.entries.map((e) => e.semesterNo));
  for (let n = 1; n <= maxSem; n++) semesters[n] = [];
  for (const e of plan.entries) {
    semesters[e.semesterNo].push({
      id: newItemId(),
      kind: e.kind,
      ...(e.moduleCode ? { moduleCode: e.moduleCode } : {}),
      title: e.title,
      credits: e.credits,
      area: e.kind === "placeholder" ? e.title : e.area,
      ...(e.kind === "module" ? { required: true } : {}),
      ...(e.alternativeGroup ? { alternativeGroup: e.alternativeGroup } : {}),
    });
  }
  return { version: 1, program, studyPlanId: plan.id, startSemester, semesters };
}

export function allItems(state: PlanState): (PlannedItem & { semester: number })[] {
  return Object.entries(state.semesters).flatMap(([n, items]) => items.map((i) => ({ ...i, semester: Number(n) })));
}

export function semesterCredits(items: PlannedItem[]): number {
  return items.filter((i) => i.kind === "module" || i.kind === "placeholder").reduce((s, i) => s + i.credits, 0);
}

export type RequirementProgress = { area: string; required: number; planned: number };

export type PlanProgress = {
  totalCredits: number;
  /** Credits of concrete modules only (placeholders excluded). */
  concreteCredits: number;
  requiredModules: { planned: number; total: number; missing: string[] };
  requirements: RequirementProgress[];
};

/** How far the plan covers the program's requirements. */
export function computeProgress(state: PlanState, plan: StudyPlanData): PlanProgress {
  const items = allItems(state);
  const modulesIn = new Set(items.filter((i) => i.kind === "module").map((i) => i.moduleCode));

  // Required modules; an "oder" group counts once and is satisfied by any of its members.
  const groups = new Map<string, StudyPlanEntryData[]>();
  for (const e of plan.entries) {
    if (e.kind !== "module" || !e.moduleCode) continue;
    const key = e.alternativeGroup ? `g${e.semesterNo}-${e.alternativeGroup}` : e.moduleCode;
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }
  const missing: string[] = [];
  let planned = 0;
  for (const members of groups.values()) {
    if (members.some((m) => modulesIn.has(m.moduleCode!))) planned++;
    else missing.push(members.map((m) => m.moduleCode).join(" / "));
  }

  // Credit requirements (electives, Überfachliche, Anwendungsfach): concrete modules count.
  const requirements = plan.requirements.map((r) => ({
    area: r.area,
    required: r.credits,
    planned: items.filter((i) => i.kind === "module" && i.area === r.area).reduce((s, i) => s + i.credits, 0),
  }));

  return {
    totalCredits: items.reduce((s, i) => s + i.credits, 0),
    concreteCredits: items.filter((i) => i.kind === "module").reduce((s, i) => s + i.credits, 0),
    requiredModules: { planned, total: groups.size, missing },
    requirements,
  };
}

/** Warn when a module is placed in a term in which it is usually not offered. */
export function cycleWarning(cycle: ModuleCycle, term: Semester): string | null {
  if (!cycle || cycle === "both") return null;
  const isWinter = term.endsWith("WS");
  if (cycle === "winter" && !isWinter) return "Usually offered in winter semesters only";
  if (cycle === "summer" && isWinter) return "Usually offered in summer semesters only";
  return null;
}

// --- Mutations (pure; return a new state) ------------------------------------------------------

export function moveItem(state: PlanState, itemId: string, toSemester: number, index?: number): PlanState {
  const semesters: PlanState["semesters"] = {};
  let moving: PlannedItem | undefined;
  for (const [n, items] of Object.entries(state.semesters)) {
    semesters[Number(n)] = items.filter((i) => {
      if (i.id === itemId) moving = i;
      return i.id !== itemId;
    });
  }
  if (!moving) return state;
  semesters[toSemester] ??= [];
  const target = [...semesters[toSemester]];
  target.splice(index ?? target.length, 0, moving);
  semesters[toSemester] = target;
  return { ...state, semesters };
}

export function removeItem(state: PlanState, itemId: string): PlanState {
  const semesters: PlanState["semesters"] = {};
  for (const [n, items] of Object.entries(state.semesters)) semesters[Number(n)] = items.filter((i) => i.id !== itemId);
  return { ...state, semesters };
}

export function addItem(state: PlanState, semester: number, item: PlannedItem): PlanState {
  return { ...state, semesters: { ...state.semesters, [semester]: [...(state.semesters[semester] ?? []), item] } };
}

/** Replace an elective placeholder by a concrete module; it keeps the placeholder's area. */
export function fillPlaceholder(
  state: PlanState,
  placeholderId: string,
  module: { code: string; title: string; credits: number },
): PlanState {
  const semesters: PlanState["semesters"] = {};
  for (const [n, items] of Object.entries(state.semesters)) {
    semesters[Number(n)] = items.map((i) =>
      i.id === placeholderId && i.kind === "placeholder"
        ? { id: newItemId(), kind: "module", moduleCode: module.code, title: module.title, credits: module.credits, area: i.area }
        : i,
    );
  }
  return { ...state, semesters };
}

export function addSemester(state: PlanState): PlanState {
  const next = Math.max(0, ...Object.keys(state.semesters).map(Number)) + 1;
  return { ...state, semesters: { ...state.semesters, [next]: [] } };
}

/** Remove the last semester if it is empty. */
export function removeLastSemester(state: PlanState): PlanState {
  const last = Math.max(...Object.keys(state.semesters).map(Number));
  if (last <= MIN_SEMESTERS || state.semesters[last]?.length) return state;
  const semesters = { ...state.semesters };
  delete semesters[last];
  return { ...state, semesters };
}

// --- Sharing ---------------------------------------------------------------------------------

type Compact = [string, number, string, [number, string, string | null, number, string | null, 0 | 1, number?][]];

/** Encode a plan compactly into a URL-safe string. */
export function encodePlan(state: PlanState): string {
  const items = allItems(state).map(
    (i) =>
      [
        i.semester,
        i.kind === "module" ? (i.moduleCode ?? "") : `~${i.title}`,
        i.kind === "module" ? i.title : null,
        i.credits,
        i.area,
        i.required ? 1 : 0,
        ...(i.alternativeGroup ? [i.alternativeGroup] : []),
      ] as Compact[3][number],
  );
  const compact: Compact = [state.program, state.studyPlanId, state.startSemester, items];
  const bytes = new TextEncoder().encode(JSON.stringify(compact));
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodePlan(encoded: string): PlanState | null {
  try {
    const bin = atob(encoded.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const [program, studyPlanId, startSemester, items] = JSON.parse(new TextDecoder().decode(bytes)) as Compact;
    if (typeof program !== "string" || !/^\d{4}(WS|SS)$/.test(startSemester) || !Array.isArray(items)) return null;
    const semesters: PlanState["semesters"] = {};
    for (let n = 1; n <= MIN_SEMESTERS; n++) semesters[n] = [];
    for (const [sem, codeOrTitle, title, credits, area, required, group] of items) {
      const isPlaceholder = codeOrTitle.startsWith("~");
      (semesters[sem] ??= []).push({
        id: newItemId(),
        kind: isPlaceholder ? "placeholder" : "module",
        ...(isPlaceholder ? {} : { moduleCode: codeOrTitle }),
        title: isPlaceholder ? codeOrTitle.slice(1) : (title ?? codeOrTitle),
        credits: Number(credits) || 0,
        area,
        ...(required ? { required: true } : {}),
        ...(group ? { alternativeGroup: group } : {}),
      });
    }
    return { version: 1, program, studyPlanId: Number(studyPlanId), startSemester: startSemester as Semester, semesters };
  } catch {
    return null;
  }
}
