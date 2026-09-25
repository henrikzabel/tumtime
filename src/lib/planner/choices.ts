import type { TimetableCourse, TimetableEvent } from "./queries";

/**
 * TUMonline often splits the tutorials of one module into several "courses" (e.g. "Übungen zu
 * Diskrete Strukturen - 1 (Mo)", "- 2 (Di)", …). For students this is a single choice: pick one
 * tutorial group. Lectures stay separate choices (usually with a single group).
 */
export type ChoiceOption = { groupId: number; courseId: number; label: string; events: TimetableEvent[] };

export type Choice = {
  key: string;
  moduleCode: string;
  title: string;
  activity: string | null;
  tumonlineUrl: string | null;
  options: ChoiceOption[];
};

const MERGE_ACTIVITIES = new Set(["UE", "TT", "PR", "SE", "UV", "KO", "PS"]);

/** "Übungen zu Diskrete Strukturen (IN0015) - 1 (Mo)" → "Übungen zu Diskrete Strukturen (IN0015)" */
export function baseTitle(title: string): string {
  return title
    .replace(/\s+-\s+(?:Gruppen?|Groups?)\s+[^()]*/i, " ") // "- Gruppen Do, Fr" / "- Groups Thu, Fri"
    .replace(/\s+-\s+\d+\s*\([^)]*\)\s*$/, "") // "- 1 (Mo)"
    .replace(/,\s*(Mon|Tue|Wed|Thu|Fri)(,\s*(Mon|Tue|Wed|Thu|Fri))*\s*$/i, "") // ", Mon, Tue"
    .replace(/\s+/g, " ")
    .trim();
}

export function buildChoices(courses: TimetableCourse[], preferredCodes: string[] = []): Choice[] {
  const byKey = new Map<string, Choice>();
  for (const c of courses) {
    const moduleCode = c.moduleCodes.find((m) => preferredCodes.includes(m)) ?? c.moduleCodes[0];
    const merge = c.activity !== null && MERGE_ACTIVITIES.has(c.activity);
    const key = merge ? `${moduleCode}|${c.activity}` : `course-${c.id}`;
    const choice =
      byKey.get(key) ??
      ({ key, moduleCode, title: baseTitle(c.title), activity: c.activity, tumonlineUrl: c.tumonlineUrl, options: [] } satisfies Choice);
    for (const g of c.groups) {
      const isDefault = /^standardgruppe$|^default group$/i.test(g.name) || c.groups.length === 1;
      choice.options.push({
        groupId: g.id,
        courseId: c.id,
        label: isDefault && merge ? c.title.replace(choice.title, "").replace(/^\s*[-,]\s*/, "") || g.name : g.name,
        events: g.events,
      });
    }
    if (c.title.length < choice.title.length) choice.title = baseTitle(c.title);
    byKey.set(key, choice);
  }
  return [...byKey.values()].sort(
    (a, b) =>
      preferredCodes.indexOf(a.moduleCode) - preferredCodes.indexOf(b.moduleCode) ||
      (a.activity === "VO" ? -1 : 0) - (b.activity === "VO" ? -1 : 0),
  );
}
