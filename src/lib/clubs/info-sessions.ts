import { z } from "zod";

import { TIME_ZONE } from "@/lib/planner/timetable";

/*
 * Central info session weeks: a period (e.g. two weeks, Mon–Thu evenings) is split into cells —
 * one per night × time slot × room. Clubs submit preferences; `planInfoSessions` assigns every
 * club one cell so that
 *   - hard constraints hold (one club per cell, never on a night the club blocked),
 *   - preferred nights/times and the preferred campus are respected where possible,
 *   - clubs with the same focus area never run at the same time (students interested in a topic
 *     can attend all of its sessions),
 *   - nights are evenly filled.
 * All wall-clock times are Europe/Berlin.
 */

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM");
export const slotSchema = z
  .object({ start: time, end: time })
  .refine((s) => s.start < s.end, "A slot must end after it starts");
export const venueSchema = z.object({
  name: z.string().trim().min(1, "Every room needs a name").max(80),
  campus: z.string().trim().max(40).default(""),
  capacity: z.number().int().min(0).max(5000).nullable().default(null),
});
export type Slot = z.infer<typeof slotSchema>;
export type Venue = z.infer<typeof venueSchema>;

/** "18:00-18:45" per line. */
export function parseSlots(text: string) {
  const slots = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [start = "", end = ""] = l.split(/\s*[-–]\s*/);
      return { start: start.padStart(5, "0"), end: end.padStart(5, "0") };
    });
  return slotSchema.array().min(1, "Add at least one time slot").max(8).safeParse(slots);
}

/** "Room | Campus | Capacity" per line. */
export function parseVenues(text: string) {
  const venues = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [name = "", campus = "", capacity = ""] = l.split("|").map((x) => x.trim());
      return { name, campus, capacity: capacity ? Number(capacity) : null };
    });
  const parsed = venueSchema.array().min(1, "Add at least one room").max(12).safeParse(venues);
  if (parsed.success && new Set(parsed.data.map((v) => v.name)).size !== parsed.data.length) {
    return { success: false as const, error: { issues: [{ message: "Room names must be unique" }] } };
  }
  return parsed;
}

export const formatSlots = (slots: Slot[]) => slots.map((s) => `${s.start}-${s.end}`).join("\n");
export const formatVenues = (venues: Venue[]) =>
  venues.map((v) => [v.name, v.campus, v.capacity ?? ""].join(" | ").replace(/( \| )+$/, "")).join("\n");

export type PeriodShape = { startsOn: string; endsOn: string; weekdays: number[]; slots: Slot[]; venues: Venue[] };

export type Cell = {
  key: string; // `${date}|${start}|${venue}`
  date: string; // YYYY-MM-DD
  weekday: number; // 1 = Monday
  start: string;
  end: string;
  venue: string;
  campus: string;
};

export const cellKey = (date: string, start: string, venue: string) => `${date}|${start}|${venue}`;

/** ISO weekday (1 = Monday) of a calendar date. */
export function isoWeekday(date: string): number {
  const d = new Date(`${date}T12:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** The nights of a period, capped at 90 days so a typo can't create thousands of cells. */
export function periodDates(p: Pick<PeriodShape, "startsOn" | "endsOn" | "weekdays">): string[] {
  const out: string[] = [];
  for (let d = p.startsOn, i = 0; d <= p.endsOn && i < 90; d = addDays(d, 1), i++) {
    if (p.weekdays.includes(isoWeekday(d))) out.push(d);
  }
  return out;
}

export function periodCells(p: PeriodShape): Cell[] {
  const slots = [...p.slots].sort((a, b) => a.start.localeCompare(b.start));
  return periodDates(p).flatMap((date) =>
    slots.flatMap((s) =>
      p.venues.map((v) => ({
        key: cellKey(date, s.start, v.name),
        date,
        weekday: isoWeekday(date),
        start: s.start,
        end: s.end,
        venue: v.name,
        campus: v.campus,
      })),
    ),
  );
}

// --- Time zone helpers ---------------------------------------------------------------------------

const berlinParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Berlin wall-clock date and time of an instant. */
export function toBerlin(d: Date): { date: string; time: string } {
  const p = Object.fromEntries(berlinParts.formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

/** The instant at which it is `time` on `date` in Berlin. */
export function fromBerlin(date: string, time: string): Date {
  const naive = Date.parse(`${date}T${time}:00Z`);
  const offsetAt = (ms: number) => {
    const { date: d, time: t } = toBerlin(new Date(ms));
    return Date.parse(`${d}T${t}:00Z`) - ms;
  };
  let ms = naive - offsetAt(naive);
  ms = naive - offsetAt(ms); // second pass for instants close to a DST switch
  return new Date(ms);
}

/** Monday of the ISO week containing `date`. */
export function weekStart(date: string): string {
  return addDays(date, 1 - isoWeekday(date));
}

// --- Scheduling ----------------------------------------------------------------------------------

export type ScheduleRequest = {
  clubId: number;
  name: string;
  focusAreas: string[];
  preferredDates: string[];
  avoidDates: string[];
  preferredTimes: string[];
  campus: string | null;
};

export type Placed = { clubId: number; cell: Cell; focusAreas: string[] };

export const WEIGHTS = {
  notPreferredDate: 6,
  notPreferredTime: 3,
  wrongCampus: 8,
  topicClash: 20, // per shared focus area in a parallel session
  nightLoad: 1, // per session already on that night
} as const;

/** Cost of putting `req` into `cell`, given the sessions already placed; Infinity = not allowed. */
export function cellCost(req: ScheduleRequest, cell: Cell, placed: Placed[]): number {
  if (req.avoidDates.includes(cell.date)) return Infinity;
  if (placed.some((p) => p.cell.key === cell.key)) return Infinity;
  let cost = 0;
  if (req.preferredDates.length && !req.preferredDates.includes(cell.date)) cost += WEIGHTS.notPreferredDate;
  if (req.preferredTimes.length && !req.preferredTimes.includes(cell.start)) cost += WEIGHTS.notPreferredTime;
  if (req.campus && cell.campus && req.campus !== cell.campus) cost += WEIGHTS.wrongCampus;
  for (const p of placed) {
    if (p.cell.date !== cell.date) continue;
    cost += WEIGHTS.nightLoad;
    if (p.cell.start === cell.start) cost += WEIGHTS.topicClash * p.focusAreas.filter((a) => req.focusAreas.includes(a)).length;
  }
  return cost;
}

export type PlanResult = { placed: Placed[]; unplaced: ScheduleRequest[] };

/**
 * Greedy assignment: the most constrained club (fewest allowed cells, then most preferences)
 * picks its cheapest cell first. Deterministic for the same input. `fixed` sessions (already
 * scheduled, e.g. moved by hand) are kept and taken into account.
 */
export function planInfoSessions(cells: Cell[], requests: ScheduleRequest[], fixed: Placed[] = []): PlanResult {
  const placed = [...fixed];
  const fixedClubs = new Set(fixed.map((f) => f.clubId));
  const allowed = (r: ScheduleRequest) => cells.filter((c) => !r.avoidDates.includes(c.date)).length;
  const todo = requests
    .filter((r) => !fixedClubs.has(r.clubId))
    .sort(
      (a, b) =>
        allowed(a) - allowed(b) ||
        b.preferredDates.length + b.preferredTimes.length - (a.preferredDates.length + a.preferredTimes.length) ||
        a.name.localeCompare(b.name) ||
        a.clubId - b.clubId,
    );
  const unplaced: ScheduleRequest[] = [];
  for (const req of todo) {
    let best: Cell | null = null;
    let bestCost = Infinity;
    for (const cell of cells) {
      const cost = cellCost(req, cell, placed);
      if (cost < bestCost) {
        best = cell;
        bestCost = cost;
      }
    }
    if (best) placed.push({ clubId: req.clubId, cell: best, focusAreas: req.focusAreas });
    else unplaced.push(req);
  }
  return { placed, unplaced };
}

/** Pairs of sessions at the same time that share a focus area. */
export function topicClashes<T extends { id: number | string; date: string; start: string; focusAreas: string[] }>(
  sessions: T[],
): [T, T, string[]][] {
  const out: [T, T, string[]][] = [];
  for (let i = 0; i < sessions.length; i++) {
    for (let j = i + 1; j < sessions.length; j++) {
      const a = sessions[i];
      const b = sessions[j];
      if (a.date !== b.date || a.start !== b.start) continue;
      const shared = a.focusAreas.filter((x) => b.focusAreas.includes(x));
      if (shared.length) out.push([a, b, shared]);
    }
  }
  return out;
}

// --- Display -------------------------------------------------------------------------------------

export const PERIOD_STATUSES = {
  draft: "Draft (only admins)",
  collecting: "Collecting club requests",
  published: "Published",
} as const;
export type PeriodStatus = keyof typeof PERIOD_STATUSES;

// Formatted by hand, not with Intl: server (Node ICU) and browsers disagree on punctuation
// ("Mon, 12 Oct" vs "Mon 12 Oct"), which breaks hydration of client components.
const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKDAY_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const dayMonth = (date: string, months: string[]) => `${Number(date.slice(8, 10))} ${months[Number(date.slice(5, 7)) - 1]}`;

/** "Mon 12 Oct" */
export const formatDay = (date: string) => `${WEEKDAY_SHORT[isoWeekday(date) - 1]} ${dayMonth(date, MONTH_SHORT)}`;
/** "Monday 12 October" */
export const formatLongDay = (date: string) => `${WEEKDAY_LONG[isoWeekday(date) - 1]} ${dayMonth(date, MONTH_LONG)}`;
/** "12 Oct – 23 Oct" */
export const formatRange = (startsOn: string, endsOn: string) => `${dayMonth(startsOn, MONTH_SHORT)} – ${dayMonth(endsOn, MONTH_SHORT)}`;
/** "6 Oct" for an instant, in Berlin time. */
export const formatShortDate = (d: Date) => dayMonth(toBerlin(d).date, MONTH_SHORT);
