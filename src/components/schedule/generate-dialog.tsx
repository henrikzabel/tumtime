"use client";

import { Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { WeekGrid } from "@/components/schedule/week-grid";
import { Button } from "@/components/ui/button";
import type { Choice } from "@/lib/planner/choices";
import { DAY_NAMES, formatMinutes, type WeeklySlot } from "@/lib/planner/timetable";
import { DEFAULT_PREFERENCES, generateSchedules, type Preferences } from "@/lib/schedule/generate";
import { calendarBlocks, SKIP, type Selection } from "@/lib/schedule/selection";
import { cn } from "@/lib/utils";

const selectClass =
  "h-7 rounded-md border border-input bg-input/20 px-2 text-xs/relaxed outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30";

/** Berkeleytime-style "Generate schedules": all clash-free group combinations, ranked. */
export function GenerateDialog({
  choices,
  slots,
  selection,
  colorOf,
  onClose,
  onApply,
}: {
  choices: Choice[];
  slots: Map<number, WeeklySlot[]>;
  selection: Selection;
  colorOf: (key: string) => string;
  onClose: () => void;
  onApply: (selection: Selection) => void;
}) {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Courses marked "not attending" stay out of the generated schedules.
  const active = useMemo(() => choices.filter((c) => selection[c.key] !== SKIP), [choices, selection]);
  const { results, total, truncated } = useMemo(
    () =>
      generateSchedules(
        active.map((c) => ({ key: c.key, options: c.options.map((o) => ({ groupId: o.groupId, slots: slots.get(o.groupId) ?? [] })) })),
        prefs,
      ),
    [active, slots, prefs],
  );
  const current = results[Math.min(index, results.length - 1)];
  const update = (patch: Partial<Preferences>) => {
    setPrefs((p) => ({ ...p, ...patch }));
    setIndex(0);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="gen-title">
      <div className="flex max-h-[90dvh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-background shadow-xl ring-1 ring-foreground/10">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 id="gen-title" className="flex items-center gap-2 font-semibold">
            <Sparkles className="size-4 text-primary" /> Generate schedules
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X />
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-3 text-xs/relaxed">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" className="size-3.5 accent-[var(--primary)]" checked={prefs.fewerDays} onChange={(e) => update({ fewerDays: e.target.checked })} />
            Fewer days on campus
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" className="size-3.5 accent-[var(--primary)]" checked={prefs.shortGaps} onChange={(e) => update({ shortGaps: e.target.checked })} />
            Short gaps
          </label>
          <label className="flex items-center gap-1.5">
            Start not before
            <select className={selectClass} value={prefs.notBefore ?? ""} onChange={(e) => update({ notBefore: e.target.value ? Number(e.target.value) : null })}>
              <option value="">any time</option>
              {[9, 10, 11, 12].map((h) => (
                <option key={h} value={h * 60}>
                  {h}:00
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5">
            End by
            <select className={selectClass} value={prefs.notAfter ?? ""} onChange={(e) => update({ notAfter: e.target.value ? Number(e.target.value) : null })}>
              <option value="">any time</option>
              {[14, 16, 18].map((h) => (
                <option key={h} value={h * 60}>
                  {h}:00
                </option>
              ))}
            </select>
          </label>
          <span className="flex items-center gap-1">
            Keep free:
            {[1, 2, 3, 4, 5].map((d) => {
              const on = prefs.freeDays.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  onClick={() => update({ freeDays: on ? prefs.freeDays.filter((x) => x !== d) : [...prefs.freeDays, d] })}
                  className={cn("h-6 rounded-md border px-1.5", on ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}
                >
                  {DAY_NAMES[d]}
                </button>
              );
            })}
          </span>
        </div>

        {results.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">
            No clash-free combination exists for these courses. Try marking a course as “Not attending”.
          </p>
        ) : (
          <div className="grid min-h-0 flex-1 md:grid-cols-[15rem_1fr]">
            <ol className="min-h-0 overflow-y-auto border-r p-2 text-xs/relaxed" aria-label="Generated schedules">
              <li className="px-2 pb-2 text-muted-foreground">
                {total.toLocaleString("en")} clash-free option{total === 1 ? "" : "s"}
                {truncated ? " (search stopped early)" : ""} · best {results.length}
              </li>
              {results.map((r, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => setIndex(i)}
                    aria-current={i === index}
                    className={cn("w-full rounded-md px-2 py-1.5 text-left hover:bg-muted", i === index && "bg-primary/10 ring-1 ring-primary/40")}
                  >
                    <div className="font-medium">
                      #{i + 1} · {r.summary.days.map((d) => DAY_NAMES[d]).join(" ")}
                    </div>
                    <div className="text-muted-foreground">
                      {r.summary.earliest !== null && `${formatMinutes(r.summary.earliest)}–${formatMinutes(r.summary.latest!)}`}
                      {r.summary.gapMinutes > 0 && ` · ${(r.summary.gapMinutes / 60).toFixed(1)} h gaps`}
                    </div>
                  </button>
                </li>
              ))}
            </ol>
            <div className="min-h-0 overflow-y-auto p-3">
              {current && <WeekGrid compact blocks={calendarBlocks(active, current.selection, slots, colorOf)} />}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 border-t px-4 py-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!current} onClick={() => current && onApply({ ...selection, ...current.selection })}>
            Use schedule #{Math.min(index, results.length - 1) + 1}
          </Button>
        </div>
      </div>
    </div>
  );
}
