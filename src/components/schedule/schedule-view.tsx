import { WeekGrid } from "@/components/schedule/week-grid";
import { buildChoices } from "@/lib/planner/choices";
import type { TimetableCourse } from "@/lib/planner/queries";
import { findClashes, formatMinutes, formatSlot, type WeeklySlot } from "@/lib/planner/timetable";
import { summarize } from "@/lib/schedule/generate";
import type { ScheduleEntry } from "@/lib/schedule/queries";
import { calendarBlocks, COLORS, effectiveSelection, slotsByGroup, type Selection } from "@/lib/schedule/selection";

/** Read-only schedule: stats, list of chosen groups and the week grid (share page, compare). */
export function ScheduleView({
  entries,
  courses,
  selection,
  compact = false,
}: {
  entries: ScheduleEntry[];
  courses: TimetableCourse[];
  selection: Selection;
  compact?: boolean;
}) {
  const keys = entries.map((e) => e.key);
  const colorOf = (key: string) => COLORS[Math.max(0, keys.indexOf(key)) % COLORS.length];
  const choices = buildChoices(courses, keys);
  const slots = slotsByGroup(choices);
  const chosen = effectiveSelection(choices, selection);
  const chosenSlots: Record<string, WeeklySlot[]> = Object.fromEntries(Object.entries(chosen).map(([k, g]) => [k, slots.get(g) ?? []]));
  const clashing = new Set(findClashes(chosenSlots).flat());
  const s = summarize(Object.values(chosenSlots).flat());
  const stats = [
    ["ECTS", String(entries.reduce((sum, e) => sum + (e.ects ?? 0), 0) || "–")],
    ["Hours / week", s.classMinutes ? (s.classMinutes / 60).toFixed(1) : "–"],
    ["Days", String(s.days.length || "–")],
    ["Earliest – latest", s.earliest !== null ? `${formatMinutes(s.earliest)} – ${formatMinutes(s.latest!)}` : "–"],
    ["Clashes", String(findClashes(chosenSlots).length)],
  ];

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {stats.map(([k, v]) => (
          <div key={k} className="rounded-lg border px-3 py-2">
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd className="font-semibold tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      <WeekGrid compact={compact} blocks={calendarBlocks(choices, chosen, slots, colorOf, clashing)} />
      <ul className="space-y-1 text-sm">
        {choices
          .filter((c) => chosen[c.key])
          .map((c) => {
            const opt = c.options.find((o) => o.groupId === chosen[c.key])!;
            return (
              <li key={c.key} className="flex items-start gap-2">
                <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: colorOf(c.moduleCode) }} />
                <span>
                  {c.title} <span className="text-muted-foreground">({c.activity}{c.options.length > 1 ? ` · ${opt.label}` : ""})</span>
                  <span className="block text-xs text-muted-foreground">{(slots.get(opt.groupId) ?? []).map(formatSlot).join(", ")}</span>
                </span>
              </li>
            );
          })}
      </ul>
    </div>
  );
}
