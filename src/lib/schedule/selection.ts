import type { Choice } from "@/lib/planner/choices";
import { weeklySlots, type WeeklySlot } from "@/lib/planner/timetable";

/** "Not attending" marker in a schedule's selection. */
export const SKIP = -1;

export type Selection = Record<string, number>;

/** Weekly slots of every group, by group id. */
export function slotsByGroup(choices: Choice[]): Map<number, WeeklySlot[]> {
  const map = new Map<number, WeeklySlot[]>();
  for (const ch of choices) for (const o of ch.options) map.set(o.groupId, weeklySlots(o.events));
  return map;
}

/** The group actually used per choice: the explicit selection, or the only option. */
export function effectiveSelection(choices: Choice[], selection: Selection): Record<string, number> {
  const out: Record<string, number> = {};
  for (const ch of choices) {
    const sel = selection[ch.key];
    if (sel === SKIP) continue;
    if (sel && ch.options.some((o) => o.groupId === sel)) out[ch.key] = sel;
    else if (ch.options.length === 1) out[ch.key] = ch.options[0].groupId;
  }
  return out;
}

export const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];

export type CalendarBlock = { key: string; slot: WeeklySlot; title: string; label: string; color: string; clash: boolean };

export function calendarBlocks(
  choices: Choice[],
  chosen: Record<string, number>,
  slots: Map<number, WeeklySlot[]>,
  colorOf: (moduleCode: string) => string,
  clashing: Set<string> = new Set(),
): CalendarBlock[] {
  return choices.flatMap((ch) => {
    const opt = ch.options.find((o) => o.groupId === chosen[ch.key]);
    if (!opt) return [];
    return (slots.get(opt.groupId) ?? []).map((s) => ({
      key: `${ch.key}-${opt.groupId}-${s.weekday}-${s.startMinutes}`,
      slot: s,
      title: ch.title,
      label: `${ch.activity ?? ""}${ch.options.length > 1 ? ` · ${opt.label}` : ""}`,
      color: colorOf(ch.moduleCode),
      clash: clashing.has(ch.key),
    }));
  });
}
