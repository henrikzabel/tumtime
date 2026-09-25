/*
 * Timetable helpers. All wall-clock computations happen in Europe/Berlin, independent of the
 * viewer's time zone, because that is where the classes take place.
 */

export const TIME_ZONE = "Europe/Berlin";

export type TimedEvent = { start: string; end: string; canceled?: boolean; room?: string | null };

export type WeeklySlot = {
  weekday: number; // 1 = Monday … 7 = Sunday
  startMinutes: number; // minutes after midnight, Berlin time
  endMinutes: number;
  room: string | null;
  occurrences: number;
};

const parts = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const WEEKDAYS: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

export function berlinClock(iso: string): { weekday: number; minutes: number } {
  const p = Object.fromEntries(parts.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return { weekday: WEEKDAYS[p.weekday], minutes: Number(p.hour) * 60 + Number(p.minute) };
}

/**
 * Condense a group's dates into its recurring weekly slots (e.g. "Thu 12:00–14:00"). Slots that
 * occur only once are dropped unless the group has no recurring slot at all.
 */
export function weeklySlots(events: TimedEvent[]): WeeklySlot[] {
  const map = new Map<string, WeeklySlot>();
  for (const e of events) {
    if (e.canceled) continue;
    const s = berlinClock(e.start);
    const end = berlinClock(e.end);
    const key = `${s.weekday}-${s.minutes}-${end.minutes}`;
    const slot = map.get(key) ?? { weekday: s.weekday, startMinutes: s.minutes, endMinutes: end.minutes, room: e.room ?? null, occurrences: 0 };
    slot.occurrences++;
    map.set(key, slot);
  }
  const all = [...map.values()].sort((a, b) => a.weekday - b.weekday || a.startMinutes - b.startMinutes);
  const recurring = all.filter((s) => s.occurrences >= 2);
  return recurring.length ? recurring : all;
}

export function overlaps(a: WeeklySlot, b: WeeklySlot): boolean {
  return a.weekday === b.weekday && a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes;
}

/** Pairs of (keyA, keyB) whose weekly slots overlap. */
export function findClashes<K extends string>(slotsByKey: Record<K, WeeklySlot[]>): [K, K][] {
  const keys = Object.keys(slotsByKey) as K[];
  const clashes: [K, K][] = [];
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      if (slotsByKey[keys[i]].some((a) => slotsByKey[keys[j]].some((b) => overlaps(a, b)))) clashes.push([keys[i], keys[j]]);
    }
  }
  return clashes;
}

export const DAY_NAMES = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function formatMinutes(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export function formatSlot(s: WeeklySlot): string {
  return `${DAY_NAMES[s.weekday]} ${formatMinutes(s.startMinutes)}–${formatMinutes(s.endMinutes)}`;
}

// --- iCalendar export --------------------------------------------------------------------------

const icsDate = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const icsText = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, (c) => `\\${c}`);

/** Fold lines longer than 75 octets as required by RFC 5545. */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (new TextEncoder().encode(rest).length > 75) {
    let cut = 74;
    while (new TextEncoder().encode(rest.slice(0, cut)).length > 74) cut--;
    out.push(rest.slice(0, cut));
    rest = ` ${rest.slice(cut)}`;
  }
  out.push(rest);
  return out.join("\r\n");
}

export type IcsEvent = { uid: string; title: string; start: string; end: string; location?: string | null; url?: string | null };

export function toIcs(events: IcsEvent[], calendarName = "TUM Time"): string {
  const now = icsDate(new Date().toISOString());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TUM Time//Timetable//EN",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${icsText(calendarName)}`,
  ];
  for (const e of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}@tumtime`,
      `DTSTAMP:${now}`,
      `DTSTART:${icsDate(e.start)}`,
      `DTEND:${icsDate(e.end)}`,
      `SUMMARY:${icsText(e.title)}`,
      ...(e.location ? [`LOCATION:${icsText(e.location)}`] : []),
      ...(e.url ? [`URL:${e.url}`] : []),
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
