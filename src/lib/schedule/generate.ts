import { overlaps, type WeeklySlot } from "@/lib/planner/timetable";

/**
 * Schedule generation (like Berkeleytime's "Generate schedules"): given the lecture/tutorial
 * choices of a schedule, enumerate all combinations of groups without time clashes and rank them
 * by the student's preferences.
 */
export type GenChoice = { key: string; options: { groupId: number; slots: WeeklySlot[] }[] };

export type Preferences = {
  /** Penalise classes starting before this time (minutes after midnight); null = don't care. */
  notBefore: number | null;
  /** Penalise classes ending after this time; null = don't care. */
  notAfter: number | null;
  fewerDays: boolean;
  shortGaps: boolean;
  /** Weekdays (1–7) to keep free if possible. */
  freeDays: number[];
};

export const DEFAULT_PREFERENCES: Preferences = { notBefore: null, notAfter: null, fewerDays: true, shortGaps: true, freeDays: [] };

export type ScheduleSummary = {
  days: number[];
  earliest: number | null;
  latest: number | null;
  /** Free minutes between classes on the same day (summed over the week). */
  gapMinutes: number;
  /** Class minutes per week. */
  classMinutes: number;
};

export function summarize(slots: WeeklySlot[]): ScheduleSummary {
  const byDay = new Map<number, WeeklySlot[]>();
  for (const s of slots) byDay.set(s.weekday, [...(byDay.get(s.weekday) ?? []), s]);
  let gapMinutes = 0;
  let classMinutes = 0;
  for (const day of byDay.values()) {
    day.sort((a, b) => a.startMinutes - b.startMinutes);
    let end = day[0].startMinutes;
    for (const s of day) {
      // Merge overlapping blocks so double-booked time isn't counted twice.
      if (s.startMinutes > end) gapMinutes += s.startMinutes - end;
      classMinutes += Math.max(0, s.endMinutes - Math.max(s.startMinutes, end));
      end = Math.max(end, s.endMinutes);
    }
  }
  return {
    days: [...byDay.keys()].sort(),
    earliest: slots.length ? Math.min(...slots.map((s) => s.startMinutes)) : null,
    latest: slots.length ? Math.max(...slots.map((s) => s.endMinutes)) : null,
    gapMinutes,
    classMinutes,
  };
}

/** Lower is better. */
export function scoreSchedule(slots: WeeklySlot[], prefs: Preferences): number {
  const s = summarize(slots);
  let score = 0;
  if (prefs.fewerDays) score += s.days.length * 120;
  if (prefs.shortGaps) score += s.gapMinutes * 0.5;
  for (const slot of slots) {
    if (prefs.notBefore !== null && slot.startMinutes < prefs.notBefore) score += 60 + (prefs.notBefore - slot.startMinutes);
    if (prefs.notAfter !== null && slot.endMinutes > prefs.notAfter) score += 60 + (slot.endMinutes - prefs.notAfter);
    if (prefs.freeDays.includes(slot.weekday)) score += 200;
  }
  return score;
}

export type GeneratedSchedule = { selection: Record<string, number>; score: number; summary: ScheduleSummary };

/**
 * Enumerate clash-free combinations. Choices with a single option are fixed (clashes among fixed
 * items are tolerated, since the student can't change them); every choice with several options
 * gets a group that clashes with nothing already chosen. Returns the best `limit` schedules.
 */
export function generateSchedules(
  choices: GenChoice[],
  prefs: Preferences = DEFAULT_PREFERENCES,
  { limit = 20, maxNodes = 200_000 }: { limit?: number; maxNodes?: number } = {},
): { results: GeneratedSchedule[]; total: number; truncated: boolean } {
  const fixed = choices.filter((c) => c.options.length === 1);
  const open = choices.filter((c) => c.options.length > 1).sort((a, b) => a.options.length - b.options.length);
  const base: Record<string, number> = Object.fromEntries(fixed.map((c) => [c.key, c.options[0].groupId]));
  const fixedSlots = fixed.flatMap((c) => c.options[0].slots);

  const results: GeneratedSchedule[] = [];
  let total = 0;
  let nodes = 0;
  let truncated = false;
  const chosen: Record<string, number> = {};
  const slots: WeeklySlot[] = [...fixedSlots];

  const consider = () => {
    total++;
    const score = scoreSchedule(slots, prefs);
    if (results.length < limit || score < results[results.length - 1].score) {
      results.push({ selection: { ...base, ...chosen }, score, summary: summarize(slots) });
      results.sort((a, b) => a.score - b.score);
      if (results.length > limit) results.pop();
    }
  };

  const visit = (i: number) => {
    if (truncated) return;
    if (++nodes > maxNodes) {
      truncated = true;
      return;
    }
    if (i === open.length) return consider();
    const choice = open[i];
    for (const o of choice.options) {
      if (o.slots.some((s) => slots.some((t) => overlaps(s, t)))) continue;
      chosen[choice.key] = o.groupId;
      slots.push(...o.slots);
      visit(i + 1);
      slots.splice(slots.length - o.slots.length, o.slots.length);
      delete chosen[choice.key];
    }
  };
  visit(0);
  return { results, total, truncated };
}
